import { logInfo, logError, logWarn } from '../logger/index.js';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_USER_IDS } from '../config.js';
import { fetchWithTelegramProxy } from './proxy.js';

/**
 * Отправляет уведомление в Telegram
 * @param {string} message - Текст сообщения
 * @returns {Promise<boolean>} - Успешность отправки
 */
export async function sendTelegramNotification(message) {
    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_USER_IDS.length === 0) {
        logWarn('Telegram уведомления не настроены (отсутствует токен или ID пользователей)');
        return false;
    }

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const notifications = TELEGRAM_USER_IDS.map(async (userId) => {
        try {
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
                logInfo(`Telegram уведомление отправлено пользователю ${userId}`);
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
    const successCount = results.filter((r) => r).length;

    if (successCount > 0) {
        logInfo(`Telegram уведомления отправлены: ${successCount}/${TELEGRAM_USER_IDS.length} успешно`);
        return true;
    }

    logError('Не удалось отправить Telegram уведомления ни одному пользователю');
    return false;
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
