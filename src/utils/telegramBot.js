import { logInfo, logError, logWarn, logDebug } from '../logger/index.js';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_USER_IDS, SESSION_DIR, DEFAULT_MODEL, TELEGRAM_PROXY, TELEGRAM_PROXY_URL } from '../config.js';
import { getActiveModel as getBotSettingsModel } from './botSettings.js';
import { loadBotSettings, saveBotSettings, loadChatModels, setChatModel, getChatModel } from './botSettings.js';
import { fetchWithQwenProxy } from './proxy.js';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import AdmZip from 'adm-zip';
import { ProxyAgent } from 'undici';
import { loadTokens } from '../api/tokenManager.js';

// Use global fetch (available in Node 18+) instead of undici's fetch
const globalFetch = globalThis.fetch;


const execAsync = promisify(exec);

let botServer = null;
let isBotRunning = false;

// Хранилище контекста чатов для LLM
const chatContexts = new Map();

// Глобальная активная модель (загружается из файла)
let activeModel = null;

// Флаг включения LLM чата (загружается из файла)
let llmChatEnabled = false;

/**
 * Загружает сохраненные настройки при старте
 */
function loadPersistedSettings() {
    try {
        // Загружаем глобальные настройки
        const settings = loadBotSettings();
        if (settings.activeModel) {
            activeModel = settings.activeModel;
            logInfo(`📝 Загружена активная модель: ${activeModel}`);
        } else {
            logInfo('📝 Активная модель не установлена, используется модель по умолчанию');
        }
        llmChatEnabled = settings.llmChatEnabled || false;
        logInfo(`📝 LLM чат: ${llmChatEnabled ? 'включен' : 'выключен'}`);
    } catch (error) {
        logError('❌ Ошибка загрузки сохраненных настроек', error);
    }
}

/**
 * Проверяет есть ли аккаунты с токенами
 */
function hasAccounts() {
    const tokens = loadTokens();
    return tokens.length > 0;
}

/**
 * Проверяет работоспособность AI нейросети (единственный источник истины)
 * @param {Array} tokens - массив токенов
 * @returns {Promise<Array>} массив результатов проверки
 */
async function checkAIHealth(tokens) {
    // Если нет токенов - пропускаем
    if (!tokens || tokens.length === 0) {
        return [{
            name: '🧠 AI Нейросеть',
            status: false,
            details: '⏸️ Пропущено (нет токенов)'
        }];
    }

    try {
        logInfo('🧪 Тестирование AI нейросети (ping pong)...');

        // Импортируем функцию sendMessage для прямого запроса к Qwen
        const { sendMessage } = await import('../api/chat.js');
        const testModel = getBotSettingsModel();

        // Делаем запрос напрямую к Qwen API через наш модуль
        const startTime = Date.now();
        const result = await sendMessage('ping', testModel, null, null, null, null, null, null, 't2t', null, true, 0);
        const responseTime = ((Date.now() - startTime) / 1000).toFixed(2);

        if (result && !result.error) {
            const responseContent = result.choices?.[0]?.message?.content || '';
            const usedModel = result.model || testModel;

            // Проверяем что ответ содержит "pong" (в любом регистре)
            const hasPong = responseContent.toLowerCase().includes('pong');

            if (hasPong) {
                // Тест пройден - ответ содержит pong
                logInfo(`✅ AI тест прошел успешно: модель=${usedModel}, время=${responseTime}с, ответ="${responseContent.substring(0, 50)}"`);

                return [
                    {
                        name: '🧠 AI Нейросеть',
                        status: true,
                        details: `✅ Работает (модель: ${usedModel}, время: ${responseTime}с)`
                    },
                    {
                        name: '   📝 Ответ',
                        status: true,
                        details: `💬 "${responseContent.substring(0, 50)}${responseContent.length > 50 ? '...' : ''}"`
                    }
                ];
            } else {
                // Тест не пройден - ответ не содержит pong
                const fullResponse = JSON.stringify(result, null, 2);

                logError('❌ AI тест не пройден: ответ не содержит "pong"');
                logError(`Получен ответ: ${responseContent.substring(0, 200)}`);
                logDebug(`Полный JSON ответа: ${fullResponse.substring(0, 1000)}`);

                return [
                    {
                        name: '🧠 AI Нейросеть',
                        status: false,
                        details: '❌ Тест не пройден: ответ не содержит "pong"'
                    },
                    {
                        name: '   📝 Ответ',
                        status: false,
                        details: `⚠️ Получен ответ без "pong": "${responseContent.substring(0, 50)}${responseContent.length > 50 ? '...' : ''}"`
                    }
                ];
            }
        } else {
            // Ошибка от API
            const errorMsg = result.error || 'Unknown error';
            const fullResponse = JSON.stringify(result, null, 2);

            logError(`❌ AI тест не пройден: ${errorMsg}`);
            logDebug(`Полный JSON ошибки: ${fullResponse.substring(0, 1000)}`);

            return [{
                name: '🧠 AI Нейросеть',
                status: false,
                details: `❌ Ошибка: ${errorMsg.substring(0, 80)}`
            }];
        }
    } catch (error) {
        // Ошибка подключения
        logError('❌ AI тест не пройден (ошибка подключения)', error);

        return [{
            name: '🧠 AI Нейросеть',
            status: false,
            details: `❌ Ошибка подключения: ${error.message.substring(0, 80)}`
        }];
    }
}

// Создаем агент для прокси если настроен
let proxyAgent = null;
let proxyConfigured = false;

export async function configureProxy() {
    if (TELEGRAM_PROXY || TELEGRAM_PROXY_URL) {
        const proxyUrl = TELEGRAM_PROXY_URL || TELEGRAM_PROXY;
        proxyConfigured = true;
        logInfo('🔧 Telegram прокси настроен');
        logInfo(`📍 Прокси URL: ${proxyUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`); // СкрываемCredentials
        try {
            proxyAgent = new ProxyAgent(proxyUrl);
            logInfo('✅ Прокси агент создан успешно');

            // Тестируем соединение с прокси
            logInfo('🔍 Тестирование соединения с прокси...');
            const testUrl = 'https://api.telegram.org/bot';
            await globalFetch(testUrl, {
                dispatcher: proxyAgent,
                signal: AbortSignal.timeout(10000)
            });
            logInfo('✅ Соединение с прокси установлено');
        } catch (error) {
            logError('❌ Ошибка создания прокси агента', error);
        }
    }
}
/**
 * Обрабатывает ожидающий архив при запуске
 * @returns {Promise<boolean>} true если архив был обработан
 */
export async function processPendingArchive() {
    const archiveInfoPath = path.join(process.cwd(), '.pending_archive');

    // Проверяем есть ли ожидающий архив
    if (!fs.existsSync(archiveInfoPath)) {
        return false;
    }

    try {
        // Читаем информацию об архиве
        const archiveInfo = JSON.parse(fs.readFileSync(archiveInfoPath, 'utf8'));
        const { archivePath, fileName, ext, uploadedAt } = archiveInfo;

        logInfo('🔄 Обнаружен ожидающий архив для распаковки');
        logInfo(`📂 Архив: ${fileName}`);
        logInfo(`📍 Путь: ${archivePath}`);
        logInfo(`🕐 Загружен: ${uploadedAt}`);

        // Проверяем что архив существует
        if (!fs.existsSync(archivePath)) {
            logWarn(`⚠️ Архив не найден: ${archivePath}`);
            logWarn('🗑️ Возможно temp/ директория не сохранена в Docker volumes');
            fs.unlinkSync(archiveInfoPath);
            return false;
        }

        // Проверяем размер архива
        const archiveSize = fs.statSync(archivePath).size;
        logInfo(`📊 Размер архива: ${archiveSize} bytes (${(archiveSize / 1024).toFixed(2)} KB)`);

        if (archiveSize === 0) {
            logError('❌ Архив пустой (0 bytes)!');
            logError('🔄 Файл не был загружен из Telegram или был поврежден');
            logError('💡 Попробуйте отправить архив снова');
            fs.unlinkSync(archiveInfoPath);
            try {
                fs.unlinkSync(archivePath);
                logInfo('🗑️ Удален пустой архив');
            } catch (e) {
                // Игнорируем
            }
            return false;
        }

        if (archiveSize < 100) {
            logWarn(`⚠️ Архив очень маленький (${archiveSize} bytes). Возможно это не настоящий архив`);
        }

        // Распаковываем архив (без backup - это первый запуск)
        const sessionPath = path.join(process.cwd(), SESSION_DIR);

        logInfo('📦 Распаковка архива...');

        if (ext === '.zip') {
            await extractZip(archivePath, sessionPath, null);
        } else if (ext === '.7z') {
            await extract7z(archivePath, sessionPath, null);
        }

        logInfo('✅ Архив успешно распакован');

        // Удаляем флаг и архив
        try {
            fs.unlinkSync(archiveInfoPath);
            logInfo('🗑️ Удален флаг .pending_archive');
        } catch (e) {
            logWarn('Не удалось удалить флаг .pending_archive', e);
        }

        try {
            fs.unlinkSync(archivePath);
            logInfo('🗑️ Удален временный архив');
        } catch (e) {
            logWarn('Не удалось удалить временный архив', e);
        }

        return true;

    } catch (error) {
        logError('❌ Ошибка при обработке ожидающего архива', error);
        // Удаляем флаг чтобы не блокировать запуск
        try {
            fs.unlinkSync(archiveInfoPath);
        } catch (e) {
            // Игнорируем
        }
        return false;
    }
}

/**
 * Проверяет все подсистемы и отправляет отчет
 * @param {boolean} botStarted - запущен ли бот
 * @param {boolean} autoSend - автоматически отправлять отчет (по умолчанию true)
 * @returns {Promise<Array>} массив проверок
 */
export async function checkAllSubsystems(botStarted, autoSend = true) {
    const checks = [];
    let allOk = true;

    // 1. Проверяем папку session
    const sessionPath = path.join(process.cwd(), SESSION_DIR);
    const sessionExists = fs.existsSync(sessionPath);
    const sessionAccounts = sessionExists && fs.existsSync(path.join(sessionPath, 'accounts'))
        ? fs.readdirSync(path.join(sessionPath, 'accounts')).length
        : 0;

    checks.push({
        name: '📂 Session директория',
        status: sessionExists,
        details: sessionExists ? `✅ Найдено аккаунтов: ${sessionAccounts}` : '❌ Не найдена'
    });

    // 2. Проверяем токены
    const tokens = loadTokens();
    const now = Date.now();

    // Фильтруем только действительные токены (не invalid, не rate-limited, не истекшие, с cookies)
    const validTokens = tokens.filter((t) => {
        if (t.invalid) { return false; }
        if (t.resetAt && new Date(t.resetAt).getTime() > now) { return false; }
        if (t.expiryTime && t.expiryTime <= now) { return false; }
        // Проверяем наличие cookies.json
        const cookiesPath = path.join(process.cwd(), SESSION_DIR, 'accounts', t.id, 'cookies.json');
        if (!fs.existsSync(cookiesPath)) { return false; }
        return true;
    });

    // Проверка оставшегося времени для токенов
    if (tokens.length > 0) {
        const filteredCount = tokens.length - validTokens.length;

        const expirySummary = validTokens.reduce((acc, token) => {
            const now = Date.now();

            // Если expiryTime не установлен
            if (!token.expiryTime) {
                acc.tokens.push({ timeStr: 'Неизвестно', id: token.id, hasExpiry: false });
                return acc;
            }

            const timeLeft = token.expiryTime - now;

            // Форматируем время в удобочитаемый вид
            let timeStr;
            if (timeLeft <= 0) {
                acc.expired++;
                timeStr = 'Протух';
            } else {
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

                const parts = [];
                if (days > 0) { parts.push(`${days}д`); }
                if (hours > 0) { parts.push(`${hours}ч`); }
                if (minutes > 0) { parts.push(`${minutes}м`); }
                parts.push(`${seconds}с`);

                timeStr = parts.join(' ');
            }

            acc.tokens.push({ timeStr, id: token.id, hasExpiry: true });
            return acc;
        }, { expired: 0, tokens: [] });

        let tokenDetails = `✅ Доступно: ${validTokens.length}`;
        if (filteredCount > 0) {
            tokenDetails += ` (пропущено ${filteredCount} истекших)`;
        }

        checks.push({
            name: '🎫 Токены',
            status: validTokens.length > 0,
            details: tokenDetails
        });

        // Показываем только действительные токены
        if (expirySummary.tokens.length > 0) {
            expirySummary.tokens.forEach((token, index) => {
                // Проверяем наличие cookies
                const cookiesPath = path.join(process.cwd(), SESSION_DIR, 'accounts', token.id, 'cookies.json');
                const hasCookies = fs.existsSync(cookiesPath);
                const cookieStatus = hasCookies ? '✅' : '❌';

                checks.push({
                    name: `   Токен ${index + 1}`,
                    status: token.hasExpiry && hasCookies,
                    details: token.hasExpiry
                        ? `${cookieStatus} ${token.id}\n      ⏱️ Осталось: ${token.timeStr}`
                        : `${cookieStatus} ${token.id}\n      ⚠️ Время истечения: ${token.timeStr}`
                });
            });
        }

        // Если все токены истекли, показываем предупреждение
        if (validTokens.length === 0) {
            checks.push({
                name: '⚠️ Внимание',
                status: false,
                details: `Все ${tokens.length} токенов истекли. Создайте новые сессии.`
            });
        }
    } else {
        checks.push({
            name: '🎫 Токены',
            status: false,
            details: '❌ Нет токенов'
        });
    }

    // 3. Проверяем Telegram бота
    checks.push({
        name: '🤖 Telegram бот',
        status: botStarted,
        details: botStarted ? '✅ Работает' : '❌ Не запущен'
    });

    // 3.1. Показываем настройки бота (если загружены)
    if (botStarted) {
        const llmStatus = llmChatEnabled ? '✅ Включен' : '❌ Выключен';
        const modelUsed = activeModel || getBotSettingsModel();
        checks.push({
            name: '   ⚙️ LLM режим',
            status: llmChatEnabled,
            details: `${llmStatus} (модель: ${modelUsed})`
        });
    }

    // 4. Проверяем прокси
    checks.push({
        name: '🌐 Прокси',
        status: true,
        details: proxyConfigured
            ? '✅ Настроен'
            : 'Не используется'
    });

    // 5. Проверяем папку uploads
    const uploadsPath = path.join(process.cwd(), 'uploads');
    const uploadsExists = fs.existsSync(uploadsPath);
    checks.push({
        name: '📤 Uploads директория',
        status: uploadsExists,
        details: uploadsExists ? '✅ Доступна' : '❌ Не найдена'
    });

    // 6. Проверяем логи
    const logsPath = path.join(process.cwd(), 'logs');
    const logsExists = fs.existsSync(logsPath);
    checks.push({
        name: '📝 Логирование',
        status: logsExists,
        details: logsExists ? '✅ Работает' : '❌ Не настроено'
    });

    // 7. Проверяем p7zip
    try {
        await execAsync('which 7z');
        checks.push({
            name: '📦 p7zip',
            status: true,
            details: '✅ Установлен'
        });
    } catch (e) {
        checks.push({
            name: '📦 p7zip',
            status: false,
            details: '❌ Не установлен (7z архивы не будут работать)'
        });
        allOk = false;
    }

    // 8. Проверяем работу AI (только если есть токены)
    const aiCheckResult = await checkAIHealth(tokens);
    checks.push(...aiCheckResult);

    // Формируем отчет для логов
    logInfo('='.repeat(60));
    logInfo('🔍 ПРОВЕРКА ПОД СИСТЕМ ПРИ ЗАПУСКЕ');
    logInfo('='.repeat(60));

    checks.forEach((check) => {
        const status = check.status ? '✅' : '❌';
        logInfo(`${status} ${check.name}: ${check.details}`);
    });

    logInfo('='.repeat(60));

    const hasTokens = tokens.length > 0;
    if (hasTokens && allOk) {
        logInfo('✅ ВСЕ ПОД СИСТЕМЫ РАБОТАЮТ');
    } else if (!hasTokens) {
        logWarn('⚠️ ТОКЕНЫ ОТСУТСТВУЮТ - РЕЖИМ ОЖИДАНИЯ АРХИВА');
    } else {
        logWarn('⚠️ НЕКОТОРЫЕ ПОД СИСТЕМЫ НЕ РАБОТАЮТ');
    }
    logInfo('='.repeat(60));

    // Формируем отчет для Telegram с группировкой
    const reportLines = [];

    // Заголовок
    reportLines.push('🚀 <b>Сервис запущен!</b>\n');

    // Группа 1: Основные компоненты
    reportLines.push('<b>🔑 Основные компоненты:</b>');
    const mainComponents = checks.filter((c) =>
        c.name.includes('Session') || c.name.includes('Токены') || c.name.includes('Telegram') ||
        c.name.includes('Токен ') || c.name.includes('AI') || c.name.includes('Ответ')
    );
    mainComponents.forEach((check) => {
        reportLines.push(`${check.name}: ${check.details}`);
    });

    reportLines.push('');

    // Группа 2: Инфраструктура
    reportLines.push('<b>🏗️ Инфраструктура:</b>');
    const infrastructure = checks.filter((c) =>
        c.name.includes('Прокси') || c.name.includes('Uploads') || c.name.includes('Логирование')
    );
    infrastructure.forEach((check) => {
        reportLines.push(`${check.name}: ${check.details}`);
    });

    reportLines.push('');

    // Группа 3: Инструменты
    const tools = checks.filter((c) => c.name.includes('p7zip'));
    if (tools.length > 0) {
        reportLines.push('<b>🔧 Инструменты:</b>');
        tools.forEach((check) => {
            reportLines.push(`${check.name}: ${check.details}`);
        });
        reportLines.push('');
    }

    // Разделитель
    reportLines.push(`${'━'.repeat(25)}`);

    // Итоговый статус
    if (hasTokens && allOk) {
        reportLines.push('✅ <b>Все системы работают</b>');
    } else if (!hasTokens) {
        reportLines.push('⚠️ <b>Режим ожидания архива</b>');
        reportLines.push('📦 Отправьте архив с сессиями');
    } else {
        reportLines.push('⚠️ <b>Есть проблемы</b>');
    }

    // Ссылки
    reportLines.push(`\n🌐 API: http://localhost:${process.env.PORT || 3264}`);
    reportLines.push(`📖 Docs: http://localhost:${process.env.PORT || 3264}/api`);

    // Репозиторий
    reportLines.push('\n📚 <b>Репозиторий:</b>');
    reportLines.push('🔗 GitHub: https://github.com/EndyKaufman/FreeQwenApi');
    reportLines.push('⭐ Оригинал: https://github.com/y1n7sint/FreeQwenApi');
    reportLines.push('🐳 Docker: https://hub.docker.com/r/endykaufman/qwen-api-proxy');

    // Справка
    reportLines.push('\n💡 <b>Справка:</b>');
    reportLines.push('📝 Используйте /help для списка команд');
    reportLines.push('🔍 Используйте /status для проверки состояния');
    reportLines.push('🤖 Используйте /chat для включения LLM режима');

    const report = reportLines.join('\n');

    // Отправляем всем пользователям (только если autoSend = true)
    if (autoSend && botStarted) {
        try {
            await notifyAllUsers(report);
            logInfo('📤 Отчет о запуске отправлен в Telegram');
        } catch (e) {
            logError('❌ Не удалось отправить отчет в Telegram', e);
        }
    }

    // Возвращаем массив проверок для повторного использования
    return checks;
}

/**
 * Выполняет fetch запрос с учетом прокси
 */
async function fetchWithProxy(url, options = {}, skipLog = false) {
    const fetchOptions = {
        ...options
    };

    // Добавляем прокси агент только если он существует
    if (proxyAgent) {
        fetchOptions.dispatcher = proxyAgent;
        if (proxyConfigured && !skipLog) {
            logInfo('🌐 Запрос через прокси...');
        }
    }

    fetchOptions.timeout = 30000; // 30 секунд таймаут

    return fetch(url, fetchOptions);
}

/**
 * Запускает Telegram бота для получения команд и файлов
 */
export async function startTelegramBot() {
    if (!TELEGRAM_BOT_TOKEN) {
        logWarn('Telegram бот не запущен: отсутствует TELEGRAM_BOT_TOKEN');
        return false;
    }

    if (isBotRunning) {
        logWarn('Telegram бот уже запущен');
        return true;
    }

    try {
        logInfo('🤖 Запуск Telegram бота...');

        // Загружаем сохраненные настройки
        loadPersistedSettings();

        // Проверяем доступность API Telegram
        const testUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`;
        const response = await fetchWithProxy(testUrl);

        if (!response.ok) {
            logError(`❌ Не удалось подключиться к Telegram API: HTTP ${response.status}`);
            return false;
        }

        const botInfo = await response.json();
        logInfo(`✅ Telegram бот запущен: @${botInfo.result.username}`);

        isBotRunning = true;

        // Запускаем polling для получения обновлений
        startPolling();

        return true;
    } catch (error) {
        // Определяем тип ошибки для лучшего сообщения
        let errorMessage = 'Ошибка при запуске Telegram бота';

        if (error.message?.includes('fetch failed') || error.code === 'ECONNREFUSED') {
            if (proxyAgent) {
                errorMessage = '❌ Не удалось подключиться к Telegram API через прокси. Проверьте настройки прокси.';
            } else {
                errorMessage = '❌ Не удалось подключиться к Telegram API. Если API заблокирован, настройте прокси через TELEGRAM_PROXY.';
            }
        } else if (error.message?.includes('ENOTFOUND') || error.code === 'ENOTFOUND') {
            errorMessage = '❌ Ошибка DNS. Проверьте интернет-соединение.';
        } else if (error.message?.includes('ETIMEDOUT') || error.code === 'ETIMEDOUT') {
            errorMessage = '❌ Таймаут подключения. Проверьте соединение и настройки прокси.';
        }

        logError(errorMessage, error);
        return false;
    }
}

/**
 * Останавливает Telegram бота
 */
export function stopTelegramBot() {
    if (botServer) {
        isBotRunning = false;
        logInfo('🛑 Telegram бот остановлен');
    }
}

/**
 * Запускает polling для получения обновлений от Telegram
 */
async function startPolling() {
    // Загружаем последний обработанный update_id
    const lastUpdatePath = path.join(process.cwd(), '.last_telegram_update');
    let offset = 0;

    if (fs.existsSync(lastUpdatePath)) {
        try {
            const lastUpdateId = parseInt(fs.readFileSync(lastUpdatePath, 'utf8'));
            offset = lastUpdateId + 1;
            logInfo(`📡 Продолжаем polling с update_id: ${offset}`);
        } catch (e) {
            logWarn('Не удалось прочитать .last_telegram_update, начинаем с 0');
        }
    }

    while (isBotRunning) {
        try {
            const updatesUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&limit=10&timeout=30`;
            const response = await fetchWithProxy(updatesUrl, undefined, true);

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                logError(`Ошибка получения обновлений Telegram: HTTP ${response.status}${errorText ? ` | Ответ: ${errorText.substring(0, 500)}` : ''}`);
                await new Promise((resolve) => setTimeout(resolve, 5000));
                continue;
            }

            const data = await response.json();

            if (data.ok && data.result.length > 0) {
                for (const update of data.result) {
                    offset = update.update_id + 1;

                    // Сохраняем последний обработанный update_id
                    try {
                        fs.writeFileSync(lastUpdatePath, String(update.update_id));
                    } catch (e) {
                        // Игнорируем ошибки записи
                    }

                    await processUpdate(update);
                }
            }
        } catch (error) {
            logError('Ошибка в polling Telegram', error);
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
}

/**
 * Обрабатывает обновление от Telegram
 */
async function processUpdate(update) {
    // Обработка сообщений
    if (update.message) {
        const message = update.message;
        const chatId = message.chat.id;

        // Проверяем, что пользователь авторизован
        if (!TELEGRAM_USER_IDS.includes(String(chatId))) {
            await sendMessage(chatId, '❌ У вас нет доступа к этому боту');
            return;
        }

        // Обработка команд
        if (message.text) {
            // Если включен LLM чат и это не команда
            if (llmChatEnabled && !message.text.startsWith('/')) {
                // Проверяем есть ли аккаунты для LLM
                if (hasAccounts()) {
                    await handleLLMChat(chatId, message.text);
                } else {
                    await sendMessage(chatId,
                        '❌ <b>LLM чат временно недоступен</b>\n\n' +
                        '🔒 Нет аккаунтов для обработки запросов\n' +
                        '📦 Отправьте архив с сессиями\n' +
                        '💡 Или используйте /chat чтобы выключить LLM режим'
                    );
                }
                return;
            }

            await handleCommand(chatId, message.text);
        }

        // Обработка файлов (документов)
        if (message.document) {
            try {
                await handleDocument(chatId, message.document);
            } catch (error) {
                logError('❌ Ошибка обработки документа', error);
                try {
                    await sendMessage(chatId, `❌ Ошибка обработки файла: ${error.message}`);
                } catch (sendError) {
                    // Игнорируем ошибки отправки
                }
            }
        }

        // Обработка фотографий (для генерации изображений)
        if (message.photo) {
            try {
                // Получаем текст из caption
                const caption = message.caption || '';
                await handlePhoto(chatId, message.photo, caption);
            } catch (error) {
                logError('❌ Ошибка обработки фото', error);
                try {
                    await sendMessage(chatId, `❌ Ошибка обработки фото: ${error.message}`);
                } catch (sendError) {
                    // Игнорируем ошибки отправки
                }
            }
        }
    }
}

/**
 * Обрабатывает генерацию изображений
 * @param {string} chatId - ID чата
 * @param {string} prompt - Текст запроса
 * @param {string} imagePath - Путь к файлу изображения (опционально, для image-to-image)
 */
async function handleImageGeneration(chatId, prompt, imagePath = null) {
    try {
        logInfo(`🎨 Telegram: запрошена генерация изображения: ${prompt.substring(0, 100)}...`);
        if (imagePath) {
            logInfo(`📸 Режим image-to-image с файлом: ${imagePath}`);
        }

        // Отправляем сообщение о начале генерации
        await sendMessage(chatId,
            '🎨 <b>Генерация изображения...</b>\n\n' +
            `📝 Запрос: ${prompt}\n` +
            (imagePath ? '📸 Режим: Image-to-Image\n' : '') +
            '⏳ Пожалуйста, подождите...'
        );

        // Импортируем функцию генерации
        const { generateImage } = await import('../api/imageGeneration.js');
        const { getActiveModel } = await import('./botSettings.js');

        // Используем модель для генерации изображений
        const model = 'qwen-image-plus';

        const startTime = Date.now();
        const options = {
            size: '1024*1024'
        };

        // Если есть изображение, передаем путь к файлу
        if (imagePath) {
            options.imagePath = imagePath;
        }

        const result = await generateImage(prompt, model, options);
        const generationTime = ((Date.now() - startTime) / 1000).toFixed(1);

        if (result.success && result.imageUrl) {
            logInfo(`✅ Изображение сгенерировано за ${generationTime}с: ${result.imageUrl}`);

            // Отправляем изображение как фото
            try {
                await sendPhoto(chatId, result.imageUrl, prompt);

                // Отправляем дополнительную информацию
                await sendMessage(chatId,
                    '✅ <b>Изображение сгенерировано!</b>\n\n' +
                    `🎨 Модель: ${result.model || model}\n` +
                    `⏱️ Время: ${generationTime}с\n` +
                    `📝 Prompt: ${prompt}`
                );
            } catch (photoError) {
                // Если не удалось отправить как фото, отправляем как ссылку
                logWarn('Не удалось отправить изображение как фото, отправляю ссылку');
                await sendMessage(chatId,
                    '✅ <b>Изображение сгенерировано!</b>\n\n' +
                    `🖼️ <a href="${result.imageUrl}">Скачать изображение</a>\n\n` +
                    `🎨 Модель: ${result.model || model}\n` +
                    `⏱️ Время: ${generationTime}с\n` +
                    `📝 Prompt: ${prompt}`
                );
            }
        } else {
            logError(`❌ Ошибка генерации изображения: ${result.error}`);

            // Проверяем, это rate limit?
            if (result.rateLimit) {
                const hours = result.rateLimitHours || 24;
                await sendMessage(chatId,
                    '⏳ <b>Лимит генерации изображений достигнут</b>\n\n' +
                    '⚠️ API Qwen ограничивает количество генераций в день\n' +
                    `⏰ Попробуйте через ${hours}ч\n\n` +
                    '💡 Совет: используйте другой аккаунт с токеном\n' +
                    '📝 Или подождите сброса лимита'
                );
                return;
            }

            // Формируем детальное сообщение об ошибке
            let errorMessage = result.error || 'Неизвестная ошибка';

            // Если есть дополнительные детали в rawResponse
            if (result.rawResponse) {
                // Проверяем errorBody (JSON строка)
                if (result.rawResponse.errorBody) {
                    try {
                        const errorData = JSON.parse(result.rawResponse.errorBody);
                        if (errorData.error && errorData.error.details) {
                            errorMessage += `\n\n📋 Детали: ${errorData.error.details}`;
                            if (errorData.error.modality) {
                                errorMessage += `\n🔍 Проверка: ${errorData.error.modality.join(', ')}`;
                            }
                            if (errorData.error.stage) {
                                errorMessage += `\n📍 Этап: ${errorData.error.stage}`;
                            }
                        } else if (errorData.details || errorData.detail) {
                            errorMessage += `\n\n📋 Детали: ${errorData.details || errorData.detail}`;
                        }
                    } catch {
                        // Не JSON, используем как есть
                        if (result.rawResponse.errorBody.length < 200) {
                            errorMessage += `\n\n📋 ${result.rawResponse.errorBody}`;
                        }
                    }
                }
                // Проверяем details (JSON строка из handleApiError)
                else if (result.rawResponse.details && typeof result.rawResponse.details === 'string') {
                    try {
                        const errorData = JSON.parse(result.rawResponse.details);
                        if (errorData.error && errorData.error.details) {
                            errorMessage += `\n\n📋 Детали: ${errorData.error.details}`;
                            if (errorData.error.modality) {
                                errorMessage += `\n🔍 Проверка: ${errorData.error.modality.join(', ')}`;
                            }
                            if (errorData.error.stage) {
                                errorMessage += `\n📍 Этап: ${errorData.error.stage}`;
                            }
                        } else if (errorData.details || errorData.detail) {
                            errorMessage += `\n\n📋 Детали: ${errorData.details || errorData.detail}`;
                        }
                    } catch {
                        // Не JSON, используем как есть
                        if (result.rawResponse.details.length < 200) {
                            errorMessage += `\n\n📋 ${result.rawResponse.details}`;
                        }
                    }
                }
                // Проверяем прямое поле error
                else if (result.rawResponse.error && result.rawResponse.error.details) {
                    errorMessage += `\n\n📋 Детали: ${result.rawResponse.error.details}`;
                    if (result.rawResponse.error.modality) {
                        errorMessage += `\n🔍 Проверка: ${result.rawResponse.error.modality.join(', ')}`;
                    }
                }
            }

            await sendMessage(chatId,
                '❌ <b>Ошибка генерации изображения</b>\n\n' +
                `⚠️ ${escapeHtml(errorMessage)}\n\n` +
                '💡 Попробуйте изменить запрос или повторите позже'
            );
        }
    } catch (error) {
        logError('❌ Ошибка в handleImageGeneration', error);
        await sendMessage(chatId,
            '❌ <b>Произошла ошибка</b>\n\n' +
            `⚠️ ${error.message}\n\n` +
            '💡 Попробуйте позже'
        );
    }
}

/**
 * Отправляет фото в Telegram
 */
async function sendPhoto(chatId, photoUrl, caption = '') {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;

        const body = {
            chat_id: chatId,
            photo: photoUrl,
            caption: caption.substring(0, 1024) // Telegram limit for captions
        };

        const response = await fetchWithProxy(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }, true);

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            let errorDescription = `HTTP ${response.status}`;
            try {
                const errorData = JSON.parse(errorText);
                errorDescription = errorData.description || errorDescription;
            } catch {
                // Если не JSON, используем текст ответа
                if (errorText) {
                    errorDescription = errorText.substring(0, 500);
                }
            }
            throw new Error(errorDescription);
        }

        logDebug(`📸 Фото отправлено: ${photoUrl}`);
        return true;
    } catch (error) {
        logError('Ошибка при отправке фото', error);
        throw error;
    }
}

/**
 * Обрабатывает команды
 */
async function handleCommand(chatId, text) {
    const command = text.trim().toLowerCase();

    // Обработка команды /setmodel с аргументом
    if (command.startsWith('/setmodel')) {
        await handleSetModel(chatId, text);
        return;
    }

    switch (command) {
    case '/start':
    case '/help':
        await sendHelpMessage(chatId);
        break;

    case '/status':
        await sendStatusMessage(chatId);
        break;

    case '/restart':
        await handleRestart(chatId);
        break;

    case '/chat':
        await showLLMChatStatus(chatId);
        break;

    case '/togglechat':
        await toggleLLMChat(chatId);
        break;

    case '/model':
        await showModelInfo(chatId);
        break;

    case '/setmodel':
        await showModelInfo(chatId);
        break;

    case '/clear':
        await clearChatContext(chatId);
        break;

    case '/setup':
        await sendSetupMessage(chatId);
        break;

    case '/connect':
        await sendConnectMessage(chatId);
        break;

    case '/about':
        await sendAboutMessage(chatId);
        break;

    case '/archive':
        await sendArchiveInstructions(chatId);
        break;

    case '/extend':
        // 🔧 ВРЕМЕННО ОТКЛЮЧЕНО
        await sendMessage(chatId,
            '🔧 <b>Команда /extend временно отключена</b>\n\n' +
                'Функция продления сессий находится на техническом обслуживании.\n\n' +
                '📦 <b>Что делать:</b>\n' +
                '1. Создайте новую сессию: <code>npm run create-session-archive</code>\n' +
                '2. Отправьте архив через бота\n\n' +
                '⏳ Функция будет доступна в ближайшее время.'
        );
        break;

    case '/image':
    case '/imagine':
        await sendMessage(chatId,
            '🎨 <b>Генерация изображений</b>\n\n' +
                '💬 <b>Текстовый режим:</b>\n' +
                '/image &lt;описание&gt; - генерация по описанию\n\n' +
                '📸 <b>Режим Image-to-Image:</b>\n' +
                'Отправьте фото с подписью (caption)\n' +
                'Или используйте /image &lt;описание&gt; с фото\n\n' +
                '📝 Примеры:\n' +
                '• /image A beautiful sunset\n' +
                '• Отправьте фото с текстом "Улучши это"'
        );
        break;

    default:
        // Проверяем, начинается ли сообщение с /image или /imagine с аргументами
        if (text.startsWith('/image ') || text.startsWith('/imagine ')) {
            const prompt = text.substring(text.indexOf(' ') + 1).trim();
            if (prompt) {
                await handleImageGeneration(chatId, prompt);
            } else {
                await sendMessage(chatId, '🎨 Пожалуйста, укажите описание изображения\n\nПример: /image A beautiful sunset over the ocean');
            }
        } else {
            await sendMessage(chatId, '❓ Неизвестная команда. Используйте /help для списка команд');
        }
    }
}

/**
 * Обрабатывает фотографии для генерации изображений (image-to-image)
 */
async function handlePhoto(chatId, photos, caption = '') {
    try {
        logInfo(`📸 Получено фото с caption: "${caption.substring(0, 50)}${caption.length > 50 ? '...' : ''}"`);

        // Проверяем, есть ли команда в caption
        let prompt = caption || 'Улучши это изображение';
        let hasCommand = false;

        // Если caption начинается с /image или /imagine
        if (caption.startsWith('/image ') || caption.startsWith('/imagine ')) {
            hasCommand = true;
            prompt = caption.substring(caption.indexOf(' ') + 1).trim();
        }

        if (!hasCommand && !caption) {
            // Если просто фото без caption - не обрабатываем как image-to-image
            logInfo('📸 Фото без caption - пропускаем обработку');
            return;
        }

        // Telegram отправляет несколько размеров фото, берем самый большой (последний в массиве)
        const photo = photos[photos.length - 1];
        const fileId = photo.file_id;
        const fileSize = photo.file_size;

        logInfo(`📸 Загрузка фото из Telegram (file_id: ${fileId}, size: ${fileSize} bytes)`);

        await sendMessage(chatId,
            '🎨 <b>Обработка изображения...</b>\n\n' +
            `📝 Запрос: ${prompt}\n` +
            '⏳ Пожалуйста, подождите...'
        );

        // Скачиваем фото из Telegram и сохраняем во временный файл
        const tempFilePath = await downloadTelegramFileToTemp(fileId);

        if (!tempFilePath) {
            throw new Error('Не удалось скачать фото из Telegram');
        }

        logInfo(`✅ Фото скачано: ${tempFilePath}`);

        // Генерируем изображение с использованием фото
        await handleImageGeneration(chatId, prompt, tempFilePath);

        // Удаляем временный файл
        try {
            fs.unlinkSync(tempFilePath);
            logInfo('🗑️ Временный файл удален');
        } catch (e) {
            logWarn('Не удалось удалить временный файл', e);
        }

    } catch (error) {
        logError('❌ Ошибка в handlePhoto', error);
        await sendMessage(chatId,
            '❌ <b>Ошибка обработки фото</b>\n\n' +
            `⚠️ ${error.message}\n\n` +
            '💡 Попробуйте позже'
        );
    }
}

/**
 * Скачивает файл из Telegram и сохраняет во временный файл
 * @param {string} fileId - ID файла в Telegram
 * @returns {Promise<string>} - Путь к временному файлу
 */
async function downloadTelegramFileToTemp(fileId) {
    try {
        // Получаем информацию о файле
        const fileUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`;
        const fileResponse = await fetchWithProxy(fileUrl, undefined, true);

        if (!fileResponse.ok) {
            throw new Error(`Не удалось получить информацию о файле: HTTP ${fileResponse.status}`);
        }

        const fileData = await fileResponse.json();

        if (!fileData.ok) {
            throw new Error(`Telegram API error: ${fileData.description || 'Unknown error'}`);
        }

        const filePath = fileData.result.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;

        logInfo(`📥 URL для скачивания файла: ${downloadUrl}`);

        // Скачиваем файл
        const downloadResponse = await fetchWithProxy(downloadUrl, undefined, true);

        if (!downloadResponse.ok) {
            throw new Error(`Не удалось скачать файл: HTTP ${downloadResponse.status}`);
        }

        // Сохраняем во временный файл
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFileName = `telegram_${Date.now()}_${fileId}.jpg`;
        const tempFilePath = path.join(tempDir, tempFileName);

        const buffer = Buffer.from(await downloadResponse.arrayBuffer());
        fs.writeFileSync(tempFilePath, buffer);

        logInfo(`✅ Файл сохранен: ${tempFilePath} (${buffer.length} bytes)`);

        return tempFilePath;

    } catch (error) {
        logError('❌ Ошибка скачивания файла из Telegram', error);
        throw error;
    }
}

/**
 * Обрабатывает полученные документы (архивы)
 */
async function handleDocument(chatId, document) {
    const fileName = document.file_name || 'unknown';
    const fileSize = document.file_size;
    const fileId = document.file_id;

    logInfo(`📦 Получен файл: ${fileName} (${fileSize} bytes)`);

    // Проверяем расширение файла
    const allowedExtensions = ['.zip', '.7z'];
    const ext = path.extname(fileName).toLowerCase();

    if (!allowedExtensions.includes(ext)) {
        await sendMessage(chatId,
            `❌ Неподдерживаемый формат файла: ${ext}\n` +
            '📎 Поддерживаются только: .zip и .7z'
        );
        return;
    }

    // Проверяем размер файла (максимум 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (fileSize > maxSize) {
        await sendMessage(chatId,
            `❌ Файл слишком большой: ${(fileSize / 1024 / 1024).toFixed(2)}MB\n` +
            '📏 Максимальный размер: 50MB'
        );
        return;
    }

    // Проверяем есть ли уже ожидающий архив с таким же именем
    const archiveInfoPath = path.join(process.cwd(), '.pending_archive');
    if (fs.existsSync(archiveInfoPath)) {
        try {
            const existingArchive = JSON.parse(fs.readFileSync(archiveInfoPath, 'utf8'));
            if (existingArchive.fileName === fileName) {
                logInfo(`⚠️ Архив ${fileName} уже ожидает распаковки, перезапускаем`);
                await sendMessage(chatId,
                    `✅ Архив ${fileName} уже загружен\n` +
                    '🔄 Перезапуск для распаковки...'
                );
                // Запускаем перезапуск
                await gracefulRestart(chatId);
                return;
            }
        } catch (e) {
            // Игнорируем ошибку чтения
        }
    }

    // Проверяем существует ли уже файл в temp (по оригинальному имени)
    const tempDir = path.join(process.cwd(), 'temp');
    const existingFiles = fs.existsSync(tempDir) ? fs.readdirSync(tempDir) : [];
    const existingFile = existingFiles.find((f) => f.endsWith(`_${fileName}`) || f === fileName);

    if (existingFile) {
        const tempFilePath = path.join(tempDir, existingFile);
        logInfo(`⚠️ Файл ${tempFilePath} уже существует, используем его`);

        // Создаем флаг для существующего архива
        if (!fs.existsSync(archiveInfoPath)) {
            fs.writeFileSync(archiveInfoPath, JSON.stringify({
                archivePath: tempFilePath,
                fileName: fileName,
                ext: ext,
                uploadedAt: new Date().toISOString()
            }));
            logInfo('📝 Создан флаг для существующего архива');

            // Запускаем перезапуск
            await gracefulRestart(chatId);
        } else {
            await sendMessage(chatId,
                '✅ Архив уже загружен и ожидает распаковки\n' +
                '🔄 Сервис будет перезапущен...'
            );
            // Запускаем перезапуск
            await gracefulRestart(chatId);
        }
        return;
    }

    await sendMessage(chatId, `⏳ Загрузка файла ${fileName}...`);

    try {
        // Получаем информацию о файле из Telegram
        const fileUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`;
        logInfo(`📡 Запрос информации о файле: ${fileId}`);

        const fileResponse = await fetchWithProxy(fileUrl);
        logInfo(`📥 Статус ответа: ${fileResponse.status}`);

        const fileData = await fileResponse.json();
        logInfo(`📄 Получены данные: ${JSON.stringify(fileData).substring(0, 200)}...`);

        if (!fileData.ok) {
            throw new Error(`Не удалось получить файл из Telegram: ${fileData.description || 'Unknown error'}`);
        }

        const filePath = fileData.result.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;

        logInfo(`📥 URL для скачивания: ${downloadUrl}`);
        logInfo(`📊 Ожидаемый размер (из Telegram): ${fileData.result.file_size || 'unknown'} bytes`);

        // Скачиваем файл
        logInfo('📥 Начинаем загрузку файла...');
        const downloadResponse = await fetchWithProxy(downloadUrl);
        logInfo(`📥 Статус загрузки: ${downloadResponse.status}`);
        logInfo(`📥 Content-Type: ${downloadResponse.headers.get('content-type')}`);
        logInfo(`📥 Content-Length: ${downloadResponse.headers.get('content-length')}`);

        const fileBuffer = await downloadResponse.arrayBuffer();

        // Проверяем размер файла
        const fileSize = Buffer.from(fileBuffer).length;
        logInfo(`📥 Загружено ${fileSize} bytes из Telegram`);

        if (fileSize === 0) {
            logError('❌ Загружен пустой файл!');
            logError(`📡 Статус ответа: ${downloadResponse.status}`);
            logError(`📊 Content-Length header: ${downloadResponse.headers.get('content-length')}`);
            logError(`🔗 URL: ${downloadUrl}`);
            throw new Error('Файл пустой или не удалось загрузить из Telegram. Проверьте что файл существует в Telegram');
        }

        if (fileSize < 100) {
            logWarn(`⚠️ Файл очень маленький (${fileSize} bytes). Возможно это не настоящий архив`);
        }

        // Создаем директорию temp
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Генерируем уникальное имя файла с префиксом
        const uniquePrefix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const uniqueFileName = `${uniquePrefix}_${fileName}`;
        const tempFilePath = path.join(tempDir, uniqueFileName);

        // Удаляем старые файлы с таким же именем (если есть)
        const oldFiles = existingFiles.filter((f) => f.endsWith(`_${fileName}`) || f === fileName);
        if (oldFiles.length > 0) {
            logInfo(`🗑️ Найдено ${oldFiles.length} старых файлов с именем ${fileName}, удаляем`);
            oldFiles.forEach((oldFile) => {
                try {
                    fs.unlinkSync(path.join(tempDir, oldFile));
                    logInfo(`🗑️ Удален старый файл: ${oldFile}`);
                } catch (e) {
                    logWarn(`⚠️ Не удалось удалить ${oldFile}:`, e.message);
                }
            });
        }

        // Сохраняем временный файл
        fs.writeFileSync(tempFilePath, Buffer.from(fileBuffer));

        // Проверяем что файл записался
        const writtenSize = fs.statSync(tempFilePath).size;
        logInfo(`💾 Файл сохранен: ${writtenSize} bytes`);
        logInfo(`📝 Уникальное имя: ${uniqueFileName}`);

        if (writtenSize !== fileSize) {
            throw new Error(`Ошибка записи файла: ожидалось ${fileSize} bytes, записано ${writtenSize} bytes`);
        }

        logInfo(`✅ Файл сохранен: ${tempFilePath}`);
        await sendMessage(chatId, '✅ Файл загружен. Распаковка...');

        // Сохраняем информацию об архиве для обработки при перезапуске
        fs.writeFileSync(archiveInfoPath, JSON.stringify({
            archivePath: tempFilePath,
            fileName: fileName,
            ext: ext,
            uploadedAt: new Date().toISOString()
        }));

        logInfo(`📝 Записан флаг ожидающего архива: ${archiveInfoPath}`);
        await sendMessage(chatId,
            '✅ Архив сохранен\n' +
            '🔄 При перезапуске будет автоматически распакован\n' +
            `📂 Файл: ${tempFilePath}`
        );

        // Запускаем перезапуск
        await gracefulRestart(chatId);

    } catch (error) {
        logError('Ошибка при обработке файла', error);
        await sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
}

/**
 * Создает session_backup текущей папки session
 * @returns {boolean} true если backup успешен или не нужен, false если ошибка
 */
async function createSessionBackup(sessionPath, chatId) {
    try {
        if (!fs.existsSync(sessionPath)) {
            logInfo('📦 Session папка не существует, session_backup не нужен');
            return true; // Backup не нужен, продолжаем
        }

        // Создаем имя папки session_backup с датой и временем
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-mm-ss
        const backupDir = path.join(process.cwd(), 'session_backup', timestamp);

        logInfo(`📦 Создание session_backup session в: ${backupDir}`);

        // Создаем директорию session_backup
        try {
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
        } catch (mkdirError) {
            logWarn(`⚠️ Не удалось создать папку session_backup: ${mkdirError.message}`);
            logWarn('⛔ session_backup отменен - СЕРВЕР НЕ БУДЕТ ПЕРЕЗАПУЩЕН');
            try {
                await sendMessage(chatId,
                    '❌ Ошибка session_backup: нет прав для создания папки\n' +
                    '⛔ Распаковка продолжена, но сервер НЕ будет перезапущен\n' +
                    '💡 Перезапустите сервер вручную после проверки файлов'
                );
            } catch (sendError) {
                // Игнорируем
            }
            return false; // Backup не удался, НЕ перезапускаем сервер
        }

        // Копируем все файлы и папки из session в session_backup
        const items = fs.readdirSync(sessionPath);

        if (items.length === 0) {
            logInfo('📦 Session папка пуста, session_backup не нужен');
            return;
        }

        try {
            await sendMessage(chatId,
                '💾 Создание session_backup текущей session...\n' +
                `📁 Найдено элементов: ${items.length}`
            );
        } catch (sendError) {
            logWarn(`⚠️ Не удалось отправить сообщение о backup: ${sendError.message}`);
        }

        for (const item of items) {
            try {
                const sourcePath = path.join(sessionPath, item);
                const targetPath = path.join(backupDir, item);

                if (fs.statSync(sourcePath).isDirectory()) {
                    // Копируем директорию рекурсивно
                    await execAsync(`cp -rf "${sourcePath}" "${targetPath}" 2>&1 || true`);
                } else {
                    // Копируем файл
                    fs.copyFileSync(sourcePath, targetPath);
                }
            } catch (copyError) {
                logWarn(`⚠️ Ошибка копирования ${item}: ${copyError.message}`);
                // Продолжаем копировать остальные файлы
            }
        }

        logInfo(`✅ session_backup успешно создан: ${backupDir}`);
        try {
            await sendMessage(chatId, `✅ session_backup создан: <code>session_backup/${timestamp}</code>`);
        } catch (sendError) {
            // Игнорируем ошибки отправки сообщений
        }

        return true; // Backup успешен

    } catch (error) {
        // Полностью подавляем все ошибки - backup не должен ломать процесс
        logWarn(`⚠️ session_backup пропущен: ${error.message}`);
        logWarn('⛔ session_backup отменен - СЕРВЕР НЕ БУДЕТ ПЕРЕЗАПУЩЕН');
        try {
            await sendMessage(chatId,
                `❌ Ошибка session_backup: ${error.message}\n` +
                '⛔ Распаковка продолжена, но сервер НЕ будет перезапущен\n' +
                '💡 Перезапустите сервер вручную после проверки файлов'
            );
        } catch (sendError) {
            // Игнорируем
        }
        return false; // Ошибка, НЕ перезапускаем сервер
    }
}

/**
 * Распаковывает архив в папку session
 */
async function extractArchive(filePath, chatId, ext) {
    const sessionPath = path.join(process.cwd(), SESSION_DIR);

    try {
        // Создаем session_backup текущей session папки
        const backupSuccess = await createSessionBackup(sessionPath, chatId);

        // Если backup не удался, не продолжаем распаковку и НЕ перезапускаем сервер
        if (!backupSuccess) {
            logWarn('⛔ Распаковка отменена из-за ошибки backup');
            await sendMessage(chatId,
                '⚠️ <b>Распаковка отменена</b>\n\n' +
                '❌ Не удалось создать backup текущей session\n' +
                '🔒 Файлы не были изменены для безопасности\n' +
                '💡 Проверьте права доступа и попробуйте снова'
            );
            return; // Выходим без перезапуска
        }

        let result;
        if (ext === '.zip') {
            result = await extractZip(filePath, sessionPath, chatId);
        } else if (ext === '.7z') {
            await extract7z(filePath, sessionPath, chatId);
            result = { successCount: 'все', errorCount: 0 };
        }

        let statusMessage =
            '✅ <b>Архив успешно распакован!</b>\n\n' +
            '📂 Папка session обновлена\n' +
            '💾 Старая версия сохранена в session_backup\n';

        if (result && result.successCount !== 'все') {
            statusMessage += `📊 Распаковано: ${result.successCount} файлов\n`;
            if (result.errorCount > 0) {
                statusMessage += `⚠️ Ошибок: ${result.errorCount} (пропущены)\n`;
            }
        }

        statusMessage += '🔄 Сервис будет перезапущен...';

        await sendMessage(chatId, statusMessage);

        // Ждем 2 секунды чтобы сообщение дошло
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Запускаем перезапуск только если backup был успешен
        logInfo('✅ Backup успешен, запускаем перезапуск сервера');
        await gracefulRestart(chatId);

    } catch (error) {
        logError('Ошибка при распаковке архива', error);
        await sendMessage(chatId, `❌ Ошибка распаковки: ${error.message}`);
    }
}

/**
 * Распаковывает ZIP архив
 */
async function extractZip(zipPath, sessionPath, chatId) {
    return new Promise((resolve, reject) => {
        try {
            const zip = new AdmZip(zipPath);
            const zipEntries = zip.getEntries();

            // Нормализуем пути: заменяем обратные слеши на прямые (Windows -> Unix)
            const normalizedEntries = zipEntries.map((entry) => ({
                ...entry,
                normalizedPath: entry.entryName.replace(/\\/g, '/')
            }));

            // Для отладки: показываем первые несколько записей в архиве
            const firstEntries = normalizedEntries.slice(0, 20).map((e) => e.normalizedPath);
            logInfo('📂 Первые 20 записей в ZIP архиве:');
            logInfo(firstEntries.join('\n'));

            // Проверяем что есть папка session (с нормализованными путями)
            // Поддерживаем разные варианты:
            // 1. "session/" - папка session в корне
            // 2. "session" - ровно папка session (без слеша)
            // 3. "session/accounts/..." - содержимое session
            const hasSessionFolder = normalizedEntries.some((entry) => {
                const p = entry.normalizedPath;
                // Точное совпадение "session" или "session/"
                if (p === 'session' || p === 'session/') {return true;}
                // Начинается с "session/"
                if (p.startsWith('session/')) {return true;}
                // Для ZIP созданных на Windows может быть "session\" который уже нормализован
                return false;
            });

            if (hasSessionFolder) {
                logInfo('✅ Найдена папка session в корне архива');
                // Логируем пример найденного пути для отладки
                const sampleEntry = normalizedEntries.find((e) => {
                    const p = e.normalizedPath;
                    return p === 'session' || p === 'session/' || p.startsWith('session/');
                });
                if (sampleEntry) {
                    logInfo(`📂 Пример: ${sampleEntry.normalizedPath}`);
                }
            }

            if (!hasSessionFolder) {
                // Пытаемся найти session в любом месте архива
                const sessionEntries = normalizedEntries.filter((e) =>
                    e.normalizedPath.includes('session') || e.normalizedPath.includes('Session')
                );

                if (sessionEntries.length > 0) {
                    logInfo('🔍 Найдены записи содержащие \'session\':');
                    logInfo(sessionEntries.slice(0, 10).map((e) => e.normalizedPath).join('\n'));
                    reject(new Error(
                        `Архив содержит '${sessionEntries[0].normalizedPath}', но не содержит 'session/' в корне. ` +
                        'Переместите папку session/ в корень архива'
                    ));
                } else {
                    reject(new Error('Архив не содержит папку "session". Проверите что архив содержит папку session/ в корне'));
                }
                return;
            }

            // Создаем папку session если не существует
            if (!fs.existsSync(sessionPath)) {
                fs.mkdirSync(sessionPath, { recursive: true });
            }

            // Распаковываем только содержимое папки session, игнорируя ошибки
            let successCount = 0;
            let errorCount = 0;

            normalizedEntries.forEach((entry) => {
                if (entry.normalizedPath.startsWith('session/')) {
                    try {
                        const relativePath = entry.normalizedPath.substring('session/'.length);
                        if (relativePath) {
                            const targetPath = path.join(sessionPath, relativePath);

                            if (entry.isDirectory) {
                                if (!fs.existsSync(targetPath)) {
                                    fs.mkdirSync(targetPath, { recursive: true });
                                }
                            } else {
                                const dir = path.dirname(targetPath);
                                if (!fs.existsSync(dir)) {
                                    fs.mkdirSync(dir, { recursive: true });
                                }
                                fs.writeFileSync(targetPath, entry.getData());
                                // Устанавливаем права доступа для записанных файлов
                                fs.chmodSync(targetPath, 0o755);
                            }
                            successCount++;
                        }
                    } catch (err) {
                        errorCount++;
                        logWarn(`⚠️ Ошибка распаковки ${entry.normalizedPath}: ${err.message}`);
                    }
                }
            });

            logInfo(`✅ ZIP архив распакован: ${successCount} файлов успешно, ${errorCount} ошибок`);

            if (successCount === 0) {
                reject(new Error('Не удалось распаковать ни одного файла'));
            } else {
                resolve({ successCount, errorCount });
            }
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Распаковывает 7z архив (требует p7zip)
 */
async function extract7z(sevenZPath, sessionPath, chatId) {
    try {
        // Проверяем что p7zip установлен
        await execAsync('which 7z');

        // Создаем временную папку для распаковки
        const tempExtractDir = path.join(process.cwd(), 'temp', 'extract_7z');
        if (fs.existsSync(tempExtractDir)) {
            logInfo('🗑️ Очищаем старую временную директорию');
            fs.rmSync(tempExtractDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tempExtractDir, { recursive: true });
        logInfo(`📁 Создана временная директория: ${tempExtractDir}`);

        // Распаковываем, игнорируя ошибки
        const { stdout, stderr } = await execAsync(
            `7z x "${sevenZPath}" -o"${tempExtractDir}" -y 2>&1 || true`
        );

        logInfo('7z распаковка stdout:', stdout);

        // Проверяем что что-то распаковалось
        try {
            const checkDir = await execAsync(`ls -A "${tempExtractDir}" 2>&1 || true`);
            if (!checkDir.stdout.trim()) {
                throw new Error('7z распаковка не создала ни одного файла. Архив поврежден или пустой');
            }
        } catch (checkError) {
            if (checkError.message.includes('ни одного файла')) {
                throw checkError;
            }
        }

        // Показываем содержимое распакованной директории для отладки
        try {
            const listResult = await execAsync(`ls -la "${tempExtractDir}"`);
            logInfo('📂 Содержимое распакованной директории:');
            logInfo(listResult.stdout);

            // Также показываем рекурсивный список
            const recursiveList = await execAsync(`find "${tempExtractDir}" -type f -o -type d | head -50`);
            logInfo('📂 Полный список файлов (первые 50):');
            logInfo(recursiveList.stdout);
        } catch (listError) {
            logWarn('Не удалось получить список файлов:', listError.message);
        }

        // Проверяем что есть папка session
        let extractedSessionPath = path.join(tempExtractDir, 'session');

        if (!fs.existsSync(extractedSessionPath)) {
            // Пытаемся найти папку session в поддиректориях
            let foundSessionPath = null;
            try {
                const findResult = await execAsync(
                    `find "${tempExtractDir}" -type d -name "session" 2>&1 || true`
                );

                if (findResult.stdout.trim()) {
                    const foundPaths = findResult.stdout.trim().split('\n');
                    logInfo(`🔍 Найдены папки session: ${foundPaths.join(', ')}`);
                    foundSessionPath = foundPaths[0]; // Берем первую найденную
                }
            } catch (findError) {
                // Игнорируем
            }

            if (foundSessionPath) {
                logInfo(`✅ Найдена папка session в: ${foundSessionPath}`);
                extractedSessionPath = foundSessionPath; // Используем найденную
            } else {
                throw new Error('Архив не содержит папку "session". Проверите что архив содержит папку session/ в корне');
            }
        } else {
            logInfo('✅ Найдена папка session в корне архива');
        }

        // Создаем папку session если не существует
        const sessionPathFinal = path.join(process.cwd(), SESSION_DIR);
        if (!fs.existsSync(sessionPathFinal)) {
            fs.mkdirSync(sessionPathFinal, { recursive: true });
            logInfo(`📁 Создана папка session: ${sessionPathFinal}`);
        }

        // Копируем содержимое session с помощью JavaScript
        logInfo(`📋 Копирование файлов из ${extractedSessionPath} в ${sessionPathFinal}`);

        let successCount = 0;
        let errorCount = 0;
        let totalSize = 0;

        function copyDirRecursive(sourceDir, targetDir) {
            // Создаем целевую директорию
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            // Читаем все файлы и папки
            const items = fs.readdirSync(sourceDir);
            logInfo(`📂 Найдено элементов для копирования: ${items.length}`);

            items.forEach((item) => {
                const sourcePath = path.join(sourceDir, item);
                const targetPath = path.join(targetDir, item);

                try {
                    const stat = fs.statSync(sourcePath);

                    if (stat.isDirectory()) {
                        // Рекурсивно копируем директорию
                        copyDirRecursive(sourcePath, targetPath);
                    } else {
                        // Копируем файл
                        fs.copyFileSync(sourcePath, targetPath);

                        // Устанавливаем права доступа
                        fs.chmodSync(targetPath, 0o755);

                        const fileSize = stat.size;
                        totalSize += fileSize;
                        successCount++;

                        logInfo(`✅ Скопирован: ${item} (${fileSize} bytes)`);
                    }
                } catch (err) {
                    errorCount++;
                    logError(`❌ Ошибка копирования ${item}:`, err.message);
                    // Продолжаем копировать остальные файлы
                }
            });
        }

        // Запускаем копирование
        copyDirRecursive(extractedSessionPath, sessionPathFinal);

        logInfo(`📊 Итого скопировано: ${successCount} файлов, ${errorCount} ошибок`);
        logInfo(`📊 Общий размер: ${(totalSize / 1024).toFixed(2)} KB`);

        if (successCount === 0) {
            throw new Error('Не удалось скопировать ни одного файла из архива');
        }

        // Очищаем временную папку
        try {
            fs.rmSync(tempExtractDir, { recursive: true, force: true });
            logInfo('🗑️ Очищена временная директория');
        } catch (e) {
            logWarn('⚠️ Не удалось очистить временную директорию:', e.message);
        }

        logInfo('✅ 7z архив успешно распакован');
    } catch (error) {
        if (error.message.includes('which 7z')) {
            throw new Error('p7zip не установлен. Установите: apt-get install p7zip-full');
        }
        throw error;
    }
}

/**
 * Корректный перезапуск сервиса
 */
async function gracefulRestart(chatId) {
    try {
        logInfo('🔄 Запуск корректного перезапуска сервиса...');

        await sendMessage(chatId,
            '🔄 <b>Перезапуск сервиса...</b>\n\n' +
            '⏱️ Сервис будет перезапущен в течение 5 секунд'
        );

        // Даем Docker Compose время на перезапуск
        // Выходим с кодом 42 - сигнал для docker-compose restart
        logInfo('🛑 Завершение работы для перезапуска Docker Compose...');

        // Записываем файл-флаг для docker-compose
        const restartFlagPath = path.join(process.cwd(), '.restart_flag');
        const hasPendingArchive = fs.existsSync(path.join(process.cwd(), '.pending_archive'));

        fs.writeFileSync(restartFlagPath, JSON.stringify({
            reason: hasPendingArchive ? 'telegram_session_upload_with_archive' : 'telegram_session_update',
            timestamp: new Date().toISOString(),
            chatId: chatId,
            hasPendingArchive: hasPendingArchive
        }));

        // Завершаем процесс
        process.exit(42);

    } catch (error) {
        logError('Ошибка при перезапуске', error);
        await sendMessage(chatId, `❌ Ошибка перезапуска: ${error.message}`);
    }
}

/**
 * Отправляет сообщение помощи
 */
async function sendHelpMessage(chatId) {
    const accountsExist = hasAccounts();

    let helpText =
        '🤖 <b>FreeQwenApi Bot - Управление</b>\n\n' +
        '📋 <b>Команды управления:</b>\n\n' +
        '/help - Показать это сообщение\n' +
        '/status - Показать статус сервиса\n' +
        '/restart - Перезапустить сервис\n' +
        '<s>/extend</s> - 🔧 Временно отключено\n\n';

    // Команды генерации изображений
    helpText +=
        '🎨 <b>Генерация изображений:</b>\n\n' +
        '/image &lt;описание&gt; - Сгенерировать изображение\n' +
        '/imagine &lt;описание&gt; - Альтернативная команда\n\n' +
        '💡 Пример: /image A beautiful sunset over the ocean\n\n';

    // Показываем LLM команды только если есть аккаунты
    if (accountsExist) {
        helpText +=
            '🤖 <b>LLM Чат (AI ассистент):</b>\n\n' +
            '/chat - Показать состояние LLM чата\n' +
            '/togglechat - Включить/выключить LLM чат\n' +
            '/clear - Очистить контекст чата\n' +
            '/model - Информация о модели\n' +
            '/setmodel &lt;название&gt; - Сменить модель\n\n' +
            '💡 Когда LLM чат включен, просто отправляйте сообщения!\n\n';
    } else {
        helpText +=
            '⚠️ <b>LLM Чат недоступен</b>\n\n' +
            '🔒 Функции AI ассистента временно недоступны\n' +
            '📦 Отправьте архив с сессиями для активации\n\n';
    }

    helpText +=
        '📦 <b>Загрузка сессий:</b>\n\n' +
        'Отправьте ZIP или 7z архив с папкой "session" внутри.\n' +
        'Бот распакует его и перезапустит сервис.\n\n' +
        '/archive - Инструкция по созданию архива\n\n' +
        '📏 <b>Лимиты:</b>\n' +
        '• Максимальный размер файла: 50MB\n' +
        '• Поддерживаемые форматы: .zip, .7z\n\n' +
        '📚 <b>Дополнительные команды:</b>\n\n' +
        '/setup - Инструкция по созданию сессии\n' +
        '/connect - Как подключить к проекту\n' +
        '/about - Информация о проекте\n\n' +
        '🐳 <b>Docker:</b>\n' +
        'https://hub.docker.com/r/endykaufman/qwen-api-proxy';

    await sendMessage(chatId, helpText);
}

/**
 * Отправляет сообщение со статусом
 */
async function sendSetupMessage(chatId) {
    const setupText =
        '🛠️ <b>Создание сессии авторизации</b>\n\n' +
        '<b>📖 Что нужно знать:</b>\n' +
        '• <b>Git</b> - система управления версиями (опционально)\n' +
        '• <b>Docker Compose</b> - инструмент для управления контейнерами\n' +
        '• Если используете Docker Desktop - Compose уже встроен!\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '<b>Способ 1: Локальная установка (Node.js)</b>\n\n' +
        '<b>Вариант A: С Git:</b>\n' +
        '1. <code>git clone https://github.com/EndyKaufman/FreeQwenApi</code>\n' +
        '2. <code>cd FreeQwenApi</code>\n' +
        '3. <code>npm install</code>\n' +
        '4. <code>npm start</code>\n' +
        '5. Выберите <code>1</code> - добавить аккаунт\n' +
        '6. Войдите в аккаунт Qwen в браузере\n' +
        '7. Токен сохранится автоматически\n\n' +
        '<b>Вариант B: Без Git (ZIP):</b>\n' +
        '1. Скачайте ZIP: https://github.com/EndyKaufman/FreeQwenApi\n' +
        '2. Нажмите <b>"<> Code"</b> → <b>"Download ZIP"</b>\n' +
        '3. Распакуйте и перейдите в папку\n' +
        '4. <code>npm install</code>\n' +
        '5. <code>npm start</code> → выберите <code>1</code>\n\n' +
        '<b>Способ 2: Docker</b>\n\n' +
        '<b>Что такое Docker Compose?</b>\n' +
        '• Входит в Docker Desktop (Windows/macOS)\n' +
        '• Linux: <code>sudo apt install docker-compose-plugin</code>\n' +
        '• Проверка: <code>docker compose version</code>\n\n' +
        '<b>С Compose:</b>\n' +
        '1. Сначала создайте сессию локально:\n' +
        '   <code>npm run auth</code> (или <code>npm start</code> → <code>1</code>)\n' +
        '2. Соберите Docker:\n' +
        '   <code>docker compose build --no-cache</code>\n' +
        '3. Запустите:\n' +
        '   <code>docker compose up -d</code>\n\n' +
        '<b>Без Compose (обычный Docker):</b>\n' +
        '1. Создайте сессию локально (см. Способ 1)\n' +
        '2. Соберите образ:\n' +
        '   <code>docker build -t qwen-proxy .</code>\n' +
        '3. Запустите:\n' +
        '   <code>docker run -d --name qwen-proxy -p 3264:3264 -e SKIP_ACCOUNT_MENU=true -v $(pwd)/session:/app/session qwen-proxy</code>\n\n' +
        '<b>Структура папки session:</b>\n' +
        '<code>session/</code>\n' +
        '├── <code>accounts/</code>\n' +
        '│   ├── <code>acc_123456/</code>\n' +
        '│   │   └── <code>token.txt</code>\n' +
        '│   └── <code>acc_789012/</code>\n' +
        '│       └── <code>token.txt</code>\n' +
        '└── <code>tokens.json</code>\n\n' +
        '💡 <b>Совет:</b> Используйте /archive для подробной инструкции\n\n' +
        '📖 Подробнее: https://github.com/EndyKaufman/FreeQwenApi';

    await sendMessage(chatId, setupText);
}

async function sendConnectMessage(chatId) {
    const connectText =
        '🔌 <b>Подключение FreeQwenApi к проекту</b>\n\n' +
        '<b>📖 Что такое Docker Compose?</b>\n' +
        'Это инструмент для запуска многоконтейнерных приложений.\n' +
        'Он управляет контейнерами через файл <code>docker-compose.yml</code>.\n\n' +
        '<b>Установка Docker Compose:</b>\n' +
        '• Входит в <b>Docker Desktop</b> (Windows/macOS)\n' +
        '• Linux: <code>sudo apt install docker-compose-plugin</code>\n' +
        '• Проверка: <code>docker compose version</code>\n\n' +
        '💡 <i>Если Docker Desktop установлен - Compose уже есть!</i>\n\n' +
        '<b>━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n\n' +
        '<b>Шаг 1: Запуск через Docker Compose</b>\n\n' +
        'Добавьте в ваш <code>docker-compose.yml</code>:\n\n' +
        '<pre>\n' +
        'services:\n' +
        '  qwen-proxy:\n' +
        '    build: .\n' +
        '    container_name: qwen-proxy\n' +
        '    environment:\n' +
        '      - SKIP_ACCOUNT_MENU=true\n' +
        '      - PORT=3264\n' +
        '    ports:\n' +
        '      - "3264:3264"\n' +
        '    volumes:\n' +
        '      - ./session_backup:/app/session_backup\n' +
        '      - ./session:/app/session\n' +
        '      - ./logs:/app/logs\n' +
        '      - ./uploads:/app/uploads\n' +
        '      - ./temp:/app/temp\n' +
        '    restart: unless-stopped\n' +
        '</pre>\n\n' +
        'Или используйте наш <code>docker-compose.yml</code>:\n' +
        '<code>docker compose up -d</code>\n\n' +
        '<b>Альтернатива: Без Docker Compose</b>\n\n' +
        'Если Compose не установлен, используйте обычный Docker:\n\n' +
        '<pre>\n' +
        'docker build -t qwen-proxy .\n' +
        'docker run -d \\\n' +
        '  --name qwen-proxy \\\n' +
        '  -p 3264:3264 \\\n' +
        '  -e SKIP_ACCOUNT_MENU=true \\\n' +
        '  -v $(pwd)/session:/app/session \\\n' +
        '  -v $(pwd)/logs:/app/logs \\\n' +
        '  -v $(pwd)/uploads:/app/uploads \\\n' +
        '  -v $(pwd)/temp:/app/temp \\\n' +
        '  qwen-proxy\n' +
        '</pre>\n\n' +
        '<b>━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n\n' +
        '<b>Шаг 2: Первый запрос через curl</b>\n\n' +
        '<b>Простой запрос:</b>\n' +
        '<pre>\n' +
        'curl http://localhost:3264/api/chat/completions \\\n' +
        '  -H "Content-Type: application/json" \\\n' +
        '  -d \'{"model":"qwen3.5-plus","messages":[{"role":"user","content":"Привет!"}]}\'\n' +
        '</pre>\n\n' +
        '<b>С продолжением диалога:</b>\n' +
        '<pre>\n' +
        'curl -X POST http://localhost:3264/api/chat/completions \\\n' +
        '  -H "Content-Type: application/json" \\\n' +
        '  -d \'{\n' +
        '    "model": "qwen3.5-plus",\n' +
        '    "messages": [{"role": "user", "content": "Сколько будет 2+2?"}]\n' +
        '  }\'\n' +
        '</pre>\n\n' +
        '<b>Шаг 3: Использование с OpenAI SDK</b>\n\n' +
        '<pre>\n' +
        'import OpenAI from \'openai\';\n\n' +
        'const client = new OpenAI({\n' +
        '    baseURL: \'http://localhost:3264/api\',\n' +
        '    apiKey: \'any-string\'\n' +
        '});\n\n' +
        'const response = await client.chat.completions.create({\n' +
        '    model: \'qwen3.5-plus\',\n' +
        '    messages: [{ role: \'user\', content: \'Привет!\' }]\n' +
        '});\n' +
        '</pre>\n\n' +
        '📖 API Docs: http://localhost:3264/api\n' +
        '📚 GitHub: https://github.com/EndyKaufman/FreeQwenApi';

    await sendMessage(chatId, connectText);
}

async function sendAboutMessage(chatId) {
    const aboutText =
        '📚 <b>О проекте FreeQwenApi</b>\n\n' +
        '<b>🌐 Оригинальный проект:</b>\n' +
        'https://github.com/y13sint/FreeQwenApi\n\n' +
        '<b>🔧 Мой форк:</b>\n' +
        'https://github.com/EndyKaufman/FreeQwenApi\n\n' +
        '<b>⭐ Ключевые отличия форка:</b>\n\n' +
        '✅ <b>Telegram Bot интеграция</b>\n' +
        '   - Управление сервисом через Telegram\n' +
        '   - Загрузка сессий архивами (.zip/.7z)\n' +
        '   - LLM чат с AI ассистентом\n' +
        '   - Мониторинг статуса в реальном времени\n\n' +
        '✅ <b>Прокси поддержка для Telegram</b>\n' +
        '   - HTTP/HTTPS/SOCKS прокси\n' +
        '   - Безопасное логирование (без credentials)\n\n' +
        '✅ <b>Автоматическая распаковка архивов</b>\n' +
        '   - Backup перед обновлением\n' +
        '   - Error-tolerant extraction\n' +
        '   - Health check при запуске\n\n' +
        '✅ <b>Улучшенная документация</b>\n' +
        '   - Подробные README на русском\n' +
        '   - Telegram bot guides\n' +
        '✅ <b>Production-ready features</b>\n' +
        '   - Docker оптимизация\n' +
        '   - Graceful restarts\n' +
        '   - System health monitoring\n\n' +
        '<b>📊 Общие возможности:</b>\n' +
        '• 25+ моделей Qwen (включая Qwen 3.5)\n' +
        '• OpenAI-совместимый API\n' +
        '• Генерация изображений\n' +
        '• Загрузка файлов\n' +
        '• Streaming ответов (SSE)\n' +
        '• Мультиаккаунт ротация\n' +
        '• Бесплатный доступ к Qwen AI\n\n' +
        '💡 <i>Оба проекта используют MIT лицензию</i>';

    await sendMessage(chatId, aboutText);
}

/**
 * Отправляет инструкции по созданию архива сессии
 */
async function sendArchiveInstructions(chatId) {
    const archiveText =
        '📦 <b>Создание архива сессии для Docker</b>\n\n' +
        'Эта инструкция поможет создать архив с авторизацией\n' +
        'для последующей загрузки в Telegram бота.\n\n' +
        '<b>🔹 Шаг 1: Установка Node.js</b>\n\n' +
        '<b>Windows:</b>\n' +
        '• Скачайте с <code>nodejs.org</code>\n' +
        '• Установите (галочка "Add to PATH")\n\n' +
        '<b>macOS:</b>\n' +
        '• <code>brew install node</code>\n' +
        '• Или скачайте с <code>nodejs.org</code>\n\n' +
        '<b>Linux (Ubuntu/Debian):</b>\n' +
        '• <code>curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -</code>\n' +
        '• <code>sudo apt install -y nodejs</code>\n\n' +
        '<b>🔹 Шаг 2: Скачивание проекта</b>\n\n' +
        '<b>Способ A: Git (если установлен):</b>\n' +
        '<pre>\n' +
        'git clone https://github.com/EndyKaufman/FreeQwenApi\n' +
        'cd FreeQwenApi\n' +
        'npm install\n' +
        '</pre>\n\n' +
        '<b>Способ B: Без Git (ZIP архив):</b>\n' +
        '1. Откройте: https://github.com/EndyKaufman/FreeQwenApi\n' +
        '2. Нажмите зелёную кнопку <b>"&lt;&gt; Code"</b>\n' +
        '3. Выберите <b>"Download ZIP"</b>\n' +
        '4. Распакуйте архив\n' +
        '5. Откройте терминал в папке проекта\n' +
        '6. <code>npm install</code>\n\n' +
        '💡 <i>Этот способ не требует установки Git!</i>\n\n' +
        '<b>🔹 Шаг 3: Создание архива сессии</b>\n\n' +
        '<pre>\n' +
        'npm run create-session-archive\n' +
        '</pre>\n\n' +
        '<b>Что произойдет:</b>\n' +
        '1. Откроется браузер\n' +
        '2. Войдите в Qwen (GitHub/Google/email)\n' +
        '3. Нажмите ENTER в консоли\n' +
        '4. Сессия сохранится\n' +
        '5. Создется ZIP архив\n\n' +
        '<b>🔹 Шаг 4: Отправка в Telegram бота</b>\n\n' +
        '1. Откройте нашего бота\n' +
        '2. Нажмите 📎 (скрепка)\n' +
        '3. Выберите <b>"Файл"</b> (НЕ "Фото"!)\n' +
        '4. Выберите <code>session_backup_*.zip</code>\n' +
        '5. Отправьте\n' +
        '6. Дождитесь: <code>✅ Архив распакован</code>\n\n' +
        '<b>🔹 Альтернатива: Ручной способ</b>\n\n' +
        'Если <code>npm run</code> не работает:\n\n' +
        '<b>Windows PowerShell:</b>\n' +
        '<pre>\n' +
        'node scripts/createSessionArchive.js\n' +
        '</pre>\n\n' +
        '<b>Linux/macOS:</b>\n' +
        '<pre>\n' +
        'node scripts/createSessionArchive.js\n' +
        '</pre>\n\n' +
        '<b>🔹 Структура архива:</b>\n\n' +
        '<pre>\n' +
        'session/\n' +
        '├── accounts/\n' +
        '│   ├── acc_123456/\n' +
        '│   │   ├── token.txt\n' +
        '│   │   └── cookies.json\n' +
        '│   └── acc_789012/\n' +
        '│       ├── token.txt\n' +
        '│       └── cookies.json\n' +
        '└── tokens.json\n' +
        '</pre>\n\n' +
        '<b>⚠️ Важно:</b>\n' +
        '• <code>cookies.json</code> обязателен!\n' +
        '• Без cookies сессия не продлится\n' +
        '• Архив должен содержать папку <code>session/</code>\n\n' +
        '<b>🆘 Проблемы?</b>\n' +
        '• GitHub: https://github.com/EndyKaufman/FreeQwenApi\n' +
        '• Используйте /help для списка команд';

    await sendMessage(chatId, archiveText);
}

async function sendStatusMessage(chatId, isScheduled = false) {
    try {
        // Получаем статус бота
        const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
        const botStarted = !!telegramToken;

        // Проверяем все подсистемы (не отправляем автоматически, так как sendStatusMessage отправит сам)
        const checks = await checkAllSubsystems(botStarted, false);

        // Формируем сообщение с统一的格式
        const reportLines = [];

        // Заголовок
        if (isScheduled) {
            const now = new Date();
            const timeStr = now.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            reportLines.push(`⏰ <b>Плановая проверка</b> (${timeStr})\n`);
        } else {
            reportLines.push('🚀 <b>Сервис запущен!</b>\n');
        }

        // Группа 1: Основные компоненты
        reportLines.push('<b>🔑 Основные компоненты:</b>');
        const mainComponents = checks.filter((c) =>
            c.name.includes('Session') || c.name.includes('Токены') || c.name.includes('Telegram') ||
            c.name.includes('Токен ') || c.name.includes('AI') || c.name.includes('Ответ')
        );
        mainComponents.forEach((check) => {
            reportLines.push(`${check.name}: ${check.details}`);
        });

        reportLines.push('');

        // Группа 2: Инфраструктура
        reportLines.push('<b>🏗️ Инфраструктура:</b>');
        const infrastructure = checks.filter((c) =>
            c.name.includes('Прокси') || c.name.includes('Uploads') || c.name.includes('Логирование')
        );
        infrastructure.forEach((check) => {
            reportLines.push(`${check.name}: ${check.details}`);
        });

        reportLines.push('');

        // Группа 3: Инструменты
        reportLines.push('<b>🔧 Инструменты:</b>');
        const tools = checks.filter((c) =>
            c.name.includes('p7zip')
        );
        tools.forEach((check) => {
            reportLines.push(`${check.name}: ${check.details}`);
        });

        reportLines.push('');
        reportLines.push('━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Итоговый статус
        const tokens = loadTokens();
        const hasTokens = tokens.length > 0;
        const allOk = checks.every((c) => c.status);

        if (hasTokens && allOk) {
            reportLines.push('✅ <b>Все системы работают</b>');
        } else if (!hasTokens) {
            reportLines.push('⚠️ <b>Режим ожидания архива</b>');
            reportLines.push('📦 Отправьте архив с сессиями');
        } else {
            reportLines.push('⚠️ <b>Есть проблемы</b>');
        }

        // Ссылки
        reportLines.push(`\n🌐 API: http://localhost:${process.env.PORT || 3264}`);
        reportLines.push(`📖 Docs: http://localhost:${process.env.PORT || 3264}/api`);

        // Репозиторий
        reportLines.push('\n📚 <b>Репозиторий:</b>');
        reportLines.push('🔗 GitHub: https://github.com/EndyKaufman/FreeQwenApi');
        reportLines.push('⭐ Оригинал: https://github.com/y1n7sint/FreeQwenApi');
        reportLines.push('🐳 Docker: https://hub.docker.com/r/endykaufman/qwen-api-proxy');

        // Справка
        reportLines.push('\n💡 <b>Справка:</b>');
        reportLines.push('📝 Используйте /help для списка команд');
        reportLines.push('🔍 Используйте /status для проверки состояния');
        reportLines.push('🤖 Используйте /chat для включения LLM режима');

        const report = reportLines.join('\n');
        await sendMessage(chatId, report);
    } catch (error) {
        logError('Ошибка получения статуса', error);
        await sendMessage(chatId, '❌ Не удалось получить статус');
    }
}

/**
 * Обработчик команды /restart
 */
async function handleRestart(chatId) {
    await sendMessage(chatId, '🔄 Перезапуск сервиса...');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await gracefulRestart(chatId);
}

/**
 * Обрабатывает команду продления сессии
 */
async function handleExtendSession(chatId) {
    try {
        // Импортируем функции для продления сессии
        const { initBrowser, shutdownBrowser, getBrowserContext } = await import('../browser/browser.js');
        const { extractAuthToken } = await import('../api/chat.js');
        const { loadSession, saveAuthToken } = await import('../browser/session.js');
        const { loadTokens, saveTokens } = await import('../api/tokenManager.js');
        const { CHAT_PAGE_URL } = await import('../config.js');

        const tokens = loadTokens();

        if (tokens.length === 0) {
            await sendMessage(chatId,
                '⚠️ <b>Нет аккаунтов</b>\n\n' +
                'Сначала создайте сессию:\n' +
                '1. Запустите <code>npm run create-session-archive</code>\n' +
                '2. Или отправьте архив через бота'
            );
            return;
        }

        // Фильтруем только действительные токены для продления
        const now = Date.now();
        const validTokens = tokens.filter((t) => {
            if (t.invalid) { return false; }
            if (t.resetAt && new Date(t.resetAt).getTime() > now) { return false; }
            if (t.expiryTime && t.expiryTime <= now) { return false; }
            // Проверяем наличие cookies.json
            const cookiesPath = path.join(process.cwd(), SESSION_DIR, 'accounts', t.id, 'cookies.json');
            if (!fs.existsSync(cookiesPath)) { return false; }
            return true;
        });

        const expiredCount = tokens.length - validTokens.length;

        if (validTokens.length === 0) {
            await sendMessage(chatId,
                '⚠️ <b>Нет действительных токенов</b>\n\n' +
                `Все ${tokens.length} токенов истекли.\n\n` +
                'Создайте новые сессии:\n' +
                '1. Запустите <code>npm run create-session-archive</code>\n' +
                '2. Или отправьте архив через бота'
            );
            return;
        }

        let startMessage = '🔄 <b>Продление сессий...</b>\n\n' +
            `📊 Найдено аккаунтов: ${validTokens.length}`;

        if (expiredCount > 0) {
            startMessage += ` (пропущено ${expiredCount} истекших)`;
        }

        startMessage += '\n⏳ Это может занять несколько минут...\n' +
            '🕐 Примерное время: ~2-4 минуты на аккаунт';

        await sendMessage(chatId, startMessage);

        let successCount = 0;
        let failCount = 0;
        const results = [];

        for (const token of validTokens) {
            try {
                // Показываем прогресс
                const currentNum = results.length + 1;
                await sendMessage(chatId,
                    `🔄 Обрабатываю аккаунт ${currentNum}/${tokens.length}...\n` +
                    `👤 ${token.id}`
                );

                // Пропускаем недействительные токены
                if (token.invalid) {
                    results.push(`⏭️ ${token.id} - пропущен (недействителен)`);
                    failCount++;
                    continue;
                }

                // Загружаем cookies для аккаунта
                const cookiesPath = path.join(process.cwd(), SESSION_DIR, 'accounts', token.id, 'cookies.json');

                if (!fs.existsSync(cookiesPath)) {
                    results.push(`❌ ${token.id} - нет cookies`);
                    failCount++;
                    logWarn(`Session extension failed for ${token.id}: cookies.json not found`);
                    continue;
                }

                const cookiesData = fs.readFileSync(cookiesPath, 'utf8');
                const cookies = JSON.parse(cookiesData);

                // Открываем браузер в headless режиме
                const browserOk = await initBrowser(false, true);

                if (!browserOk) {
                    throw new Error('Не удалось открыть браузер');
                }

                const ctx = getBrowserContext();

                // Загружаем cookies
                if (ctx && typeof ctx.setCookie === 'function') {
                    await ctx.setCookie(...cookies);
                }

                // Переходим на Qwen для обновления сессии (3 минуты таймаут)
                await ctx.goto(CHAT_PAGE_URL, {
                    waitUntil: 'domcontentloaded',
                    timeout: 180000 // 3 минуты
                });

                // Ждем загрузки страницы (1 минута для полной загрузки)
                await new Promise((resolve) => setTimeout(resolve, 60000));

                // Извлекаем новый токен
                const newToken = await extractAuthToken(ctx, true);

                if (!newToken) {
                    results.push(`❌ ${token.id} - не удалось получить токен`);
                    failCount++;
                    await shutdownBrowser();
                    continue;
                }

                // Сохраняем новый токен
                const tokenFile = path.join(process.cwd(), SESSION_DIR, 'accounts', token.id, 'token.txt');
                fs.writeFileSync(tokenFile, newToken, 'utf8');
                saveAuthToken(newToken);

                // Обновляем tokens.json
                const tokenIndex = tokens.findIndex((t) => t.id === token.id);
                if (tokenIndex !== -1) {
                    tokens[tokenIndex].token = newToken;
                    tokens[tokenIndex].resetAt = null;
                    tokens[tokenIndex].invalid = false;
                    tokens[tokenIndex].lastExtended = new Date().toISOString();
                    saveTokens(tokens);
                }

                // Сохраняем обновленные cookies
                const newCookies = await ctx.cookies();
                fs.writeFileSync(cookiesPath, JSON.stringify(newCookies, null, 2));

                // Закрываем браузер
                await shutdownBrowser();

                results.push(`✅ ${token.id} - продлен`);
                successCount++;

                // Небольшая задержка между аккаунтами
                if (successCount < tokens.length) {
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                }

            } catch (error) {
                logError(`Ошибка продления ${token.id}`, error);
                results.push(`❌ ${token.id} - ${error.message}`);
                failCount++;

                // Убеждаемся что браузер закрыт
                try {
                    await shutdownBrowser();
                } catch (e) {
                    // ignore
                }
            }
        }

        // Формируем отчет
        let report = '📋 <b>Результат продления сессий</b>\n\n';
        report += `✅ Успешно: ${successCount}\n`;
        report += `❌ Ошибки: ${failCount}\n\n`;
        report += '<b>Детали:</b>\n';
        report += results.join('\n');

        if (successCount > 0) {
            report += '\n\n🎉 Сессии продлены!';
        }

        if (failCount > 0 && successCount === 0) {
            report += '\n\n⚠️ Все сессии не удалось продлить.\n';

            // Check if the issue is missing cookies
            const missingCookiesCount = results.filter((r) => r.includes('нет cookies')).length;

            if (missingCookiesCount > 0) {
                report += '\n📦 <b>Причина: отсутствуют cookies.json</b>\n';
                report += '\nДля создания новой сессии с cookies:\n';
                report += '1. Запустите: <code>npm run create-session-archive</code>\n';
                report += '2. Войдите в систему в браузере\n';
                report += '3. Бот автоматически сохранит cookies и токен\n';
                report += '\n💡 Или отправьте архив с сессиями через бота';
            } else {
                report += '\nВыполните: <code>npm run create-session-archive</code>';
            }
        }

        await sendMessage(chatId, report);

    } catch (error) {
        logError('Ошибка при продлении сессий', error);
        await sendMessage(chatId,
            '❌ <b>Ошибка продления сессий</b>\n\n' +
            `Ошибка: ${error.message}\n\n` +
            'Попробуйте:\n' +
            '1. <code>npm run create-session-archive</code>\n' +
            '2. Или отправьте архив с сессиями'
        );
    }
}

/**
 * Отправка плановой проверки всем админам
 */
async function sendScheduledStatusToAdmins() {
    try {
        const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!telegramToken) {
            return;
        }

        const adminUserIds = TELEGRAM_USER_IDS;

        if (adminUserIds.length === 0) {
            logInfo('Нет админов для отправки плановой проверки');
            return;
        }

        logInfo(`Отправка плановой проверки ${adminUserIds.length} админам`);

        for (const adminId of adminUserIds) {
            try {
                await sendStatusMessage(adminId, true);
                logInfo(`Плановая проверка отправлена админу ${adminId}`);
            } catch (error) {
                logError(`Ошибка отправки плановой проверки админу ${adminId}`, error);
            }
        }
    } catch (error) {
        logError('Ошибка отправки плановой проверки', error);
    }
}

/**
 * Запуск периодической проверки каждые 4 часа
 */
export function startPeriodicHealthCheck() {
    const FOUR_HOURS = 4 * 60 * 60 * 1000; // 4 часа в миллисекундах

    logInfo('Запуск периодической проверки здоровья каждые 4 часа');

    setInterval(async () => {
        logInfo('Выполняется плановая проверка здоровья...');
        await sendScheduledStatusToAdmins();
    }, FOUR_HOURS);
}

/**
 * Отправляет сообщение в Telegram
 */
async function sendMessage(chatId, text) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetchWithProxy(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            logError(`Ошибка отправки сообщения Telegram: ${errorBody}`);
        }
    } catch (error) {
        logError('Ошибка отправки сообщения в Telegram', error);
    }
}

/**
 * Отправляет уведомление всем пользователям
 */
export async function notifyAllUsers(message) {
    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_USER_IDS.length === 0) {
        return false;
    }

    for (const userId of TELEGRAM_USER_IDS) {
        await sendMessage(userId, message);
    }

    return true;
}

/**
 * Обработчик LLM чата - отправляет сообщение в Qwen API
 */
async function handleLLMChat(chatId, userMessage) {
    let context;
    try {
        // Показываем индикатор набора текста
        await sendChatAction(chatId, 'typing');

        // Получаем или создаем контекст чата
        if (!chatContexts.has(chatId)) {
            chatContexts.set(chatId, []);
        }

        context = chatContexts.get(chatId);

        // Добавляем сообщение пользователя в контекст
        context.push({ role: 'user', content: userMessage });

        // Ограничиваем контекст последними 20 сообщениями
        if (context.length > 20) {
            context.splice(0, context.length - 20);
        }

        logInfo(`🤖 LLM Chat: Запрос от пользователя ${chatId}: ${userMessage.substring(0, 50)}...`);

        // Отправляем запрос к Qwen API
        const apiUrl = `http://localhost:${process.env.PORT || 3264}/api/chat/completions`;

        // Получаем модель для этого чата
        const model = getModelForChat(chatId);

        const requestBody = {
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant in a Telegram bot. Keep responses concise and clear. Respond in the same language as the user.'
                },
                ...context
            ],
            model: model,
            stream: false
        };

        // Используем chatId Telegram как x-chat-id header для изоляции диалогов
        // Это позволяет API управлять контекстом вместо локального chatContexts
        const response = await fetchWithQwenProxy(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-chat-id': `telegram-${chatId}` // Уникальный ID для каждого Telegram чата
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();

            // Логируем полную ошибку
            logError(`❌ LLM Chat: Qwen API error ${response.status}`, errorText);

            // Пытаемся распарсить JSON для лучшего форматирования
            let errorJson;
            try {
                errorJson = JSON.parse(errorText);
            } catch {
                errorJson = { error: errorText };
            }

            // Формируем сообщение об ошибке с полным JSON
            const escapedJson = escapeHtmlForCode(JSON.stringify(errorJson, null, 2));
            const errorMessage =
                '❌ <b>Ошибка Qwen API</b>\n\n' +
                `Статус: <code>${response.status}</code>\n\n` +
                '<b>Полный ответ:</b>\n' +
                `<pre>${escapedJson}</pre>\n\n` +
                '💡 Попробуйте еще раз или используйте /clear';

            // Отправляем ошибку (разбиваем если длинная)
            if (errorMessage.length > 4000) {
                const chunks = splitMessage(errorMessage, 4000);
                for (const chunk of chunks) {
                    await sendMessage(chatId, chunk);
                }
            } else {
                await sendMessage(chatId, errorMessage);
            }

            // Удаляем последнее сообщение пользователя из контекста (оно не было обработано)
            if (context.length > 0) {
                context.pop();
            }

            return; // Выходим, не выбрасывая ошибку
        }

        const data = await response.json();

        // Извлекаем ответ
        const assistantMessage = data.choices?.[0]?.message?.content || 'Извините, я не смог обработать ваш запрос.';

        // Добавляем ответ в контекст
        context.push({ role: 'assistant', content: assistantMessage });

        // Отправляем ответ пользователю
        // Если сообщение длинное, разбиваем на части (Telegram limit: 4096 chars)
        if (assistantMessage.length > 4000) {
            const chunks = splitMessage(assistantMessage, 4000);
            for (const chunk of chunks) {
                await sendMessage(chatId, chunk);
            }
        } else {
            await sendMessage(chatId, assistantMessage);
        }

        logInfo(`✅ LLM Chat: Ответ отправлен (${assistantMessage.length} символов)`);

    } catch (error) {
        logError('❌ LLM Chat: Ошибка', error);

        // Формируем сообщение об ошибке с деталями
        const escapedStack = escapeHtmlForCode(error.stack || 'Stack trace unavailable');
        const errorMessage =
            '❌ <b>Ошибка при обработке запроса</b>\n\n' +
            `<b>Тип:</b> ${error.name || 'Unknown'}\n` +
            `<b>Сообщение:</b> ${escapeHtml(error.message)}\n\n` +
            '<b>Стек:</b>\n' +
            `<pre>${escapedStack}</pre>\n\n` +
            '💡 Попробуйте еще раз или используйте /clear для очистки контекста.';

        // Отправляем ошибку (разбиваем если длинная)
        if (errorMessage.length > 4000) {
            const chunks = splitMessage(errorMessage, 4000);
            for (const chunk of chunks) {
                await sendMessage(chatId, chunk);
            }
        } else {
            await sendMessage(chatId, errorMessage);
        }

        // Удаляем последнее сообщение пользователя из контекста
        if (context && context.length > 0) {
            context.pop();
        }
    }
}

/**
 * Переключает режим LLM чата
 */
async function toggleLLMChat(chatId) {
    // Проверяем есть ли аккаунты
    if (!hasAccounts()) {
        await sendMessage(chatId,
            '❌ <b>LLM чат недоступен</b>\n\n' +
            '🔒 Для работы AI ассистента нужны аккаунты\n' +
            '📦 Отправьте архив с сессиями через бота\n' +
            '💡 После загрузки аккаунтов функции будут доступны'
        );
        logInfo('❌ LLM Chat запрошен, но аккаунты отсутствуют');
        return;
    }

    // Если LLM уже включен - выключаем, и наоборот
    llmChatEnabled = !llmChatEnabled;

    // Сохраняем состояние LLM чата
    saveBotSettings({
        activeModel: activeModel,
        llmChatEnabled: llmChatEnabled
    });

    if (llmChatEnabled) {
        // Инициализируем контекст чата
        if (!chatContexts.has(chatId)) {
            chatContexts.set(chatId, []);
        }

        await sendMessage(chatId,
            '✅ <b>LLM чат включен!</b>\n\n' +
            '🤖 Теперь я отвечаю как AI ассистент.\n' +
            `📝 Модель: ${getModelForChat(chatId)}\n` +
            '💬 Просто отправляйте сообщения.\n' +
            '💾 Настройка сохранена\n\n' +
            '<b>Команды:</b>\n' +
            '/togglechat - Выключить LLM чат\n' +
            '/clear - Очистить контекст\n' +
            '/model - Информация о модели\n' +
            '/setmodel &lt;название&gt; - Сменить модель\n' +
            '/help - Все команды бота'
        );

        logInfo(`✅ LLM Chat включен для пользователя ${chatId} (сохранено)`);
    } else {
        await sendMessage(chatId,
            '❌ <b>LLM чат выключен</b>\n\n' +
            '🔧 Возвращен в режим управления ботом.\n' +
            '💾 Настройка сохранена\n' +
            'Используйте /togglechat чтобы включить снова.'
        );

        logInfo(`❌ LLM Chat выключен для пользователя ${chatId} (сохранено)`);
    }
}

/**
 * Показывает текущее состояние LLM чата
 */
async function showLLMChatStatus(chatId) {
    const status = llmChatEnabled ? '✅ Включен' : '❌ Выключен';
    const model = getModelForChat(chatId);
    const context = chatContexts.get(chatId) || [];

    await sendMessage(chatId,
        '📊 <b>Состояние LLM чата</b>\n\n' +
        `🔧 Статус: ${status}\n` +
        `🤖 Модель: <code>${model}</code>\n` +
        `💬 Сообщений в контексте: ${context.length}\n\n` +
        `💡 Используйте /togglechat чтобы ${llmChatEnabled ? 'выключить' : 'включить'} LLM чат`
    );

    logInfo(`📊 Проверка статуса LLM чата: ${llmChatEnabled ? 'включен' : 'выключен'}`);
}

/**
 * Обрабатывает команду /setmodel
 */
async function handleSetModel(chatId, text) {
    const parts = text.trim().split(/\s+/);

    // Если нет аргумента - показываем текущую модель
    if (parts.length < 2) {
        await showModelInfo(chatId);
        return;
    }

    const requestedModel = parts[1].trim();
    const { getAvailableModelsFromFile } = await import('../api/chat.js');
    const availableModels = getAvailableModelsFromFile();

    // Проверяем что модель существует
    if (!availableModels.includes(requestedModel)) {
        await sendMessage(chatId,
            '❌ <b>Модель не найдена</b>\n\n' +
            `Модель <code>${requestedModel}</code> не найдена в списке доступных.\n\n` +
            '<b>Используйте /model для списка доступных моделей</b>'
        );
        logWarn(`❌ Пользователь ${chatId} попытался установить несуществующую модель: ${requestedModel}`);
        return;
    }

    // Устанавливаем глобальную активную модель
    activeModel = requestedModel;

    // Сохраняем в файл
    const settings = loadBotSettings();
    settings.activeModel = requestedModel;
    saveBotSettings(settings);

    await sendMessage(chatId,
        '✅ <b>Модель изменена!</b>\n\n' +
        `🤖 Новая модель: <code>${requestedModel}</code>\n` +
        '💬 Будет использоваться во всех чатах\n' +
        '💾 Настройка сохранена\n\n' +
        '💡 Для сброса используйте /clear'
    );

    logInfo(`✅ Установлена глобальная модель: ${requestedModel} (сохранено)`);
}

/**
 * Получает активную модель
 * Приоритет: activeModel из настроек > default из config
 */
function getModelForChat(chatId) {
    // Если установлена активная модель, используем её
    if (activeModel) {
        return activeModel;
    }

    // Возвращаем модель из настроек бота
    return getBotSettingsModel();
}

/**
 * Получает глобальную активную модель (для использования в API)
 * Экспортируется для использования в routes.js
 * @returns {string|null} activeModel или null
 */
export function getActiveModel() {
    return activeModel;
}

/**
 * Показывает информацию о модели
 */
async function showModelInfo(chatId) {
    const currentModel = getModelForChat(chatId);
    const context = chatContexts.get(chatId) || [];
    const { getAvailableModelsFromFile } = await import('../api/chat.js');
    const availableModels = getAvailableModelsFromFile();

    const message =
        '📊 <b>Информация о модели</b>\n\n' +
        `🤖 Активная модель: <code>${currentModel}</code>\n` +
        `💬 Сообщений в контексте: ${context.length}\n` +
        `🔧 LLM чат: ${llmChatEnabled ? '✅ Включен' : '❌ Выключен'}\n\n` +
        '<b>Доступные модели:</b>\n' +
        availableModels.map((m) => `<code>${m}</code>`).join(', ') +
        '\n\n💡 Для смены модели используйте:\n' +
        '/setmodel &lt;название_модели&gt;\n' +
        'Например: /setmodel qwen3-max';

    await sendMessage(chatId, message);
}

/**
 * Очищает контекст чата
 */
async function clearChatContext(chatId) {
    chatContexts.set(chatId, []);

    await sendMessage(chatId,
        '🗑️ <b>Контекст чата очищен</b>\n\n' +
        '💬 Новая история чата начата.\n' +
        `🤖 LLM чат: ${llmChatEnabled ? '✅ Включен' : '❌ Выключен'}`
    );

    logInfo(`🗑️ Контекст чата очищен для пользователя ${chatId}`);
}

/**
 * Отправляет индикатор действия в Telegram
 */
async function sendChatAction(chatId, action) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`;
        await fetchWithProxy(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                action: action // 'typing', 'upload_photo', etc.
            })
        });
    } catch (error) {
        logWarn('Не удалось отправить chat action', error);
    }
}

/**
 * Разбивает длинное сообщение на части
 */
function splitMessage(text, maxLength) {
    const chunks = [];
    let remaining = text;

    while (remaining.length > maxLength) {
        // Ищем подходящее место для разреза (конец строки или пробел)
        let splitIndex = remaining.lastIndexOf('\n', maxLength);

        if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
            splitIndex = remaining.lastIndexOf(' ', maxLength);
        }

        if (splitIndex === -1) {
            splitIndex = maxLength;
        }

        chunks.push(remaining.substring(0, splitIndex).trim());
        remaining = remaining.substring(splitIndex).trim();
    }

    if (remaining) {
        chunks.push(remaining);
    }

    return chunks;
}

/**
 * Экранирует HTML специальные символы
 */
function escapeHtml(text) {
    if (!text) { return ''; }
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Экранирует текст для вставки в <pre> тег (только < и &)
 */
function escapeHtmlForCode(text) {
    if (!text) { return ''; }
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
