import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError, logDebug } from '../logger/index.js';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_USER_IDS } from '../config.js';
import { fetchWithVersionCheckProxy, getVersionCheckProxyAgent, fetchWithTelegramProxy } from './proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');

// Состояние для отслеживания последних уведомлений
let lastDockerNotification = null;
let lastNpmNotification = null;
let lastGitNotification = null;

/**
 * Определяет режим запуска приложения
 */
function getRunMode() {
    // Проверяем, запущено ли из Docker
    if (fs.existsSync('/.dockerenv')) {
        return 'docker';
    }

    // Проверяем, запущено ли как npm пакет (global CLI)
    const isGlobalInstall = process.env.QWEN_API_PROXY_GLOBAL === 'true';
    if (isGlobalInstall) {
        return 'npm';
    }

    // Иначе - запущено из кода/репозитория
    return 'git';
}

/**
 * Получает текущую версию из package.json
 */
export function getCurrentVersion() {
    try {
        const packageJsonPath = path.join(PACKAGE_ROOT, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        return packageJson.version;
    } catch (error) {
        logError('Ошибка чтения package.json', error);
        return null;
    }
}

/**
 * Универсальная функция fetch с обработкой ошибок и поддержкой прокси
 */
async function safeFetch(url, options = {}) {
    try {
        const proxyAgent = getVersionCheckProxyAgent();
        const response = await fetchWithVersionCheckProxy(url, {
            ...options,
            headers: {
                'User-Agent': 'qwen-api-proxy-version-checker/1.0',
                ...options.headers
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
    } catch (error) {
        logDebug(`Ошибка запроса к ${url}: ${error.message}`);
        throw error;
    }
}

/**
 * Проверяет последнюю версию Docker Hub
 */
export async function checkDockerVersion() {
    try {
        logDebug('Проверка версии Docker Hub...');

        // Получаем теги с Docker Hub
        const response = await safeFetch(
            'https://hub.docker.com/v2/repositories/endykaufman/qwen-api-proxy/tags/?page_size=10&ordering=last_updated'
        );

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            logDebug('Не найдено тегов Docker Hub');
            return null;
        }

        // Ищем последний стабильный тег (не latest и не SHA-хеши)
        const stableTags = data.results.filter((tag) => {
            // Исключаем тег 'latest'
            if (tag.name === 'latest') {
                return false;
            }
            // Исключаем SHA-хеши (начинаются с 'sha-' или содержат только hex-символы)
            if (tag.name.startsWith('sha-') || /^[a-f0-9]{7,}$/i.test(tag.name)) {
                return false;
            }
            // Принимаем только теги, которые выглядят как версии (содержат цифры)
            return /\d/.test(tag.name);
        });

        if (stableTags.length === 0) {
            logDebug('Не найдено стабильных тегов Docker Hub');
            return null;
        }

        const latestTag = stableTags[0];

        return {
            version: latestTag.name,
            published: latestTag.last_updated,
            publishedDate: new Date(latestTag.last_updated)
        };
    } catch (error) {
        logError('Ошибка проверки версии Docker Hub', error);
        return null;
    }
}

/**
 * Проверяет последнюю версию в npm registry
 */
export async function checkNpmVersion() {
    try {
        logDebug('Проверка версии npm registry...');

        const response = await safeFetch('https://registry.npmjs.org/qwen-api-proxy/latest');
        const data = await response.json();

        return {
            version: data.version,
            published: data.time?.created || data.time?.modified,
            publishedDate: new Date(data.time?.created || data.time?.modified)
        };
    } catch (error) {
        logError('Ошибка проверки версии npm registry', error);
        return null;
    }
}

/**
 * Проверяет последнюю версию в Git repository (GitHub)
 */
export async function checkGitVersion() {
    try {
        logDebug('Проверка версии Git repository...');

        // Получаем package.json из ветки main
        const response = await safeFetch(
            'https://raw.githubusercontent.com/EndyKaufman/FreeQwenApi/main/package.json'
        );

        const packageJson = await response.json();
        const version = packageJson.version || null;

        if (!version) {
            logDebug('Не удалось прочитать версию из package.json');
            return null;
        }

        // Получаем информацию о последнем коммите для даты
        const commitResponse = await safeFetch(
            'https://api.github.com/repos/EndyKaufman/FreeQwenApi/commits/main'
        );

        const commitData = await commitResponse.json();
        const commitDate = commitData.commit?.committer?.date || null;

        return {
            version: version,
            published: commitDate,
            publishedDate: commitDate ? new Date(commitDate) : new Date()
        };
    } catch (error) {
        logError('Ошибка проверки версии GitHub', error);
        return null;
    }
}

/**
 * Получает ссылку на источник в зависимости от режима
 */
function getSourceUrl(runMode) {
    switch (runMode) {
    case 'docker':
        return 'https://hub.docker.com/r/endykaufman/qwen-api-proxy/tags';
    case 'npm':
        return 'https://www.npmjs.com/package/qwen-api-proxy';
    case 'git':
        return 'https://github.com/EndyKaufman/FreeQwenApi';
    default:
        return null;
    }
}

/**
 * Получает название источника в зависимости от режима
 */
function getSourceName(runMode) {
    switch (runMode) {
    case 'docker':
        return 'Docker Hub';
    case 'npm':
        return 'npm';
    case 'git':
        return 'GitHub';
    default:
        return 'unknown';
    }
}

/**
 * Форматирует дату в читаемый формат
 */
function formatDate(date) {
    if (!date || isNaN(date.getTime())) {
        return 'неизвестно';
    }

    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Форматирует относительное время (сколько времени прошло)
 */
function formatRelativeTime(date) {
    if (!date || isNaN(date.getTime())) {
        return '';
    }

    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `${diffDays} дн. назад`;
    } else if (diffHours > 0) {
        return `${diffHours} ч. назад`;
    } else {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `${diffMinutes} мин. назад`;
    }
}

/**
 * Отправляет уведомление в Telegram
 */
async function sendTelegramNotification(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_USER_IDS || TELEGRAM_USER_IDS.length === 0) {
        return false;
    }

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const notifications = TELEGRAM_USER_IDS.map(async (userId) => {
        try {
            // Используем прокси для Telegram (если настроен)
            const response = await fetchWithTelegramProxy(telegramUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chat_id: userId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            if (response.ok) {
                logDebug(`Telegram уведомление отправлено пользователю ${userId}`);
                return true;
            } else {
                const errorBody = await response.text();
                logError(`Ошибка отправки Telegram пользователю ${userId}: ${errorBody}`);
                return false;
            }
        } catch (error) {
            logError(`Ошибка при отправке Telegram уведомления пользователю ${userId}`, error);
            return false;
        }
    });

    const results = await Promise.all(notifications);
    return results.some((r) => r);
}

/**
 * Проверяет нужно ли отправлять уведомление (раз в сутки днем)
 */
function shouldNotify(lastNotification, currentNotification) {
    if (!lastNotification) {
        return true;
    }

    const now = new Date();
    const lastNotify = new Date(lastNotification);

    // Проверяем прошло ли 24 часа
    const diffHours = (now - lastNotify) / (1000 * 60 * 60);
    if (diffHours < 24) {
        return false;
    }

    // Проверяем что сейчас дневное время (10:00 - 18:00)
    const currentHour = now.getHours();
    if (currentHour < 10 || currentHour > 18) {
        return false;
    }

    return true;
}

/**
 * Главная функция проверки обновлений
 */
export async function checkForUpdates(sendNotification = true) {
    const runMode = getRunMode();
    const currentVersion = getCurrentVersion();

    if (!currentVersion) {
        logDebug('Не удалось определить текущую версию');
        return null;
    }

    logInfo(`🔍 Проверка обновлений (режим: ${runMode}, текущая версия: ${currentVersion})...`);

    let updateInfo = null;

    try {
        // Проверяем версию в зависимости от режима
        let latestVersion = null;

        if (runMode === 'docker') {
            latestVersion = await checkDockerVersion();
        } else if (runMode === 'npm') {
            latestVersion = await checkNpmVersion();
        } else {
            latestVersion = await checkGitVersion();
        }

        if (!latestVersion) {
            logDebug('Не удалось получить информацию о последней версии');
            return null;
        }

        // Сравниваем версии
        if (latestVersion.version !== currentVersion) {
            updateInfo = {
                currentVersion: currentVersion,
                latestVersion: latestVersion.version,
                publishedDate: latestVersion.publishedDate,
                runMode: runMode
            };

            const publishedStr = formatDate(latestVersion.publishedDate);
            const relativeTime = formatRelativeTime(latestVersion.publishedDate);

            // Выводим в консоль
            logInfo(`📦 Доступна новая версия: ${latestVersion.version} (текущая: ${currentVersion})`);
            logInfo(`📅 Опубликована: ${publishedStr} (${relativeTime})`);
            logInfo(`🔗 Режим: ${runMode}`);

            // Отправляем уведомление в Telegram если нужно
            if (sendNotification) {
                const lastNotification = runMode === 'docker'
                    ? lastDockerNotification
                    : runMode === 'npm'
                        ? lastNpmNotification
                        : lastGitNotification;

                if (shouldNotify(lastNotification, latestVersion.publishedDate)) {
                    const sourceUrl = getSourceUrl(runMode);
                    const sourceName = getSourceName(runMode);

                    let message =
                        '📦 <b>Доступно обновление!</b>\n\n' +
                        `🔹 Текущая версия: ${currentVersion}\n` +
                        `🔹 Новая версия: ${latestVersion.version}\n` +
                        `📅 Опубликована: ${publishedStr}\n` +
                        `🕐 ${relativeTime}\n\n` +
                        `🔗 Режим запуска: ${runMode}`;

                    // Добавляем ссылку на источник
                    if (sourceUrl) {
                        message += `\n🌐 Источник: <a href="${sourceUrl}">${sourceName}</a>`;
                    }

                    await sendTelegramNotification(message);

                    // Обновляем время последнего уведомления
                    if (runMode === 'docker') {
                        lastDockerNotification = new Date().toISOString();
                    } else if (runMode === 'npm') {
                        lastNpmNotification = new Date().toISOString();
                    } else {
                        lastGitNotification = new Date().toISOString();
                    }
                }
            }
        } else {
            logDebug(`✅ Используется последняя версия: ${currentVersion}`);
        }
    } catch (error) {
        // Ошибки не должны приводить к падению приложения
        logError('Ошибка при проверке обновлений', error);
    }

    return updateInfo;
}

/**
 * Получает информацию о версии для отображения в заголовке
 */
export async function getVersionInfo() {
    const runMode = getRunMode();
    const currentVersion = getCurrentVersion();

    if (!currentVersion) {
        return null;
    }

    let latestVersion = null;

    try {
        if (runMode === 'docker') {
            latestVersion = await checkDockerVersion();
        } else if (runMode === 'npm') {
            latestVersion = await checkNpmVersion();
        } else {
            latestVersion = await checkGitVersion();
        }
    } catch (error) {
        // Игнорируем ошибки при получении информации о версии
        logDebug('Не удалось получить информацию о последней версии');
    }

    const info = {
        currentVersion: currentVersion,
        runMode: runMode,
        hasUpdate: false,
        latestVersion: null,
        publishedDate: null
    };

    if (latestVersion && latestVersion.version !== currentVersion) {
        info.hasUpdate = true;
        info.latestVersion = latestVersion.version;
        info.publishedDate = latestVersion.publishedDate;
    }

    return info;
}

/**
 * Запускает периодическую проверку обновлений (каждый час)
 */
export function startPeriodicVersionCheck() {
    const CHECK_INTERVAL = 60 * 60 * 1000; // 1 час

    logInfo('⏰ Запущена периодическая проверка обновлений (каждый час)');

    // Проверяем сразу при старте
    checkForUpdates(true).catch((err) => {
        logDebug('Ошибка при первоначальной проверке обновлений:', err.message);
    });

    // Затем проверяем каждый час
    setInterval(() => {
        checkForUpdates(true).catch((err) => {
            logDebug('Ошибка при периодической проверке обновлений:', err.message);
        });
    }, CHECK_INTERVAL);
}
