import fs from 'fs';
import path from 'path';
import { logInfo, logWarn, logError, logDebug } from '../logger/index.js';
import { LOGS_DIR, PAGE_EVALUATE_SCREENCAST_TIMEOUT, PAGE_EVALUATE_SCREENCAST_MAX_DURATION } from '../config.js';

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

    let screencastStarted = false;
    let screencastStopper = null;
    let timer = null;
    let maxDurationTimer = null;

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
                    const filepath = path.join(screencastDir, filename);

                    // Start screencast
                    screencastStopper = await page.screencast({
                        path: filepath,
                        format: 'webm'
                    });

                    screencastStarted = true;
                    ffmpegAvailable = true; // Mark as available if successful
                    logInfo(`🎥 Запись экрана начата: ${filepath}`);

                    // Set maximum duration timer if configured
                    if (SCREENCAST_MAX_DURATION && SCREENCAST_MAX_DURATION > 0) {
                        logDebug(`⏱️ Установлен лимит записи: ${SCREENCAST_MAX_DURATION}ms`);
                        maxDurationTimer = setTimeout(async () => {
                            try {
                                logWarn(`⏱️ Достигнут максимальный лимит записи (${SCREENCAST_MAX_DURATION}ms), останавливаю...`);
                                if (screencastStopper) {
                                    await screencastStopper.stop();
                                    screencastStopper = null;
                                    logInfo('🎥 Запись экрана остановлена (достигнут лимит времени)');
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

        throw error;
    }
}
