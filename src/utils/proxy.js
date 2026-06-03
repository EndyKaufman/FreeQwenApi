import { ProxyAgent } from 'proxy-agent';
import { TELEGRAM_PROXY, QWEN_PROXY, FILE_DOWNLOAD_PROXY } from '../config.js';
import { logInfo, logWarn, logDebug } from '../logger/index.js';

// Кэш прокси агентов (создаются один раз)
let telegramProxyAgent = null;
let qwenProxyAgent = null;
let fileDownloadProxyAgent = null;
let telegramProxyInitialized = false;
let qwenProxyInitialized = false;
let fileDownloadProxyInitialized = false;

/**
 * Получить ProxyAgent для Telegram
 * Агент кэшируется для повторного использования
 * @returns {ProxyAgent|null} - ProxyAgent или null если прокси не настроен
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
        telegramProxyAgent = new ProxyAgent(TELEGRAM_PROXY);
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
 * @returns {ProxyAgent|null} - ProxyAgent или null если прокси не настроен
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
        qwenProxyAgent = new ProxyAgent(QWEN_PROXY);
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
 * @returns {ProxyAgent|null} - ProxyAgent или null если прокси не настроен
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
        fileDownloadProxyAgent = new ProxyAgent(FILE_DOWNLOAD_PROXY);
        fileDownloadProxyInitialized = true;
        logInfo('✅ Прокси для скачивания файлов успешно инициализирован');
        return fileDownloadProxyAgent;
    } catch (error) {
        logError(`❌ Ошибка инициализации прокси для скачивания файлов`, error);
        fileDownloadProxyInitialized = true;
        fileDownloadProxyAgent = null;
        return null;
    }
}

/**
 * Замаскировать URL прокси для логирования (скрыть credentials)
 * @param {string} url - URL прокси
 * @returns {string} - Замаскированный URL
 */
function maskProxyUrl(url) {
    if (!url) return 'none';
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
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции fetch
 * @returns {Promise<Response>} - Response от fetch
 */
export async function fetchWithTelegramProxy(url, options = {}) {
    const proxyAgent = getTelegramProxyAgent();
    
    // Если прокси не настроен, используем обычный fetch
    if (!proxyAgent) {
        return fetch(url, options);
    }

    // Используем node-fetch с agent опцией
    const { default: nodeFetch } = await import('node-fetch');
    
    logDebug(`📱 Запрос к Telegram через прокси: ${url}`);
    
    return nodeFetch(url, {
        ...options,
        agent: proxyAgent
    });
}

/**
 * Выполнить fetch запрос к Qwen LLM через прокси (если настроен)
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции fetch
 * @returns {Promise<Response>} - Response от fetch
 */
export async function fetchWithQwenProxy(url, options = {}) {
    const proxyAgent = getQwenProxyAgent();
    
    // Если прокси не настроен, используем обычный fetch
    if (!proxyAgent) {
        return fetch(url, options);
    }

    // Используем node-fetch с agent опцией
    const { default: nodeFetch } = await import('node-fetch');
    
    logDebug(`🧠 Запрос к Qwen LLM через прокси: ${url}`);
    
    return nodeFetch(url, {
        ...options,
        agent: proxyAgent
    });
}

/**
 * Проверить доступен ли прокси для Telegram
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

        const { default: nodeFetch } = await import('node-fetch');
        
        // Тестовый запрос к Telegram API
        const response = await nodeFetch('https://api.telegram.org/bot', {
            agent: proxyAgent,
            timeout: 5000
        });

        return response.ok || response.status === 404; // 404 ok for this endpoint
    } catch (error) {
        logWarn(`⚠️ Прокси для Telegram недоступен: ${error.message}`);
        return false;
    }
}

/**
 * Проверить доступен ли прокси для Qwen LLM
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

        const { default: nodeFetch } = await import('node-fetch');
        
        // Тестовый запрос к Qwen API
        const response = await nodeFetch('https://chat.qwen.ai', {
            agent: proxyAgent,
            timeout: 5000
        });

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
        }
    };
}
