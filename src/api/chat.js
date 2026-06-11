import { getBrowserContext, getAuthenticationStatus, setAuthenticationStatus, simulateHumanMouseMovement } from '../browser/browser.js';
import { checkAuthentication, checkVerification } from '../browser/auth.js';
import { shutdownBrowser, initBrowser } from '../browser/browser.js';
import { saveAuthToken } from '../browser/session.js';
import { getAvailableToken, markRateLimited, removeInvalidToken, checkTokenExpiry, checkAllTokensExpiry, getSafeToken, markInvalid, hasValidTokens } from './tokenManager.js';
import { sendTelegramNotification, formatTokenExpiryMessage } from '../utils/telegramNotifier.js';
import { getActiveModel } from '../utils/botSettings.js';
import { fetchWithQwenProxy } from '../utils/proxy.js';
import { pageEvaluateWithScreencast } from '../utils/pageEvaluateWrapper.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError, logWarn, logDebug, logRaw } from '../logger/index.js';
import crypto from 'crypto';
import {
    CHAT_API_URL, CREATE_CHAT_URL, CHAT_PAGE_URL, TASK_STATUS_URL,
    PAGE_TIMEOUT, RETRY_DELAY, PAGE_POOL_SIZE,
    DEFAULT_MODEL, MAX_RETRY_COUNT,
    TASK_POLL_MAX_ATTEMPTS, TASK_POLL_INTERVAL, TOKEN_EXPIRY_WARNING_MS,
    MODELS_API_URL
} from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODELS_FILE = path.join(__dirname, '..', 'AvailableModels.txt');
const AUTH_KEYS_FILE = path.join(__dirname, '..', 'Authorization.txt');

let authToken = null;
let availableModels = null;
let modelsLoadedFromAPI = false; // Флаг: загружены ли модели из API
let modelsFetchPromise = null; // Промис для предотвращения параллельных запросов
let authKeys = null;
let browserTokenRateLimited = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Page helpers ────────────────────────────────────────────────────────────

async function getPage(context) {
    if (context && typeof context.newPage === 'function') {
        const page = await context.newPage();
        // Simulate human-like mouse movement after tab creation
        await simulateHumanMouseMovement(page);
        return page;
    }

    if (context && typeof context.goto === 'function') {
        // Если передана Puppeteer Page, не переиспользуем её как рабочую:
        // создаём отдельную вкладку из того же браузера, чтобы избежать гонок
        // и случайного закрытия базовой страницы.
        if (typeof context.browser === 'function') {
            try {
                const browser = context.browser();
                if (browser && typeof browser.newPage === 'function') {
                    const page = await browser.newPage();
                    // Simulate human-like mouse movement after tab creation
                    await simulateHumanMouseMovement(page);
                    return page;
                }
            } catch (error) {
                logWarn(`Не удалось создать новую страницу из текущего контекста: ${error.message}`);
            }
        }

        if (typeof context.isClosed === 'function' && context.isClosed()) {
            throw new Error('Базовая страница браузера закрыта');
        }

        return context;
    }

    throw new Error('Неверный контекст: не страница Puppeteer, не контекст Playwright');
}

export const pagePool = {
    pages: [],
    maxSize: PAGE_POOL_SIZE,

    async getPage(context) {
        logDebug('📄 [pagePool.getPage] Запрос страницы...');
        const baseContext = getBrowserContext();
        while (this.pages.length > 0) {
            const page = this.pages.pop();
            try {
                if (page === baseContext) {
                    logWarn('Базовая страница не должна быть в пуле, пропускаем');
                    continue;
                }
                if (page.isClosed()) {
                    logWarn('Страница из пула закрыта, пропускаем');
                    continue;
                }
                logDebug('🔄 [pagePool.getPage] Проверка страницы из пула...');
                await pageEvaluateWithScreencast(page, () => document.readyState);
                logDebug('✅ [pagePool.getPage] Страница из пула готова');
                return page;
            } catch (e) {
                logWarn(`Страница из пула протухла (${e.message?.substring(0, 60)}), создаём новую`);
                if (page !== baseContext) {
                    try { await page.close(); } catch { /* already dead */ }
                }
            }
        }

        logDebug('🆕 [pagePool.getPage] Создание новой страницы...');
        const newPage = await getPage(context);
        logDebug(`🌐 [pagePool.getPage] Навигация к ${CHAT_PAGE_URL}...`);
        await newPage.goto(CHAT_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
        logDebug('✅ [pagePool.getPage] Навигация завершена');

        if (!authToken) {
            try {
                logDebug('🔑 [pagePool.getPage] Извлечение токена из localStorage...');
                authToken = await pageEvaluateWithScreencast(newPage, () => localStorage.getItem('token'));
                logInfo('Токен авторизации получен из браузера');
                if (authToken) {
                    saveAuthToken(authToken);
                }
            } catch (e) {
                logError('Ошибка при получении токена авторизации', e);
            }
        }

        logDebug('✅ [pagePool.getPage] Страница готова к использованию');
        return newPage;
    },

    releasePage(page) {
        try {
            if (page.isClosed()) { return; }
        } catch { return; }

        const baseContext = getBrowserContext();
        if (page === baseContext) {
            // Базовую страницу держим отдельно от пула.
            return;
        }

        if (this.pages.length < this.maxSize) {
            this.pages.push(page);
        } else {
            page.close().catch((e) => logError('Ошибка при закрытии страницы', e));
        }
    },

    async clear() {
        const baseContext = getBrowserContext();
        for (const page of this.pages) {
            if (page === baseContext) { continue; }
            try { await page.close(); } catch (e) {
                logError('Ошибка при закрытии страницы в пуле', e);
            }
        }
        this.pages = [];
    }
};

// ─── Task polling ────────────────────────────────────────────────────────────

export async function pollTaskStatus(taskId, page, token, maxAttempts = TASK_POLL_MAX_ATTEMPTS, interval = TASK_POLL_INTERVAL) {
    logInfo(`Начинаем опрос статуса задачи: ${taskId}`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const statusUrl = `${TASK_STATUS_URL}/${taskId}`;

            const result = await pageEvaluateWithScreencast(page, async (data) => {
                try {
                    const response = await fetch(data.url, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${data.token}`,
                            'Accept': 'application/json'
                        }
                    });
                    if (!response.ok) {
                        return { success: false, status: response.status, error: await response.text() };
                    }
                    return { success: true, data: await response.json() };
                } catch (e) {
                    return { success: false, error: e.toString() };
                }
            }, { url: statusUrl, token });

            if (!result.success) {
                logWarn(`Ошибка при проверке статуса (попытка ${attempt}/${maxAttempts}): ${result.error}`);
                if (attempt < maxAttempts) { await delay(interval); }
                continue;
            }

            const taskData = result.data;
            const taskStatus = taskData.task_status || taskData.status || 'unknown';
            logDebug(`Статус задачи (${attempt}/${maxAttempts}): ${taskStatus}`);

            if (taskStatus === 'completed' || taskStatus === 'success') {
                logInfo('Задача завершена успешно');
                return { success: true, status: 'completed', data: taskData };
            }

            if (taskStatus === 'failed' || taskStatus === 'error') {
                logError('Задача завершилась с ошибкой');
                return { success: false, status: 'failed', error: taskData.error || taskData.message || 'Task failed', data: taskData };
            }

            if (attempt < maxAttempts) { await delay(interval); }
        } catch (error) {
            logError(`Ошибка при опросе задачи (попытка ${attempt}/${maxAttempts})`, error);
            if (attempt < maxAttempts) { await delay(interval); }
        }
    }

    logError(`Превышен лимит попыток (${maxAttempts}) для задачи ${taskId}`);
    return { success: false, status: 'timeout', error: 'Task polling timeout exceeded' };
}

// ─── Token extraction ────────────────────────────────────────────────────────

export async function extractAuthToken(context, forceRefresh = false) {
    if (authToken && !forceRefresh) { return authToken; }

    try {
        const page = await getPage(context);
        const shouldClosePage = page !== context;
        try {
            await page.goto(CHAT_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
            await delay(RETRY_DELAY);

            const newToken = await pageEvaluateWithScreencast(page, () => localStorage.getItem('token'));
            if (shouldClosePage) { await page.close(); }

            if (newToken) {
                authToken = newToken;
                logInfo('Токен авторизации успешно извлечен');
                saveAuthToken(authToken);
                return authToken;
            }
            logError('Токен авторизации не найден в браузере');
            return null;
        } catch (error) {
            if (shouldClosePage) { await page.close().catch(() => { }); }
            throw error;
        }
    } catch (error) {
        logError('Ошибка при извлечении токена авторизации', error);
        return null;
    }
}

// ─── Models & keys from files ────────────────────────────────────────────────

export async function fetchModelsFromAPI() {
    try {
        logInfo('🔍 Загрузка списка моделей с Qwen API...');

        // Попробуем сначала новый метод через Qwen Chat prerendered data
        try {
            const { fetchQwenChatModels } = await import('../utils/modelSync.js');
            const chatModels = await fetchQwenChatModels();

            if (chatModels && chatModels.length > 0) {
                const modelIds = chatModels.map((m) => m.id);
                logInfo(`✅ Загружено ${modelIds.length} моделей с Qwen Chat`);
                return modelIds;
            }
        } catch (chatError) {
            logWarn(`⚠️ Метод Qwen Chat не сработал: ${chatError.message}`);
            logDebug('Переходим к fallback через API endpoint...');
        }

        // Fallback: старый метод через API endpoint
        logDebug(`MODELS_API_URL: ${MODELS_API_URL}`);

        // Добавляем параметры для получения большего количества моделей
        // Пробуем разные варианты URL с параметрами пагинации
        let modelsUrl = MODELS_API_URL;

        // Если URL не содержит параметров, добавляем их
        if (!MODELS_API_URL.includes('?')) {
            // Qwen API использует limit для пагинации
            const params = new URLSearchParams({
                limit: '1000' // Максимальное количество моделей
            });
            modelsUrl = `${MODELS_API_URL}?${params.toString()}`;
            logDebug(`URL с параметрами пагинации: ${modelsUrl}`);
        }

        logInfo(`Пытаемся получить модели с URL: ${modelsUrl}`);

        // Пробуем получить через node fetch (без браузера)
        const response = await fetchWithQwenProxy(modelsUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        logDebug(`API Response status: ${response.status}`);
        logDebug(`API Response ok: ${response.ok}`);

        if (response.ok) {
            const data = await response.json();
            logDebug(`API Response type: ${Array.isArray(data) ? 'array' : typeof data}`);

            if (!Array.isArray(data)) {
                logDebug(`API Response keys: ${Object.keys(data).join(', ')}`);
            }

            // Логируем структуру для отладки
            logDebug(`data.data существует: ${!!data.data}`);
            if (data.data) {
                logDebug(`data.data type: ${typeof data.data}`);
                logDebug(`data.data is array: ${Array.isArray(data.data)}`);
                if (typeof data.data === 'object' && !Array.isArray(data.data)) {
                    logDebug(`data.data keys: ${Object.keys(data.data).join(', ')}`);
                    if (data.data.data) {
                        logDebug(`data.data.data is array: ${Array.isArray(data.data.data)}`);
                        logDebug(`data.data.data length: ${data.data.data.length}`);
                    }
                } else if (Array.isArray(data.data)) {
                    logDebug(`data.data length: ${data.data.length}`);
                }
            }

            // Пробуем разные форматы ответа
            let models = [];
            if (Array.isArray(data)) {
                models = data;
                logDebug(`Извлечены модели: данные - массив (${data.length} элементов)`);
            } else if (data.data && data.data.data && Array.isArray(data.data.data)) {
                // Вложенная структура Qwen API: { success: true, data: { data: [...] } }
                models = data.data.data;
                logDebug(`Извлечены модели: data.data.data (${data.data.data.length} элементов)`);
            } else if (data.data && Array.isArray(data.data)) {
                // Простая структура: { data: [...] }
                models = data.data;
                logDebug(`Извлечены модели: data.data (${data.data.length} элементов)`);
            } else if (data.models && Array.isArray(data.models)) {
                models = data.models;
                logDebug(`Извлечены модели: data.models (${data.models.length} элементов)`);
            } else {
                logWarn(`⚠️ Не удалось распознать формат ответа API. Keys: ${Object.keys(data).join(', ')}`);
                logWarn('Полный JSON ответ от API:');
                logWarn(JSON.stringify(data, null, 2));
            }

            // Извлекаем ID моделей
            const modelIds = models.map((m) => {
                if (typeof m === 'string') { return m; }
                return m.id || m.model_id || m.name;
            }).filter(Boolean);

            logDebug(`Извлечено modelIds: ${modelIds.length}`);
            if (modelIds.length > 0 && modelIds.length <= 5) {
                logDebug(`Первые модели: ${modelIds.join(', ')}`);
            }

            if (modelIds.length > 0) {
                logInfo(`✅ Загружено ${modelIds.length} моделей с API endpoint`);

                // Проверяем, есть ли информация о пагинации
                let paginationInfo = null;
                if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
                    const hasMore = data.data.has_more || data.data.hasMore;
                    const total = data.data.total || data.data.total_count;
                    const nextPage = data.data.next_page || data.data.nextPage;

                    if (hasMore || total) {
                        paginationInfo = { hasMore, total, nextPage };
                        logInfo(`📊 Пагинация: всего=${total}, есть еще=${hasMore}, следующая страница=${nextPage}`);
                    }
                }

                // TODO: Если есть пагинация, можно загрузить следующие страницы
                // if (paginationInfo && paginationInfo.hasMore) {
                //     logInfo('Загрузка следующих страниц моделей...');
                //     // Здесь можно добавить цикл для загрузки всех страниц
                // }

                return modelIds;
            } else {
                logWarn(`⚠️ Массив models не пустой (${models.length}), но modelIds пустой`);
            }
        } else {
            logWarn(`⚠️ API вернул статус ${response.status}, используем локальный файл`);
        }

        return null;
    } catch (error) {
        logWarn(`❌ Не удалось загрузить модели: ${error.message}`);
        logDebug(`Stack trace: ${error.stack}`);
        return null;
    }
}

/**
 * Загрузить список моделей из API с кэшированием
 * Вызывается при первом запросе к LLM, результат кэшируется в памяти
 * @returns {Promise<string[]>} - Список доступных моделей
 */
export async function ensureModelsLoaded() {
    // Если модели уже загружены, возвращаем кэш
    if (availableModels && availableModels.length > 0) {
        logDebug(`📦 Модели уже загружены: ${availableModels.length} моделей, из API: ${modelsLoadedFromAPI}`);
        return availableModels;
    }

    // Если уже идет загрузка, ждем тот же промис
    if (modelsFetchPromise) {
        logDebug('⏳ Ожидание завершения параллельной загрузки моделей...');
        return modelsFetchPromise;
    }

    // Начинаем загрузку
    logInfo('🚀 Начинаем процесс загрузки моделей...');
    modelsFetchPromise = (async () => {
        try {
            logInfo('🔄 Загрузка списка моделей из Qwen API...');
            const apiModels = await fetchModelsFromAPI();

            logDebug(`Результат fetchModelsFromAPI: ${apiModels ? apiModels.length + ' моделей' : 'null'}`);

            if (apiModels && apiModels.length > 0) {
                availableModels = apiModels;
                modelsLoadedFromAPI = true;
                logInfo(`✅ Загружено ${apiModels.length} моделей с Qwen API`);
                logInfo('===== ДОСТУПНЫЕ МОДЕЛИ (API) =====');
                apiModels.forEach((m) => logInfo(`- ${m}`));
                logInfo('===================================');

                return availableModels;
            }

            // API не вернул модели - используем файл
            logWarn('⚠️ API не вернул список моделей, используем AvailableModels.txt');
            const fileModels = loadModelsFromFile();
            logDebug(`loadModelsFromFile вернул: ${fileModels ? fileModels.length + ' моделей' : 'null'}`);
            return fileModels;
        } catch (error) {
            logError('❌ Ошибка загрузки моделей из API', error);
            logWarn('⚠️ Используем резервный список из AvailableModels.txt');
            const fileModels = loadModelsFromFile();
            logDebug(`loadModelsFromFile (catch) вернул: ${fileModels ? fileModels.length + ' моделей' : 'null'}`);
            return fileModels;
        } finally {
            modelsFetchPromise = null; // Сбрасываем промис
        }
    })();

    return modelsFetchPromise;
}

/**
 * Загрузить модели из файла (fallback)
 * @returns {string[]} - Список моделей из файла
 */
function loadModelsFromFile() {
    try {
        logDebug(`📂 Попытка загрузки моделей из файла: ${MODELS_FILE}`);

        if (!fs.existsSync(MODELS_FILE)) {
            logError(`❌ Файл с моделями не найден: ${MODELS_FILE}`);
            const fallback = [getActiveModel()];
            logDebug(`Fallback модели: ${fallback.join(', ')}`);
            return fallback;
        }

        const fileContent = fs.readFileSync(MODELS_FILE, 'utf8');
        logDebug(`Размер файла: ${fileContent.length} байт`);

        const models = fileContent
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#'));

        logDebug(`Распознано моделей: ${models.length}`);

        if (models.length > 0) {
            availableModels = models;
            modelsLoadedFromAPI = false;

            logInfo('===== ДОСТУПНЫЕ МОДЕЛИ (ФАЙЛ) =====');
            models.forEach((m) => logInfo(`- ${m}`));
            logInfo('====================================');
        } else {
            logWarn('⚠️ Файл существует, но не содержит моделей');
        }

        return models;
    } catch (error) {
        logError('❌ Ошибка при чтении файла с моделями', error);
        const fallback = [getActiveModel()];
        logDebug(`Fallback модели после ошибки: ${fallback.join(', ')}`);
        return fallback;
    }
}

/**
 * Получить список доступных моделей (синхронная версия для обратной совместимости)
 * @returns {string[]} - Список доступных моделей
 */
export function getAvailableModelsFromFile() {
    // Если модели еще не загружены, загружаем из файла
    if (!availableModels || availableModels.length === 0) {
        return loadModelsFromFile();
    }
    return availableModels;
}

function getAuthKeysFromFile() {
    try {
        if (!fs.existsSync(AUTH_KEYS_FILE)) {
            const template = '# Файл API-ключей для прокси\n# --------------------------------------------\n# В этом файле перечислены токены, которые\n# прокси будет считать «действительными».\n# Один ключ — одна строка без пробелов.\n#\n# 1) Хотите ОТКЛЮЧИТЬ авторизацию целиком?\n#    Оставьте файл пустым — сервер перестанет\n#    проверять заголовок Authorization.\n#\n# 2) Хотите разрешить доступ нескольким людям?\n#    Впишите каждый ключ в отдельной строке:\n#      d35ab3e1-a6f9-4d...\n#      f2b1cd9c-1b2e-4a...\n#\n# Пустые строки и строки, начинающиеся с «#»,\n# игнорируются.';
            try {
                fs.writeFileSync(AUTH_KEYS_FILE, template, { encoding: 'utf8', flag: 'wx' });
                logInfo(`Создан шаблон файла ключей: ${AUTH_KEYS_FILE}`);
            } catch (e) {
                logError('Не удалось создать шаблон Authorization.txt', e);
            }
            return [];
        }
        return fs.readFileSync(AUTH_KEYS_FILE, 'utf8')
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#'));
    } catch (error) {
        logError('Ошибка при чтении файла с ключами авторизации', error);
        return [];
    }
}

export function isValidModel(modelName) {
    if (!availableModels) { availableModels = getAvailableModelsFromFile(); }
    return availableModels.includes(modelName);
}

export function getDefaultModel() {
    // Используем активную модель из настроек бота
    return getActiveModel();
}

export function getAllModels() {
    if (!availableModels) { availableModels = getAvailableModelsFromFile(); }
    return {
        models: availableModels.map((model) => ({
            id: model,
            name: model,
            description: `Модель ${model}`
        }))
    };
}

export function getApiKeys() {
    if (!authKeys) { authKeys = getAuthKeysFromFile(); }
    return authKeys;
}

// ─── sendMessage — helper functions ──────────────────────────────────────────

function validateAndPrepareMessage(message) {
    if (message === null || message === undefined) {
        return { error: 'Сообщение не может быть пустым' };
    }
    if (typeof message === 'string') { return { content: message }; }
    if (Array.isArray(message)) {
        const isValid = message.every((item) =>
            (item.type === 'text' && typeof item.text === 'string') ||
            (item.type === 'image' && typeof item.image === 'string') ||
            (item.type === 'file' && typeof item.file === 'string')
        );
        if (!isValid) { return { error: 'Некорректная структура составного сообщения' }; }
        return { content: message };
    }
    return { error: 'Неподдерживаемый формат сообщения' };
}

async function resolveAuthToken(browserContext) {
    // Сначала пытаемся получить безопасный токен (не истекающий в ближайшее время)
    let tokenObj = await getSafeToken(TOKEN_EXPIRY_WARNING_MS);

    // Если безопасных токенов нет, проверяем все токены
    if (!tokenObj) {
        const expiryStatus = checkAllTokensExpiry(TOKEN_EXPIRY_WARNING_MS);

        if (expiryStatus.allTokensExpired) {
            logWarn('⚠️ Все токены истекают или уже истекли!');

            // Отправляем уведомление в Telegram
            const telegramMessage = formatTokenExpiryMessage(expiryStatus.expiringTokens);
            await sendTelegramNotification(telegramMessage);

            // Пытаемся использовать любой доступный токен (даже истекающий)
            tokenObj = await getAvailableToken();

            if (!tokenObj) {
                logError('Нет доступных токенов для использования');
                return null;
            }

            logWarn(`Используем истекающий токен: ${tokenObj.id}`);
        } else {
            // Есть активные токены, но они не попали в безопасную выборку
            tokenObj = await getAvailableToken();
        }
    }

    if (tokenObj && tokenObj.token) {
        // Проверяем, не истекает ли токен в ближайшее время
        const expiryInfo = checkTokenExpiry(tokenObj.id, TOKEN_EXPIRY_WARNING_MS);

        if (expiryInfo.willExpireSoon) {
            const timeLeftMs = expiryInfo.timeLeft;
            const timeLeftMin = timeLeftMs ? Math.floor(timeLeftMs / 60000) : 0;

            if (expiryInfo.isExpired || expiryInfo.isInvalid) {
                logWarn(`Токен ${tokenObj.id} недействителен или истёк, пытаемся использовать следующий`);
                // Помечаем как rate limited и пробуем другой
                if (tokenObj.id !== 'browser') {
                    markRateLimited(tokenObj.id, 1); // 1 час
                }
                return await resolveAuthToken(browserContext); // Рекурсивно пробуем другой
            } else if (timeLeftMin <= 60) {
                logWarn(`⚠️ Токен ${tokenObj.id} истекает через ${timeLeftMin} мин. Используем с осторожностью.`);
            }
        }

        authToken = tokenObj.token;
        logInfo(`Используется аккаунт: ${tokenObj.id}`);
        return tokenObj;
    }

    if (browserTokenRateLimited) {
        logWarn('Browser-токен залимичен, пропускаем fallback');
        return null;
    }

    if (!getAuthenticationStatus()) {
        logInfo('Проверка авторизации...');
        const authCheck = await checkAuthentication(browserContext);
        if (!authCheck) { return null; }
    }

    if (!authToken) {
        logInfo('Получение токена авторизации...');
        authToken = await extractAuthToken(browserContext);
    }

    return authToken ? { id: 'browser', token: authToken } : null;
}

function buildPayloadV2(messageContent, model, chatId, parentId, files, systemMessage, tools, toolChoice, chatType = 't2t', size = null) {
    const userMessageId = crypto.randomUUID();
    const assistantChildId = crypto.randomUUID();

    const isVideo = chatType === 't2v';

    const featureConfig = {
        thinking_enabled: isVideo,
        output_schema: 'phase'
    };
    if (isVideo) {
        featureConfig.research_mode = 'normal';
        featureConfig.auto_thinking = true;
        featureConfig.thinking_format = 'summary';
        featureConfig.auto_search = true;
    }

    const newMessage = {
        fid: userMessageId,
        parentId, parent_id: parentId,
        role: 'user',
        content: messageContent,
        chat_type: chatType, sub_chat_type: chatType,
        timestamp: Math.floor(Date.now() / 1000),
        user_action: 'chat',
        models: [model],
        files: files || [],
        childrenIds: [assistantChildId],
        extra: { meta: { subChatType: chatType } },
        feature_config: featureConfig
    };

    const payload = {
        stream: !isVideo,
        incremental_output: true,
        chat_id: chatId,
        chat_mode: 'normal',
        messages: [newMessage],
        model,
        parent_id: parentId,
        timestamp: Math.floor(Date.now() / 1000)
    };

    if (size) { payload.size = size; }

    if (systemMessage) {
        payload.system_message = systemMessage;
        logDebug(`System message: ${systemMessage.substring(0, 100)}${systemMessage.length > 100 ? '...' : ''}`);
    }
    if (tools && Array.isArray(tools) && tools.length > 0) {
        payload.tools = tools;
        payload.tool_choice = toolChoice || 'auto';
    }

    return payload;
}

function parseNonSseCompletionBody(body) {
    try {
        const parsed = JSON.parse(body);
        const topLevelCode = parsed?.code;
        const nestedCode = parsed?.data?.code;
        const hasStructuredError =
            parsed?.success === false ||
            Boolean(parsed?.error) ||
            Boolean(parsed?.data?.error) ||
            Boolean(topLevelCode) ||
            Boolean(nestedCode);

        if (hasStructuredError) {
            const isRateLimited = topLevelCode === 'RateLimited' || nestedCode === 'RateLimited';
            return {
                success: false,
                status: isRateLimited ? 429 : 500,
                errorBody: body
            };
        }

        if (parsed.choices || parsed.id || (parsed.success === true && parsed.data)) {
            return { success: true, isTask: false, data: parsed };
        }
    } catch {
        // Ignore parse errors here and return a generic failure below.
    }

    return { success: false, error: 'Unexpected non-SSE 200 response', errorBody: body };
}

async function executeApiRequestWithNodeStreaming(apiUrl, payload, token, onChunk) {
    try {
        if (!token) { return { success: false, error: 'Токен авторизации не найден' }; }
        if (typeof fetch !== 'function') { return { success: false, error: 'Fetch API is unavailable' }; }

        const response = await fetchWithQwenProxy(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Accept': '*/*'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            return { success: false, status: response.status, statusText: response.statusText, errorBody };
        }

        if (payload.stream === false) {
            const jsonResponse = await response.json();
            if (jsonResponse.code === 'RateLimited' || jsonResponse.error) {
                return { success: false, status: 429, errorBody: JSON.stringify(jsonResponse) };
            }
            return { success: true, isTask: true, data: jsonResponse };
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/event-stream')) {
            const body = await response.text();
            return parseNonSseCompletionBody(body);
        }

        const reader = response.body?.getReader?.();
        if (!reader) {
            const body = await response.text();
            return parseNonSseCompletionBody(body);
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let responseId = null;
        let usage = null;
        let finished = false;
        let streamError = null;
        let hasStreamedChunks = false;

        while (!finished) {
            const { done, value } = await reader.read();
            if (done) { break; }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line || !line.startsWith('data:')) { continue; }

                const jsonStr = line.substring(5).trim();
                if (!jsonStr) { continue; }
                if (jsonStr === '[DONE]') {
                    finished = true;
                    break;
                }

                try {
                    const chunk = JSON.parse(jsonStr);

                    if (chunk.code === 'RateLimited' || (chunk.code && chunk.detail)) {
                        streamError = { status: 429, errorBody: JSON.stringify(chunk) };
                        finished = true;
                        break;
                    }
                    if (chunk.error && !chunk.choices) {
                        streamError = { status: 500, errorBody: JSON.stringify(chunk) };
                        finished = true;
                        break;
                    }

                    if (chunk['response.created']) { responseId = chunk['response.created'].response_id; }
                    if (chunk.response_id) { responseId = chunk.response_id; }

                    if (chunk.choices && chunk.choices[0]) {
                        const delta = chunk.choices[0].delta;
                        if (delta && delta.content) {
                            fullContent += delta.content;
                            if (typeof onChunk === 'function') {
                                onChunk(delta.content);
                                hasStreamedChunks = true;
                            }
                        }
                        if (delta && delta.status === 'finished') { finished = true; }
                        if (chunk.choices[0].finish_reason) { finished = true; }
                    }

                    if (chunk.usage) { usage = chunk.usage; }
                } catch {
                    // Ignore broken chunks, keep reading stream.
                }
            }
        }

        if (streamError) {
            return { success: false, ...streamError, hasStreamedChunks };
        }

        return {
            success: true,
            isTask: false,
            hasStreamedChunks,
            data: {
                id: responseId || 'chatcmpl-' + Date.now(),
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: payload.model,
                choices: [{ index: 0, message: { role: 'assistant', content: fullContent }, finish_reason: 'stop' }],
                usage: usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                response_id: responseId
            }
        };
    } catch (error) {
        return { success: false, error: error.toString() };
    }
}

async function executeApiRequest(page, apiUrl, payload, token, onChunk = null) {
    if (payload?.stream !== false && typeof onChunk === 'function') {
        const streamedResponse = await executeApiRequestWithNodeStreaming(apiUrl, payload, token, onChunk);

        const canReturnDirectly =
            streamedResponse.success ||
            Boolean(streamedResponse.status) ||
            Boolean(streamedResponse.errorBody) ||
            streamedResponse.hasStreamedChunks === true;

        if (canReturnDirectly) {
            return streamedResponse;
        }

        logWarn(`Node-streaming недоступен (${streamedResponse.error || 'unknown error'}), fallback к browser fetch.`);
    }

    const requestBody = { apiUrl, payload, token };

    logDebug(`Используем токен: ${token ? 'Токен существует' : 'Токен отсутствует'}`);
    logDebug(`API URL: ${apiUrl}`);

    return pageEvaluateWithScreencast(page, async (data) => {
        try {
            const t = data.token;
            if (!t) { return { success: false, error: 'Токен авторизации не найден' }; }

            const response = await fetch(data.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${t}`,
                    'Accept': '*/*'
                },
                body: JSON.stringify(data.payload)
            });

            if (response.ok) {
                if (data.payload.stream === false) {
                    const jsonResponse = await response.json();
                    if (jsonResponse.code === 'RateLimited' || jsonResponse.error) {
                        return { success: false, status: 429, errorBody: JSON.stringify(jsonResponse) };
                    }
                    return { success: true, isTask: true, data: jsonResponse };
                }

                const contentType = response.headers.get('content-type') || '';

                if (!contentType.includes('text/event-stream')) {
                    const body = await response.text();
                    try {
                        const parsed = JSON.parse(body);
                        const topLevelCode = parsed?.code;
                        const nestedCode = parsed?.data?.code;
                        const hasStructuredError =
                            parsed?.success === false ||
                            Boolean(parsed?.error) ||
                            Boolean(parsed?.data?.error) ||
                            Boolean(topLevelCode) ||
                            Boolean(nestedCode);

                        // API иногда возвращает JSON с success=false и code при HTTP 200.
                        if (hasStructuredError) {
                            const isRateLimited = topLevelCode === 'RateLimited' || nestedCode === 'RateLimited';
                            return {
                                success: false,
                                status: isRateLimited ? 429 : 500,
                                errorBody: body
                            };
                        }
                        // Валидный JSON-ответ completion (иногда Qwen возвращает так)
                        if (parsed.choices || parsed.id || (parsed.success === true && parsed.data)) {
                            return { success: true, isTask: false, data: parsed };
                        }
                    } catch { /* not JSON, treat as unexpected */ }
                    return { success: false, error: 'Unexpected non-SSE 200 response', errorBody: body };
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let fullContent = '';
                let responseId = null;
                let usage = null;
                let finished = false;
                let streamError = null;

                while (!finished) {
                    const { done, value } = await reader.read();
                    if (done) { break; }
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.trim() || !line.startsWith('data: ')) { continue; }
                        const jsonStr = line.substring(6).trim();
                        if (!jsonStr) { continue; }
                        try {
                            const chunk = JSON.parse(jsonStr);

                            if (chunk.code === 'RateLimited' || (chunk.code && chunk.detail)) {
                                streamError = { status: 429, errorBody: JSON.stringify(chunk) };
                                finished = true;
                                break;
                            }
                            if (chunk.error && !chunk.choices) {
                                streamError = { status: 500, errorBody: JSON.stringify(chunk) };
                                finished = true;
                                break;
                            }

                            if (chunk['response.created']) { responseId = chunk['response.created'].response_id; }
                            if (chunk.choices && chunk.choices[0]) {
                                const delta = chunk.choices[0].delta;
                                if (delta && delta.content) { fullContent += delta.content; }
                                if (delta && delta.status === 'finished') { finished = true; }
                            }
                            if (chunk.usage) { usage = chunk.usage; }
                        } catch { /* ignore parse errors for individual chunks */ }
                    }
                }

                if (streamError) {
                    return { success: false, ...streamError };
                }

                return {
                    success: true,
                    isTask: false,
                    data: {
                        id: responseId || 'chatcmpl-' + Date.now(),
                        object: 'chat.completion',
                        created: Math.floor(Date.now() / 1000),
                        model: data.payload.model,
                        choices: [{ index: 0, message: { role: 'assistant', content: fullContent }, finish_reason: 'stop' }],
                        usage: usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                        response_id: responseId
                    }
                };
            }

            const errorBody = await response.text();
            return { success: false, status: response.status, statusText: response.statusText, errorBody };
        } catch (error) {
            return { success: false, error: error.toString() };
        }
    }, requestBody);
}

async function handleApiError(response, tokenObj, message, model, chatId, parentId, files, retryCount, chatType, size, waitForCompletion, onChunk = null) {
    logRaw(JSON.stringify(response));

    // Улучшенная обработка ошибок с полной диагностикой
    const errorMessage = response.error || response.statusText || response.errorBody || 'Неизвестная ошибка';
    logError(`Ошибка при получении ответа: ${errorMessage}`);

    // Логируем дополнительную информацию для отладки
    if (response.status) { logDebug(`HTTP статус: ${response.status}`); }
    if (response.errorBody) { logDebug(`Тело ответа с ошибкой: ${response.errorBody.substring(0, 500)}${response.errorBody.length > 500 ? '...' : ''}`); }
    if (response.error) { logDebug(`Ошибка из response: ${response.error}`); }
    if (response.statusText) { logDebug(`StatusText: ${response.statusText}`); }
    logDebug(`Полный объект ответа: ${JSON.stringify(response, null, 2).substring(0, 1000)}`);

    if (response.html && response.html.includes('Verification')) {
        setAuthenticationStatus(false);
        logInfo('Обнаружена необходимость верификации, перезапуск браузера в видимом режиме...');
        await pagePool.clear();
        authToken = null;
        await shutdownBrowser();
        await initBrowser(true);
        return { error: 'Требуется верификация. Браузер запущен в видимом режиме.', verification: true, chatId };
    }

    if (response.status === 401 || (response.errorBody && (response.errorBody.includes('Unauthorized') || response.errorBody.includes('Token has expired')))) {
        logWarn(`Токен ${tokenObj?.id} недействителен (401). Удаляем и пробуем другой.`);
        authToken = null;
        browserTokenRateLimited = false;
        if (tokenObj?.id && tokenObj.id !== 'browser') {
            markInvalid(tokenObj.id);
        }
        if (hasValidTokens() && retryCount < MAX_RETRY_COUNT) {
            return await sendMessage(message, model, chatId, parentId, files, null, null, null, chatType, size, waitForCompletion, retryCount + 1, onChunk);
        }
        logError('Не осталось валидных токенов или исчерпаны попытки.');
        return { error: 'Все токены недействительны (401). Требуется повторная авторизация.', chatId };
    }

    if (response.status === 429 || (response.errorBody && response.errorBody.includes('RateLimited'))) {
        let hours = 24;
        try {
            const rateInfo = JSON.parse(response.errorBody);
            hours = Number(rateInfo.num) || 24;
        } catch { /* errorBody might not be valid JSON */ }

        // Для генерации изображений/видео не помечаем токен как rate-limited
        // это отдельный лимит API, не связанный с текстовыми запросами
        const isMediaGeneration = chatType === 't2i' || chatType === 't2v';

        if (isMediaGeneration) {
            logWarn(`⚠️ Rate limit для генерации медиа (${chatType}). НЕ помечаем токен - это отдельный лимит.`);
            logWarn(`⏳ Нужно подождать ${hours}ч или использовать другой аккаунт`);
        } else if (tokenObj?.id === 'browser') {
            browserTokenRateLimited = true;
            logWarn(`Browser-токен достиг лимита. Помечаем на ${hours}ч.`);
        } else if (tokenObj?.id) {
            markRateLimited(tokenObj.id, hours);
            logWarn(`Токен ${tokenObj.id} достиг лимита. Помечаем на ${hours}ч и пробуем другой токен...`);
        }

        authToken = null;

        // Для медиа-генерации не пытаемся retry с другим токеном
        // так как лимит общий для всех аккаунтов
        if (isMediaGeneration) {
            return {
                error: `Rate limit для генерации изображений. Попробуйте через ${hours}ч`,
                chatId,
                rateLimit: true,
                rateLimitHours: hours
            };
        }

        if (hasValidTokens() && retryCount < MAX_RETRY_COUNT) {
            return await sendMessage(message, model, chatId, parentId, files, null, null, null, chatType, size, waitForCompletion, retryCount + 1, onChunk);
        }
        return { error: `Все токены заблокированы по лимиту (${hours}ч)`, chatId };
    }

    return { error: response.error || response.statusText, details: response.errorBody || 'Нет дополнительных деталей', chatId };
}

// ─── Main public API ─────────────────────────────────────────────────────────

export async function sendMessage(message, model = null, chatId = null, parentId = null, files = null, tools = null, toolChoice = null, systemMessage = null, chatType = 't2t', size = null, waitForCompletion = true, retryCount = 0, onChunk = null) {
    const startTime = Date.now();
    if (!availableModels) { availableModels = getAvailableModelsFromFile(); }

    let chatWasJustCreated = false;
    if (!chatId) {
        logDebug('📝 [sendMessage] Чат не указан, создаём новый...');
        const newChatResult = await createChatV2(model);
        if (newChatResult.error) {
            return { error: 'Не удалось создать чат: ' + newChatResult.error };
        };
        chatId = newChatResult.chatId;
        chatWasJustCreated = true;
        logInfo(`✅ [sendMessage] Создан новый чат v2 с ID: ${chatId} (за ${Date.now() - startTime}ms)`);
    }

    const validated = validateAndPrepareMessage(message);
    if (validated.error) {
        logError(validated.error);
        return { error: validated.error, chatId };
    }
    const messageContent = validated.content;

    if (!model || model.trim() === '') {
        logWarn('Модель не указана, используем модель по умолчанию');
        model = getDefaultModel();
    } else if (!isValidModel(model)) {
        logWarn(`Модель "${model}" не найдена в списке доступных.`);
        logWarn(`Доступные модели: ${availableModels ? availableModels.slice(0, 10).join(', ') + '...' : 'не загружены'}`);
        logWarn(`Используем модель по умолчанию: ${getDefaultModel()}`);
        model = getDefaultModel();
    }
    logInfo(`Используемая модель: "${model}"`);
    if (chatType !== 't2t') {
        const typeLabels = { t2i: 'изображение', t2v: 'видео' };
        logInfo(`Тип генерации: ${chatType} (${typeLabels[chatType] || chatType})${size ? `, размер: ${size}` : ''}`);
    }

    const browserContext = getBrowserContext();
    if (!browserContext) { return { error: 'Браузер не инициализирован', chatId }; }

    // Если чат только что был создан, authToken уже установлен createChatV2
    // Не вызываем resolveAuthToken, чтобы не переключить на другой аккаунт
    let tokenObj = null;
    if (!chatWasJustCreated) {
        tokenObj = await resolveAuthToken(browserContext);
        if (!tokenObj) { return { error: 'Ошибка авторизации: не удалось получить токен', chatId }; }
    } else {
        logDebug(`🔑 Используем токен от createChatV2: ${authToken?.substring(0, 20)}...`);
    }

    let page = null;
    try {
        logDebug('📄 [sendMessage] Запрос страницы из пула...');
        page = await pagePool.getPage(browserContext);
        logDebug('✅ [sendMessage] Страница получена');

        const verificationNeeded = await checkVerification(page);
        if (verificationNeeded) {
            logDebug('🔄 [sendMessage] Требуется верификация, перезагружаем страницу...');
            await page.reload({ waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
        }

        if (!authToken) {
            logWarn('Токен отсутствует перед отправкой запроса');
            authToken = await pageEvaluateWithScreencast(page, () => localStorage.getItem('token'));
            if (!authToken) { return { error: 'Токен авторизации не найден. Требуется перезапуск в ручном режиме.', chatId }; }
            saveAuthToken(authToken);
        }

        logInfo('Отправка запроса к API v2...' + chatId);

        const payload = buildPayloadV2(messageContent, model, chatId, parentId, files, systemMessage, tools, toolChoice, chatType, size);
        logDebug('=== PAYLOAD V2 ===\n' + JSON.stringify(payload, null, 2));
        logDebug(`Отправка сообщения в чат ${chatId} с parent_id: ${parentId || 'null'}`);

        const apiUrl = `${CHAT_API_URL}?chat_id=${chatId}`;
        logDebug('🌐 [sendMessage] Выполнение API запроса...');
        const response = await executeApiRequest(page, apiUrl, payload, authToken, onChunk);
        logDebug('✅ [sendMessage] API запрос завершён');

        const totalElapsed = Date.now() - startTime;
        logDebug(`⏱️ [sendMessage] Общее время выполнения: ${totalElapsed}ms`);

        if (response.success && response.isTask) {
            logInfo('Обнаружен ответ с задачей (видеогенерация)');
            logRaw(JSON.stringify(response.data));

            const taskId = extractTaskId(response.data);
            if (!taskId) {
                logError('Task ID не найден в ответе');
                pagePool.releasePage(page);
                page = null;
                return { error: 'Task ID not found in response', chatId, rawResponse: response.data };
            }

            logInfo(`Task ID: ${taskId}`);

            if (!waitForCompletion) {
                logInfo('Возвращаем task_id для клиентского polling');
                pagePool.releasePage(page);
                page = null;
                return {
                    id: taskId,
                    object: 'chat.completion.task',
                    created: Math.floor(Date.now() / 1000),
                    model,
                    task_id: taskId,
                    chatId,
                    parentId: response.data.data?.parent_id || taskId,
                    status: 'processing',
                    message: 'Video generation task created. Poll GET /api/tasks/status/:taskId for progress.'
                };
            }

            logInfo('Начинаем polling для получения видео...');
            const taskResult = await pollTaskStatus(taskId, page, authToken);

            pagePool.releasePage(page);
            page = null;

            if (taskResult.success && taskResult.status === 'completed') {
                logInfo('Видео успешно сгенерировано');
                const videoUrl = extractVideoUrl(taskResult.data);
                return {
                    id: taskId,
                    object: 'chat.completion',
                    created: Math.floor(Date.now() / 1000),
                    model,
                    choices: [{
                        index: 0,
                        message: { role: 'assistant', content: videoUrl || JSON.stringify(taskResult.data) },
                        finish_reason: 'stop'
                    }],
                    usage: taskResult.data.usage || { prompt_tokens: 0, output_tokens: 0, total_tokens: 0 },
                    response_id: taskId,
                    chatId,
                    parentId: taskId,
                    task_id: taskId,
                    video_url: videoUrl
                };
            }

            logError(`Не удалось получить видео: ${taskResult.error}`);
            return { error: taskResult.error || 'Video generation failed', status: taskResult.status, chatId, task_id: taskId };
        }

        pagePool.releasePage(page);
        page = null;

        if (response.success) {
            logRaw(JSON.stringify(response.data));
            logInfo('Ответ получен успешно');
            response.data.chatId = chatId;
            response.data.parentId = response.data.response_id;
            response.data.id = response.data.id || 'chatcmpl-' + Date.now();

            // Fallback: если поток чанков не был отдан, отправляем контент единым куском.
            if (typeof onChunk === 'function' && response.data.choices?.[0]?.message?.content && !response.hasStreamedChunks) {
                onChunk(response.data.choices[0].message.content);
            }

            return response.data;
        }

        return await handleApiError(response, tokenObj, message, model, chatId, parentId, files, retryCount, chatType, size, waitForCompletion, onChunk);
    } catch (error) {
        const elapsed = Date.now() - startTime;
        logError(`❌ [sendMessage] Исключение при отправке сообщения (после ${elapsed}ms)`, error);

        // Проверяем на Puppeteer protocol timeout - нужен перезапуск браузера
        if (error.message && error.message.includes('Runtime.callFunctionOn timed out')) {
            logError('⚠️ [sendMessage] Puppeteer protocol timeout - требуется перезапуск сервиса');
            logError(`⚠️ [sendMessage] Таймаут произошел после ${elapsed}ms`);
            logError('Завершение работы с кодом 42 для автоматического перезапуска...');
            process.exit(42);
        }

        return { error: error.toString(), chatId };
    } finally {
        if (page) {
            pagePool.releasePage(page);
        }
    }
}

// ─── Task response helpers ───────────────────────────────────────────────────

function extractTaskId(data) {
    const firstMsg = data.data?.messages?.[0];
    if (firstMsg?.extra?.wanx?.task_id) { return firstMsg.extra.wanx.task_id; }
    return data.id || data.task_id || data.response_id || data.data?.message_id || null;
}

function extractVideoUrl(taskData) {
    if (taskData.content) { return taskData.content; }
    if (typeof taskData.result === 'string') { return taskData.result; }
    if (taskData.result?.url) { return taskData.result.url; }
    if (taskData.result?.video_url) { return taskData.result.video_url; }
    return null;
}

export async function clearPagePool() {
    await pagePool.clear();
}

export function getAuthToken() {
    return authToken;
}

// ─── createChatV2 ────────────────────────────────────────────────────────────

export async function createChatV2(model = getDefaultModel(), title = 'Новый чат', retryCount = 0, chatType = 't2t', tokenObj = null) {
    const startTime = Date.now();
    const browserContext = getBrowserContext();
    if (!browserContext) { return { error: 'Браузер не инициализирован' }; }

    // Используем безопасный токен
    if (!tokenObj) {
        logDebug('⏱️ [createChatV2] Получение безопасного токена...');
        tokenObj = getSafeToken(TOKEN_EXPIRY_WARNING_MS);
    }

    if (tokenObj?.token) {
        authToken = tokenObj.token;
        logInfo(`🔑 [createChatV2] Используется аккаунт для создания чата: ${tokenObj.id}`);

        // Проверяем, не истекает ли токен
        const expiryInfo = checkTokenExpiry(tokenObj.id, TOKEN_EXPIRY_WARNING_MS);
        if (expiryInfo.willExpireSoon && (expiryInfo.isExpired || expiryInfo.isInvalid)) {
            logWarn(`Токен ${tokenObj.id} недействителен для создания чата, пробуем другой`);
            if (tokenObj.id !== 'browser') {
                markRateLimited(tokenObj.id, 1);
            }
            return await createChatV2(model, title, retryCount, chatType, tokenObj);
        }
    }

    if (!authToken) {
        logInfo('Получение токена авторизации для создания чата...');
        authToken = await extractAuthToken(browserContext);
        if (!authToken) { return { error: 'Не удалось получить токен авторизации' }; }
    }

    let page = null;
    try {
        logDebug('📄 [createChatV2] Запрос страницы из пула...');
        page = await pagePool.getPage(browserContext);
        logDebug('✅ [createChatV2] Страница получена');

        const payload = { title, models: [model], chat_mode: 'normal', chat_type: chatType, timestamp: Date.now() };
        const requestBody = { apiUrl: CREATE_CHAT_URL, payload, token: authToken };

        logDebug('🌐 [createChatV2] Выполнение page.evaluate для создания чата...');
        logDebug(`🌐 [createChatV2] API URL: ${CREATE_CHAT_URL}`);
        logDebug(`🌐 [createChatV2] Model: ${model}, Chat Type: ${chatType}`);
        logDebug(`🌐 [createChatV2] Payload: ${JSON.stringify(payload).substring(0, 200)}`);

        const result = await pageEvaluateWithScreencast(page, async (data) => {
            try {
                const response = await fetch(data.apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.token}` },
                    body: JSON.stringify(data.payload)
                });
                if (response.ok) { return { success: true, data: await response.json() }; }
                return { success: false, status: response.status, errorBody: await response.text() };
            } catch (error) {
                return { success: false, error: error.toString() };
            }
        }, requestBody);

        logDebug('✅ [createChatV2] page.evaluate завершён успешно');
        logDebug(`📊 [createChatV2] Результат: ${JSON.stringify(result).substring(0, 300)}`);

        pagePool.releasePage(page);
        page = null;

        const elapsed = Date.now() - startTime;
        logDebug(`⏱️ [createChatV2] Общее время выполнения: ${elapsed}ms`);

        if (result.success && result.data.success) {
            logInfo(`✅ [createChatV2] Чат создан: ${result.data.data.id} (за ${elapsed}ms)`);
            return { success: true, chatId: result.data.data.id, requestId: result.data.request_id };
        }

        const isTransient = result.status >= 500 && result.status < 600;
        if (isTransient && retryCount < MAX_RETRY_COUNT) {
            logWarn(`⚠️ [createChatV2] Создание чата: ${result.status}, ретрай ${retryCount + 1}/${MAX_RETRY_COUNT} через ${RETRY_DELAY}мс...`);
            await delay(RETRY_DELAY);
            return await createChatV2(model, title, retryCount + 1, chatType, tokenObj);
        }

        const cleanError = isTransient
            ? `Qwen API недоступен (${result.status}). Повторите позже.`
            : (result.errorBody || result.error || 'Неизвестная ошибка');
        logError(`❌ [createChatV2] Ошибка при создании чата: ${result.status || 'unknown'} (попытка ${retryCount + 1})`);
        logError(`❌ [createChatV2] Error details: ${cleanError.substring(0, 500)}`);
        return { error: cleanError };
    } catch (error) {
        const elapsed = Date.now() - startTime;
        logError(`❌ [createChatV2] Исключение при создании чата (после ${elapsed}ms)`, error);
        logError(`❌ [createChatV2] Error message: ${error.message}`);
        logError(`❌ [createChatV2] Error stack: ${error.stack}`);
        logError(`❌ [createChatV2] Error name: ${error.name}`);

        // Проверяем на Puppeteer protocol timeout - нужен перезапуск браузера
        if (error.message && error.message.includes('Runtime.callFunctionOn timed out')) {
            logError('⚠️ [createChatV2] Puppeteer protocol timeout - требуется перезапуск сервиса');
            logError(`⚠️ [createChatV2] Таймаут произошел после ${elapsed}ms`);
            logError('⚠️ [createChatV2] Это обычно происходит когда:');
            logError('   1. Браузер перегружен или завис');
            logError('   2. page.evaluate() выполняется слишком долго');
            logError('   3. Сетевой запрос внутри evaluate() таймаутит');
            logError('   4. Проблемы с памятью или CPU');
            logError('Завершение работы с кодом 42 для автоматического перезапуска...');
            process.exit(42);
        }

        return { error: error.toString() };
    } finally {
        if (page) {
            pagePool.releasePage(page);
        }
    }
}

// ─── testToken ───────────────────────────────────────────────────────────────

export async function testToken(token) {
    const browserContext = getBrowserContext();
    if (!browserContext) { return 'ERROR'; }

    let page;
    let shouldClosePage = false;
    try {
        page = await getPage(browserContext);
        shouldClosePage = page !== browserContext;
        await page.goto(CHAT_PAGE_URL, { waitUntil: 'domcontentloaded' });

        const requestBody = {
            apiUrl: CHAT_API_URL,
            token,
            payload: { chat_type: 't2t', messages: [{ role: 'user', content: 'ping', chat_type: 't2t' }], model: DEFAULT_MODEL, stream: false }
        };

        const result = await pageEvaluateWithScreencast(page, async (data) => {
            try {
                const res = await fetch(data.apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.token}` },
                    body: JSON.stringify(data.payload)
                });
                return { ok: res.ok, status: res.status };
            } catch (e) {
                return { ok: false, status: 0, error: e.toString() };
            }
        }, requestBody);

        if (result.ok || result.status === 400) { return 'OK'; }
        if (result.status === 401 || result.status === 403) { return 'UNAUTHORIZED'; }
        if (result.status === 429) { return 'RATELIMIT'; }
        return 'ERROR';
    } catch (e) {
        logError('testToken error', e);
        return 'ERROR';
    } finally {
        if (page) {
            try { if (shouldClosePage) { await page.close(); } } catch { }
        }
    }
}
