import fs from 'fs';
import path from 'path';
import { logInfo, logWarn, logError, logDebug } from '../logger/index.js';
import { LOGS_DIR, PAGE_EVALUATE_SCREENCAST_TIMEOUT, PAGE_EVALUATE_SCREENCAST_MAX_DURATION, PUPPETEER_PROTOCOL_TIMEOUT } from '../config.js';
import { sendTelegramVideo } from '../utils/telegramNotifier.js';

// Get screencast timeout from config (in milliseconds)
// Default: 0 (disabled)
const SCREENCAST_TIMEOUT = PAGE_EVALUATE_SCREENCAST_TIMEOUT;

// Get maximum screencast duration from config (in milliseconds)
// Default: 0 (no limit)
const SCREENCAST_MAX_DURATION = PAGE_EVALUATE_SCREENCAST_MAX_DURATION;

// Track if ffmpeg is available
let ffmpegAvailable = true;

/**
 * Wrapper over page.evaluate() that starts screen recording after timeout
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {Function|string} pageFunction - Function to evaluate in browser context
 * @param {*} args - Arguments to pass to the function
 * @returns {Promise<*>} Result of the evaluation
 */
export async function pageEvaluateWithScreencast(page, pageFunction, ...args) {
    // If screencast timeout is 0 or not set, use regular page.evaluate()
    if (!SCREENCAST_TIMEOUT || SCREENCAST_TIMEOUT <= 0) {
        return await page.evaluate(pageFunction, ...args);
    }

    const startTime = Date.now();
    let screencastStarted = false;
    let screencastStopper = null;
    let timer = null;
    let maxDurationTimer = null;
    let screencastFilepath = null;
    let screencastSent = false; // Track if video was already sent to Telegram

    try {
        // Create screencasts directory in logs folder
        const screencastDir = path.join(process.cwd(), LOGS_DIR, 'screencasts');
        if (!fs.existsSync(screencastDir)) {
            fs.mkdirSync(screencastDir, { recursive: true });
        }

        // Start timer to begin screencast after timeout
        const screencastPromise = new Promise((resolve) => {
            timer = setTimeout(async () => {
                // Skip if ffmpeg was previously detected as unavailable
                if (!ffmpegAvailable) {
                    logDebug('⏭️ Запись экрана пропущена: ffmpeg недоступен');
                    resolve();
                    return;
                }

                try {
                    logWarn(`⏱️ page.evaluate() выполняется дольше ${SCREENCAST_TIMEOUT}ms, начинаем запись экрана...`);

                    // Generate filename with timestamp
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const filename = `screencast-${timestamp}.webm`;
                    screencastFilepath = path.join(screencastDir, filename);

                    // Start screencast
                    screencastStopper = await page.screencast({
                        path: screencastFilepath,
                        format: 'webm'
                    });

                    screencastStarted = true;
                    ffmpegAvailable = true; // Mark as available if successful
                    logInfo(`🎥 Запись экрана начата: ${screencastFilepath}`);

                    // Set maximum duration timer if configured
                    if (SCREENCAST_MAX_DURATION && SCREENCAST_MAX_DURATION > 0) {
                        logDebug(`⏱️ Установлен лимит записи: ${SCREENCAST_MAX_DURATION}ms`);
                        maxDurationTimer = setTimeout(async () => {
                            try {
                                logWarn(`⏱️ Достигнут максимальный лимит записи (${SCREENCAST_MAX_DURATION}ms), останавливаю...`);
                                if (screencastStopper) {
                                    screencastStopper.stop().catch(logError);
                                    screencastStopper = null;
                                    logInfo('🎥 Запись экрана остановлена (достигнут лимит времени)');

                                    // Send video to Telegram immediately when max duration is reached
                                    logDebug('🔍 Проверка условий для отправки в Telegram...');
                                    logDebug(`   screencastFilepath: ${screencastFilepath}`);
                                    logDebug(`   Файл существует: ${screencastFilepath ? fs.existsSync(screencastFilepath) : 'N/A'}`);

                                    if (screencastFilepath && fs.existsSync(screencastFilepath)) {
                                        // Wait a bit for the file to be fully written to disk
                                        await new Promise((resolve) => setTimeout(resolve, 1000));

                                        const elapsed = Date.now() - startTime;
                                        try {
                                            const fileSize = fs.statSync(screencastFilepath).size;
                                            const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

                                            // Check if file is too small (likely not fully written or invalid)
                                            if (fileSize < 1024) {
                                                logWarn(`⚠️ Файл слишком маленький (${fileSize} байт), возможно не успел записаться. Пропускаю отправку.`);
                                            } else {
                                                logInfo(`📤 Отправка записи в Telegram (макс. длительность): ${screencastFilepath} (${fileSizeMB} MB)`);

                                                const caption = `⏱️ page.evaluate() превышает ${SCREENCAST_MAX_DURATION}ms\n` +
                                                    `⏰ Текущее время: ${elapsed}ms (все еще выполняется)\n` +
                                                    `📁 Размер файла: ${fileSizeMB} MB\n` +
                                                    `🔍 Запись началась после: ${SCREENCAST_TIMEOUT}ms\n` +
                                                    '⚠️ Достигнут лимит maxDuration';

                                                logDebug('📡 Вызов sendTelegramVideo...');
                                                logDebug(`   Caption длина: ${caption.length} символов`);
                                                logDebug(`   Файл размер: ${fileSize} байт`);

                                                const sendResult = await sendTelegramVideo(caption, screencastFilepath);
                                                logDebug(`   sendTelegramVideo вернул: ${sendResult}`);

                                                if (sendResult) {
                                                    logInfo('✅ Запись успешно отправлена в Telegram');
                                                    screencastSent = true; // Mark as sent
                                                } else {
                                                    logWarn('⚠️ sendTelegramVideo вернул false - видео не отправлено');
                                                }
                                            }
                                        } catch (telegramError) {
                                            logError('❌ Ошибка при отправке записи в Telegram:', telegramError);
                                            logError('   Error stack:', telegramError.stack);
                                        }
                                    } else {
                                        logWarn('⚠️ Видео не отправлено: файл не существует или путь не установлен');
                                    }
                                }
                            } catch (error) {
                                logError('Ошибка при остановке записи экрана по лимиту времени:', error);
                            }
                        }, SCREENCAST_MAX_DURATION);
                    }
                } catch (error) {
                    // Check if error is due to missing ffmpeg
                    if (error.message && error.message.includes('ffmpeg')) {
                        if (ffmpegAvailable) {
                            logError('❌ ffmpeg не установлен. Для записи экрана требуется ffmpeg.');
                            logError('📦 Установка: sudo apt-get install ffmpeg (Ubuntu/Debian)');
                            logError('📦 Установка: brew install ffmpeg (macOS)');
                            logError('⚠️ Запись экрана отключена до установки ffmpeg');
                            ffmpegAvailable = false;
                        }
                    } else {
                        logError('Ошибка при запуске записи экрана:', error);
                    }
                }
                resolve();
            }, SCREENCAST_TIMEOUT);
        });

        // Execute the actual page.evaluate()
        const result = await page.evaluate(pageFunction, ...args);

        // Cancel the timer if evaluate completed before timeout
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }

        // Cancel max duration timer if running
        if (maxDurationTimer) {
            clearTimeout(maxDurationTimer);
            maxDurationTimer = null;
        }

        // Stop screencast if it was started
        if (screencastStarted && screencastStopper) {
            try {
                await screencastStopper.stop();
                logInfo('🎥 Запись экрана остановлена');
            } catch (error) {
                logError('Ошибка при остановке записи экрана:', error);
            }
        }

        // Delete screencast file if page.evaluate completed within protocol timeout
        // and before max duration (if configured)
        if (screencastFilepath && fs.existsSync(screencastFilepath) && !screencastSent) {
            // Wait a bit for the file to be fully written
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const elapsed = Date.now() - startTime;
            const shouldDelete = elapsed < PUPPETEER_PROTOCOL_TIMEOUT &&
                (!SCREENCAST_MAX_DURATION || elapsed < SCREENCAST_MAX_DURATION);

            if (shouldDelete) {
                try {
                    fs.unlinkSync(screencastFilepath);
                    logDebug(`🗑️ Запись удалена: завершено за ${elapsed}ms (в пределах лимита)`);
                    screencastFilepath = null;
                } catch (error) {
                    logError('Ошибка при удалении файла записи:', error);
                }
            } else {
                // Send to Telegram if file exists and wasn't deleted
                try {
                    const fileSize = fs.statSync(screencastFilepath).size;
                    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

                    if (fileSize < 1024) {
                        logWarn(`⚠️ Файл слишком маленький (${fileSize} байт), пропускаю отправку.`);
                    } else {
                        logInfo(`📤 Отправка записи в Telegram: ${screencastFilepath} (${fileSizeMB} MB)`);

                        const caption = '⏱️ Долгая операция page.evaluate()\n' +
                            `⏰ Время выполнения: ${elapsed}ms\n` +
                            `📁 Размер файла: ${fileSizeMB} MB\n` +
                            `🔍 Запись началась после: ${SCREENCAST_TIMEOUT}ms\n` +
                            `⚠️ Превышен лимит: ${elapsed >= PUPPETEER_PROTOCOL_TIMEOUT ? 'protocolTimeout' : 'maxDuration'}`;

                        await sendTelegramVideo(caption, screencastFilepath);
                        logInfo('✅ Запись успешно отправлена в Telegram');
                    }
                } catch (error) {
                    logError('Ошибка при отправке записи в Telegram:', error);
                }
            }
        }

        return result;
    } catch (error) {
        // Stop screencast on error if it was started
        if (screencastStarted && screencastStopper) {
            try {
                await screencastStopper.stop();
                logInfo('🎥 Запись экрана остановлена (после ошибки)');
            } catch (stopError) {
                logError('Ошибка при остановке записи экрана:', stopError);
            }
        }

        // Cancel timer if still pending
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }

        // Cancel max duration timer if running
        if (maxDurationTimer) {
            clearTimeout(maxDurationTimer);
            maxDurationTimer = null;
        }

        // Handle screencast file on error
        if (screencastFilepath && fs.existsSync(screencastFilepath) && !screencastSent) {
            // Wait a bit for the file to be fully written
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const elapsed = Date.now() - startTime;

            try {
                const fileSize = fs.statSync(screencastFilepath).size;
                const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

                if (fileSize < 1024) {
                    logWarn(`⚠️ Файл слишком маленький (${fileSize} байт), пропускаю отправку.`);
                } else {
                    logInfo(`📤 Отправка записи в Telegram (ошибка): ${screencastFilepath} (${fileSizeMB} MB)`);

                    const caption = '❌ Ошибка page.evaluate()\n' +
                        `⏰ Время до ошибки: ${elapsed}ms\n` +
                        `📁 Размер файла: ${fileSizeMB} MB\n` +
                        `🔍 Запись началась после: ${SCREENCAST_TIMEOUT}ms\n` +
                        `💥 Ошибка: ${error.message ? error.message.substring(0, 100) : error.toString()}`;

                    await sendTelegramVideo(caption, screencastFilepath);
                    logInfo('✅ Запись успешно отправлена в Telegram');
                }
            } catch (telegramError) {
                logError('Ошибка при отправке записи в Telegram:', telegramError);
            }
        }

        throw error;
    }
}
