import { logInfo, logError, logWarn, logDebug } from '../logger/index.js';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_USER_IDS, TELEGRAM_PROXY } from '../config.js';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';

// Кэш инстанса бота
let telegramBot = null;
let telegramBotInitialized = false;

/**
 * Получить или создать инстанс TelegramBot с поддержкой прокси
 * @returns {TelegramBot|null} - Инстанс бота или null
 */
function getTelegramBot() {
    if (telegramBotInitialized) {
        return telegramBot;
    }

    if (!TELEGRAM_BOT_TOKEN) {
        logWarn('TELEGRAM_BOT_TOKEN не настроен');
        telegramBotInitialized = true;
        telegramBot = null;
        return null;
    }

    try {
        const options = {
            polling: false // Мы не используем polling, только отправка сообщений
        };

        // Добавляем прокси если настроен
        if (TELEGRAM_PROXY) {
            options.request = {
                proxy: TELEGRAM_PROXY
            };
            logInfo(`📱 Инициализация TelegramBot с прокси: ${maskProxyUrl(TELEGRAM_PROXY)}`);
        } else {
            logInfo('📱 Инициализация TelegramBot без прокси');
        }

        telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, options);
        telegramBotInitialized = true;

        // Обработка ошибок бота
        telegramBot.on('error', (error) => {
            logError('❌ Ошибка TelegramBot:', error);
        });

        logInfo('✅ TelegramBot успешно инициализирован');
        return telegramBot;
    } catch (error) {
        logError('❌ Ошибка инициализации TelegramBot:', error);
        telegramBotInitialized = true;
        telegramBot = null;
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
 * Отправляет уведомление в Telegram
 * @param {string} message - Текст сообщения
 * @returns {Promise<boolean>} - Успешность отправки
 */
export async function sendTelegramNotification(message) {
    const bot = getTelegramBot();
    if (!bot || TELEGRAM_USER_IDS.length === 0) {
        logWarn('Telegram уведомления не настроены (отсутствует токен или ID пользователей)');
        return false;
    }

    const notifications = TELEGRAM_USER_IDS.map(async (userId) => {
        try {
            await bot.sendMessage(userId, message, {
                parse_mode: 'HTML'
            });
            logInfo(`Telegram уведомление отправлено пользователю ${userId}`);
            return true;
        } catch (error) {
            logError(`Ошибка отправки Telegram пользователю ${userId}: ${error.message}`);
            return false;
        }
    });

    const results = await Promise.all(notifications);
    const successCount = results.filter((r) => r).length;

    if (successCount > 0) {
        logInfo(`Telegram уведомления отправлены: ${successCount}/${TELEGRAM_USER_IDS.length} успешно`);
        return true;
    }

    logError('Не удалось отправить Telegram уведомления ни одному пользователю');
    return false;
}

/**
 * Отправляет файл в Telegram (поддержка локальных файлов и URL)
 * @param {string} caption - Текст сообщения (подпись к файлу)
 * @param {string} filePathOrUrl - Путь к локальному файлу ИЛИ URL файла
 * @param {Object} options - Дополнительные опции
 * @param {string} options.filename - Пользовательское имя файла (для URL)
 * @returns {Promise<boolean>} - Успешность отправки
 */
export async function sendTelegramFile(caption, filePathOrUrl, options = {}) {
    const bot = getTelegramBot();
    if (!bot || TELEGRAM_USER_IDS.length === 0) {
        logWarn('Telegram уведомления не настроены (отсутствует токен или ID пользователей)');
        return false;
    }

    const isUrl = filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://');

    const notifications = TELEGRAM_USER_IDS.map(async (userId) => {
        try {
            if (isUrl) {
                // Отправка файла по URL (Telegram скачает файл сам)
                logDebug(`📤 Отправка файла по URL пользователю ${userId}: ${filePathOrUrl}`);

                const sendOptions = {
                    caption: caption,
                    parse_mode: 'HTML'
                };

                if (options.filename) {
                    sendOptions.filename = options.filename;
                }

                await bot.sendDocument(userId, filePathOrUrl, sendOptions);
                logInfo(`Telegram файл (URL) отправлен пользователю ${userId}`);
            } else {
                // Отправка локального файла
                if (!fs.existsSync(filePathOrUrl)) {
                    logError(`Файл не найден: ${filePathOrUrl}`);
                    return false;
                }

                logDebug(`📤 Отправка локального файла пользователю ${userId}: ${filePathOrUrl}`);

                await bot.sendDocument(userId, filePathOrUrl, {
                    caption: caption,
                    parse_mode: 'HTML'
                });
                logInfo(`Telegram файл (локальный) отправлен пользователю ${userId}`);
            }
            return true;
        } catch (error) {
            logError(`❌ Ошибка отправки файла Telegram пользователю ${userId}:`, error);
            return false;
        }
    });

    const results = await Promise.all(notifications);
    const successCount = results.filter((r) => r).length;

    if (successCount > 0) {
        logInfo(`Telegram файлы отправлены: ${successCount}/${TELEGRAM_USER_IDS.length} успешно`);
        return true;
    }

    logError('Не удалось отправить Telegram файл ни одному пользователю');
    return false;
}

/**
 * Отправляет видеофайл в Telegram (как документ, т.к. WebM не поддерживается как видео)
 * @deprecated Используйте sendTelegramFile
 * @param {string} caption - Текст сообщения (подпись к видео)
 * @param {string} videoPath - Путь к видеофайлу
 * @returns {Promise<boolean>} - Успешность отправки
 */
export async function sendTelegramVideo(caption, videoPath) {
    return await sendTelegramFile(caption, videoPath);
}

/**
 * Форматирует сообщение о проблемах с токенами
 * @param {Array} tokens - Массив токенов
 * @returns {string} - Форматированное сообщение
 */
export function formatTokenExpiryMessage(tokens) {
    const now = Date.now();

    let message = '🚨 <b>FreeQwenApi - Проблема с токенами</b>\n\n';
    message += '❌ <b>Все токены недоступны:</b>\n\n';

    tokens.forEach((token, index) => {
        const isInvalid = token.invalid === true;
        const resetTime = token.resetAt ? new Date(token.resetAt).getTime() : null;
        const isExpired = resetTime && resetTime > now;

        message += `<b>${index + 1}. ${token.id}</b>\n`;

        if (isInvalid) {
            message += '   Статус: ❌ Недействителен\n';
        } else if (isExpired) {
            const hoursLeft = Math.ceil((resetTime - now) / 3600000);
            message += `   Статус: ⏰ Истекает через ${hoursLeft} ч.\n`;
            message += `   Сброс: ${new Date(resetTime).toLocaleString('ru-RU')}\n`;
        } else {
            message += '   Статус: ❓ Неизвестно\n';
        }

        message += '\n';
    });

    message += '⚠️ <b>Требуется действие:</b>\n';
    message += '   • Перезапустите авторизацию для обновления токенов\n';
    message += '   • Или дождитесь автоматического сброса лимитов\n';

    return message;
}
