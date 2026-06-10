import { ProxyAgent as UndiciProxyAgent } from 'undici';
import { ProxyAgent as ProxyAgentPackage } from 'proxy-agent';
import nodeFetch from 'node-fetch';
import { TELEGRAM_PROXY, QWEN_PROXY, FILE_DOWNLOAD_PROXY, VERSION_CHECK_PROXY } from '../config.js';
import { logInfo, logWarn, logDebug, logError } from '../logger/index.js';

// Compatibility layer for Node.js 18-24
// Native fetch (Node.js 18+) uses undici's dispatcher
// node-fetch uses agent option
const useNativeFetch = typeof globalThis.fetch !== 'undefined';

/**
 * Создает правильный агент для текущей версии Node.js
 * @param {string} proxyUrl - URL прокси
 * @returns {Object} - агент для node-fetch ИЛИ dispatcher для native fetch
 */
function createProxyAgent(proxyUrl) {
    // Для native fetch (Node.js 18+) используем Undici ProxyAgent
    if (useNativeFetch) {
        return new UndiciProxyAgent(proxyUrl);
    }
    // Для node-fetch используем proxy-agent
    return new ProxyAgentPackage(proxyUrl);
}

/**
 * Универсальный fetch с поддержкой прокси для Node.js 18-24
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции fetch
 * @param {Object} proxyAgent - Прокси агент (если есть)
 * @returns {Promise<Response>} - Response от fetch
 */
async function universalFetch(url, options = {}, proxyAgent = null) {
    const controller = new AbortController();
    const timeout = options.timeout || 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const fetchOptions = {
            ...options,
            signal: controller.signal
        };

        // Если есть прокси агент
        if (proxyAgent) {
            if (useNativeFetch) {
                // Native fetch (Node.js 18+) использует dispatcher
                fetchOptions.dispatcher = proxyAgent;
            } else {
                // node-fetch использует agent
                fetchOptions.agent = proxyAgent;
            }
        }

        // Используем соответствующий fetch
        const fetchFn = useNativeFetch ? globalThis.fetch : nodeFetch;
        const response = await fetchFn(url, fetchOptions);
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Кэш прокси агентов (создаются один раз)
let telegramProxyAgent = null;
let qwenProxyAgent = null;
let fileDownloadProxyAgent = null;
let versionCheckProxyAgent = null;
let telegramProxyInitialized = false;
let qwenProxyInitialized = false;
let fileDownloadProxyInitialized = false;
let versionCheckProxyInitialized = false;

/**
 * Получить ProxyAgent для Telegram
 * Агент кэшируется для повторного использования
 * @returns {Object|null} - ProxyAgent или null если прокси не настроен
 */
function getTelegramProxyAgent() {
    if (telegramProxyInitialized) {
        return telegramProxyAgent;
    }

    if (!TELEGRAM_PROXY) {
        telegramProxyInitialized = true;
        telegramProxyAgent = null;
        return null;
    }

    try {
        logInfo(`📱 Инициализация прокси для Telegram: ${maskProxyUrl(TELEGRAM_PROXY)}`);
        telegramProxyAgent = createProxyAgent(TELEGRAM_PROXY);
        telegramProxyInitialized = true;
        logInfo('✅ Прокси для Telegram успешно инициализирован');
        return telegramProxyAgent;
    } catch (error) {
        logWarn(`❌ Ошибка инициализации прокси для Telegram: ${error.message}`);
        telegramProxyInitialized = true;
        telegramProxyAgent = null;
        return null;
    }
}

/**
 * Получить ProxyAgent для Qwen LLM
 * Агент кэшируется для повторного использования
 * @returns {Object|null} - ProxyAgent или null если прокси не настроен
 */
function getQwenProxyAgent() {
    if (qwenProxyInitialized) {
        return qwenProxyAgent;
    }

    if (!QWEN_PROXY) {
        qwenProxyInitialized = true;
        qwenProxyAgent = null;
        return null;
    }

    try {
        logInfo(`🧠 Инициализация прокси для Qwen LLM: ${maskProxyUrl(QWEN_PROXY)}`);
        qwenProxyAgent = createProxyAgent(QWEN_PROXY);
        qwenProxyInitialized = true;
        logInfo('✅ Прокси для Qwen LLM успешно инициализирован');
        return qwenProxyAgent;
    } catch (error) {
        logWarn(`❌ Ошибка инициализации прокси для Qwen LLM: ${error.message}`);
        qwenProxyInitialized = true;
        qwenProxyAgent = null;
        return null;
    }
}

/**
 * Получить ProxyAgent для скачивания файлов
 * Агент кэшируется для повторного использования
 * @returns {Object|null} - ProxyAgent или null если прокси не настроен
 */
export function getFileDownloadProxyAgent() {
    if (fileDownloadProxyInitialized) {
        logDebug(`📥 getFileDownloadProxyAgent: возвращаем кэшированный агент (${fileDownloadProxyAgent ? 'есть' : 'null'})`);
        return fileDownloadProxyAgent;
    }

    if (!FILE_DOWNLOAD_PROXY) {
        logWarn('⚠️ FILE_DOWNLOAD_PROXY не настроен в .env');
        fileDownloadProxyInitialized = true;
        fileDownloadProxyAgent = null;
        return null;
    }

    try {
        logInfo(`📥 Инициализация прокси для скачивания файлов: ${maskProxyUrl(FILE_DOWNLOAD_PROXY)}`);
        fileDownloadProxyAgent = createProxyAgent(FILE_DOWNLOAD_PROXY);
        fileDownloadProxyInitialized = true;
        logInfo('✅ Прокси для скачивания файлов успешно инициализирован');
        return fileDownloadProxyAgent;
    } catch (error) {
        logError('❌ Ошибка инициализации прокси для скачивания файлов', error);
        fileDownloadProxyInitialized = true;
        fileDownloadProxyAgent = null;
        return null;
    }
}

/**
 * Получить ProxyAgent для проверки обновлений
 * Агент кэшируется для повторного использования
 * @returns {Object|null} - ProxyAgent или null если прокси не настроен
 */
export function getVersionCheckProxyAgent() {
    if (versionCheckProxyInitialized) {
        logDebug(`🔍 getVersionCheckProxyAgent: возвращаем кэшированный агент (${versionCheckProxyAgent ? 'есть' : 'null'})`);
        return versionCheckProxyAgent;
    }

    if (!VERSION_CHECK_PROXY) {
        logDebug('⚠️ VERSION_CHECK_PROXY не настроен в .env');
        versionCheckProxyInitialized = true;
        versionCheckProxyAgent = null;
        return null;
    }

    try {
        logInfo(`🔍 Инициализация прокси для проверки обновлений: ${maskProxyUrl(VERSION_CHECK_PROXY)}`);
        versionCheckProxyAgent = createProxyAgent(VERSION_CHECK_PROXY);
        versionCheckProxyInitialized = true;
        logInfo('✅ Прокси для проверки обновлений успешно инициализирован');
        return versionCheckProxyAgent;
    } catch (error) {
        logError('❌ Ошибка инициализации прокси для проверки обновлений', error);
        versionCheckProxyInitialized = true;
        versionCheckProxyAgent = null;
        return null;
    }
}

/**
 * Замаскировать URL прокси для логирования (скрыть credentials)
 * @param {string} url - URL прокси
 * @returns {string} - Замаскированный URL
 */
function maskProxyUrl(url) {
    if (!url) {return 'none';}
    try {
        const parsed = new URL(url);
        if (parsed.username || parsed.password) {
            return `${parsed.protocol}//***:***@${parsed.hostname}:${parsed.port}`;
        }
        return url;
    } catch {
        return 'invalid-url';
    }
}

/**
 * Выполнить fetch запрос к Telegram через прокси (если настроен)
 * Совместимо с Node.js 18-24
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции fetch
 * @param {number} timeout - Таймаут в мс (по умолчанию 30000)
 * @returns {Promise<Response>} - Response от fetch
 */
export async function fetchWithTelegramProxy(url, options = {}, timeout = 30000) {
    const proxyAgent = getTelegramProxyAgent();
    return await universalFetch(url, { ...options, timeout }, proxyAgent);
}

/**
 * Выполнить fetch запрос к Qwen LLM через прокси (если настроен)
 * Совместимо с Node.js 18-24
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции fetch
 * @param {number} timeout - Таймаут в мс (по умолчанию 30000)
 * @returns {Promise<Response>} - Response от fetch
 */
export async function fetchWithQwenProxy(url, options = {}, timeout = 30000) {
    const proxyAgent = getQwenProxyAgent();
    return await universalFetch(url, { ...options, timeout }, proxyAgent);
}

/**
 * Выполнить fetch запрос для проверки обновлений через прокси (если настроен)
 * Совместимо с Node.js 18-24
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции fetch
 * @param {number} timeout - Таймаут в мс (по умолчанию 30000)
 * @returns {Promise<Response>} - Response от fetch
 */
export async function fetchWithVersionCheckProxy(url, options = {}, timeout = 30000) {
    const proxyAgent = getVersionCheckProxyAgent();
    return await universalFetch(url, { ...options, timeout }, proxyAgent);
}

/**
 * Проверить доступен ли прокси для Telegram
 * Совместимо с Node.js 18-24
 * @returns {Promise<boolean>} - true если прокси доступен
 */
export async function checkTelegramProxyAvailability() {
    if (!TELEGRAM_PROXY) {
        return false;
    }

    try {
        const proxyAgent = getTelegramProxyAgent();
        if (!proxyAgent) {
            return false;
        }

        // Тестовый запрос к Telegram API (совместимо с Node.js 18-24)
        const response = await universalFetch('https://api.telegram.org/bot', { timeout: 5000 }, proxyAgent);

        return response.ok || response.status === 404; // 404 ok for this endpoint
    } catch (error) {
        logWarn(`⚠️ Прокси для Telegram недоступен: ${error.message}`);
        return false;
    }
}

/**
 * Проверить доступен ли прокси для Qwen LLM
 * Совместимо с Node.js 18-24
 * @returns {Promise<boolean>} - true если прокси доступен
 */
export async function checkQwenProxyAvailability() {
    if (!QWEN_PROXY) {
        return false;
    }

    try {
        const proxyAgent = getQwenProxyAgent();
        if (!proxyAgent) {
            return false;
        }

        // Тестовый запрос к Qwen API (совместимо с Node.js 18-24)
        const response = await universalFetch('https://chat.qwen.ai', { timeout: 5000 }, proxyAgent);

        return response.ok || response.status === 302; // 302 is ok for redirect
    } catch (error) {
        logWarn(`⚠️ Прокси для Qwen LLM недоступен: ${error.message}`);
        return false;
    }
}

/**
 * Получить информацию о текущей конфигурации прокси
 * @returns {Object} - Информация о прокси
 */
export function getProxyInfo() {
    return {
        telegram: {
            configured: !!TELEGRAM_PROXY,
            url: maskProxyUrl(TELEGRAM_PROXY),
            active: telegramProxyInitialized && telegramProxyAgent !== null
        },
        qwen: {
            configured: !!QWEN_PROXY,
            url: maskProxyUrl(QWEN_PROXY),
            active: qwenProxyInitialized && qwenProxyAgent !== null
        },
        fileDownload: {
            configured: !!FILE_DOWNLOAD_PROXY,
            url: maskProxyUrl(FILE_DOWNLOAD_PROXY),
            active: fileDownloadProxyInitialized && fileDownloadProxyAgent !== null
        },
        versionCheck: {
            configured: !!VERSION_CHECK_PROXY,
            url: maskProxyUrl(VERSION_CHECK_PROXY),
            active: versionCheckProxyInitialized && versionCheckProxyAgent !== null
        }
    };
}
