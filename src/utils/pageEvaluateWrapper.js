import fs from 'fs';
import path from 'path';
import { createWorker } from 'tesseract.js';
import { LOGS_DIR, PAGE_EVALUATE_SCREENCAST_MAX_DURATION, PAGE_EVALUATE_SCREENCAST_TIMEOUT, PUPPETEER_PROTOCOL_TIMEOUT } from '../config.js';
import { logDebug, logError, logInfo, logWarn } from '../logger/index.js';
import { sendTelegramVideo } from '../utils/telegramNotifier.js';
import { getAvailableToken } from '../api/tokenManager.js';

// Get screencast timeout from config (in milliseconds)
// Default: 0 (disabled)
const SCREENCAST_TIMEOUT = PAGE_EVALUATE_SCREENCAST_TIMEOUT;

// Get maximum screencast duration from config (in milliseconds)
// Default: 0 (no limit)
const SCREENCAST_MAX_DURATION = PAGE_EVALUATE_SCREENCAST_MAX_DURATION;

// Track if ffmpeg is available
let ffmpegAvailable = true;

// Track if Tesseract worker is initialized
let tesseractWorker = null;
let tesseractInitializing = false;

/**
 * Initialize Tesseract OCR worker at application startup
 * @returns {Promise<boolean>} True if initialized successfully
 */
export async function initializeTesseract() {
    try {
        logInfo('🔤 Initializing Tesseract OCR worker...');
        tesseractWorker = await createWorker('eng', 1, {
            logger: (m) => logDebug(`Tesseract: ${m.status} (${(m.progress * 100).toFixed(0)}%)`)
        });
        logInfo('✅ Tesseract OCR worker initialized successfully');
        return true;
    } catch (error) {
        logError('❌ Failed to initialize Tesseract worker:', error);
        tesseractWorker = null;
        return false;
    }
}

/**
 * Initialize Tesseract OCR worker (singleton)
 * @returns {Promise<Object>} Tesseract worker instance
 */
async function getTesseractWorker() {
    if (tesseractWorker) {
        return tesseractWorker;
    }

    if (tesseractInitializing) {
        // Wait for initialization to complete
        while (tesseractInitializing) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return tesseractWorker;
    }

    tesseractInitializing = true;

    try {
        logInfo('🔤 Initializing Tesseract OCR worker...');
        tesseractWorker = await createWorker('eng', 1, {
            logger: (m) => logDebug(`Tesseract: ${m.status} (${(m.progress * 100).toFixed(0)}%)`)
        });
        logInfo('✅ Tesseract OCR worker initialized');
        return tesseractWorker;
    } catch (error) {
        logError('❌ Failed to initialize Tesseract worker:', error);
        tesseractWorker = null;
        return null;
    } finally {
        tesseractInitializing = false;
    }
}

/**
 * Take screenshot and perform OCR on it
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} screenshotPath - Path to save screenshot
 * @returns {Promise<string|null>} Recognized text or null
 */
export async function takeScreenshotAndOCR(page, screenshotPath) {
    try {
        // Take screenshot using Puppeteer
        await page.screenshot({ path: screenshotPath, type: 'png' });
        logDebug(`📸 Screenshot saved: ${screenshotPath}`);

        // Get Tesseract worker
        const worker = await getTesseractWorker();
        if (!worker) {
            logWarn('⚠️ Tesseract worker not available, skipping OCR');
            return null;
        }

        // Perform OCR
        logDebug('🔤 Performing OCR on screenshot...');
        const { data: { text } } = await worker.recognize(screenshotPath);
        const cleanedText = text.trim();

        if (cleanedText) {
            logDebug(`🔤 OCR recognized text (${cleanedText.length} chars): ${cleanedText.substring(0, 100)}...`);
        } else {
            logDebug('🔤 OCR returned empty text');
        }

        return cleanedText;
    } catch (error) {
        logError('❌ Error during screenshot/OCR:', error);
        return null;
    }
}

/**
 * Check if text contains verification-related keywords
 * @param {string} text - Text to check
 * @returns {boolean} True if verification keywords found
 */
export function isVerificationText(text) {
    if (!text) { return false; }

    const lowerText = text.toLowerCase();

    // Comprehensive list of CAPTCHA/verification phrases
    const verificationPatterns = [
        // English
        'access verification',
        'please complete the operation',
        'verify that you are a real person',
        'you are a real person',
        'verify you are human',
        'security check',
        'complete the challenge',
        'prove you are human',
        'anti-robot verification',
        'human verification',
        // Russian
        'пройти проверку',
        'подтвердите что вы человек',
        'проверка безопасности',
        // Chinese (Qwen is Chinese service)
        '验证码',
        '请完成操作',
        '验证您是真人'
    ];

    return verificationPatterns.some((pattern) => lowerText.includes(pattern));
}

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

    // Create screencasts directory in logs folder
    const screencastDir = path.join(process.cwd(), LOGS_DIR, 'screencasts');

    const startTime = Date.now();
    let screencastStarted = false;
    let screencastStopper = null;
    let timer = null;
    let maxDurationTimer = null;
    let screencastFilepath = null;
    let screencastSent = false; // Track if video was already sent to Telegram
    let screenshotPath = null;
    let ocrText = null;

    try {
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

                                        // Take screenshot and perform OCR before sending to Telegram
                                        if (page && !page.isClosed()) {
                                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                                            screenshotPath = path.join(screencastDir, `screenshot-${timestamp}.png`);
                                            ocrText = await takeScreenshotAndOCR(page, screenshotPath);
                                        }

                                        const elapsed = Date.now() - startTime;
                                        let caption = '';
                                        try {
                                            const fileSize = fs.statSync(screencastFilepath).size;
                                            const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

                                            // Check if file is too small (likely not fully written or invalid)
                                            if (fileSize < 1024) {
                                                logWarn(`⚠️ Файл слишком маленький (${fileSize} байт), возможно не успел записаться. Пропускаю отправку.`);
                                            } else {
                                                logInfo(`📤 Отправка записи в Telegram (макс. длительность): ${screencastFilepath} (${fileSizeMB} MB)`);

                                                // Get page URL
                                                let pageUrl = null;
                                                try {
                                                    pageUrl = page.url();
                                                } catch (error) {
                                                    logDebug('Не удалось получить URL страницы:', error);
                                                }

                                                // Build caption with OCR text
                                                caption = await buildScreencastCaption(
                                                    'maxDuration',
                                                    elapsed,
                                                    fileSizeMB,
                                                    ocrText,
                                                    null,
                                                    null,
                                                    pageUrl
                                                );

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

                                            // Log raw caption and file details for debugging
                                            logError('📋 Сырые данные отправки:');
                                            logError(`   - Caption (полный текст):\n${caption}`);
                                            logError(`   - Файл: ${screencastFilepath}`);

                                            if (telegramError.response) {
                                                logError('🔍 Сырой ответ Telegram API:');
                                                logError(`   - Status: ${telegramError.response.statusCode || telegramError.response.status}`);
                                                logError(`   - Body: ${telegramError.response.body}`);
                                            }
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

            // Take screenshot and perform OCR before sending to Telegram
            if (!ocrText && page && !page.isClosed()) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                screenshotPath = path.join(screencastDir, `screenshot-${timestamp}.png`);
                ocrText = await takeScreenshotAndOCR(page, screenshotPath);
            }

            const elapsed = Date.now() - startTime;
            const shouldDelete = elapsed < PUPPETEER_PROTOCOL_TIMEOUT &&
                (!SCREENCAST_MAX_DURATION || elapsed < SCREENCAST_MAX_DURATION);

            if (shouldDelete) {
                try {
                    fs.unlinkSync(screencastFilepath);
                    // Also delete screenshot if it exists
                    if (screenshotPath && fs.existsSync(screenshotPath)) {
                        fs.unlinkSync(screenshotPath);
                    }
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

                        // Get page URL
                        let pageUrl = null;
                        try {
                            pageUrl = page.url();
                        } catch (error) {
                            logDebug('Не удалось получить URL страницы:', error);
                        }

                        // Build caption with OCR text
                        const caption = await buildScreencastCaption(
                            elapsed >= PUPPETEER_PROTOCOL_TIMEOUT ? 'protocolTimeout' : 'maxDuration',
                            elapsed,
                            fileSizeMB,
                            ocrText,
                            null,
                            null,
                            pageUrl
                        );

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

            // Take screenshot and perform OCR before sending to Telegram
            if (!ocrText && page && !page.isClosed()) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                screenshotPath = path.join(screencastDir, `screenshot-${timestamp}.png`);
                ocrText = await takeScreenshotAndOCR(page, screenshotPath);
            }

            const elapsed = Date.now() - startTime;

            try {
                const fileSize = fs.statSync(screencastFilepath).size;
                const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

                if (fileSize < 1024) {
                    logWarn(`⚠️ Файл слишком маленький (${fileSize} байт), пропускаю отправку.`);
                } else {
                    logInfo(`📤 Отправка записи в Telegram (ошибка): ${screencastFilepath} (${fileSizeMB} MB)`);

                    // Get page URL
                    let pageUrl = null;
                    try {
                        pageUrl = page.url();
                    } catch (error) {
                        logDebug('Не удалось получить URL страницы:', error);
                    }

                    // Build caption with OCR text and error info
                    const caption = await buildScreencastCaption(
                        'error',
                        elapsed,
                        fileSizeMB,
                        ocrText,
                        error.message ? error.message.substring(0, 100) : error.toString(),
                        null,
                        pageUrl
                    );

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

/**
 * Escape special HTML characters for Telegram HTML parse mode
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) { return ''; }
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Build caption for screencast video with OCR text
 * @param {string} reason - Reason for screencast (maxDuration, protocolTimeout, error)
 * @param {number} elapsed - Elapsed time in ms
 * @param {string} fileSizeMB - File size in MB
 * @param {string|null} ocrText - OCR recognized text
 * @param {string|null} errorMessage - Error message (optional)
 * @param {string|null} accountId - Account ID (optional)
 * @param {string|null} pageUrl - Current page URL (optional)
 * @returns {Promise<string>} Formatted caption
 */
async function buildScreencastCaption(reason, elapsed, fileSizeMB, ocrText, errorMessage = null, accountId = null, pageUrl = null) {
    let caption = '';

    // Add header based on reason
    switch (reason) {
    case 'maxDuration':
        caption = '⏱️ page.evaluate() превышает максимальную длительность\n';
        break;
    case 'protocolTimeout':
        caption = '⏱️ Долгая операция page.evaluate()\n';
        break;
    case 'error':
        caption = '❌ Ошибка page.evaluate()\n';
        break;
    default:
        caption = '⏱️ page.evaluate() timeout\n';
    }

    // Add account info
    if (accountId) {
        caption += `👤 Аккаунт: ${accountId}\n`;
    } else {
        // Try to get current account
        try {
            const tokenObj = await getAvailableToken();
            if (tokenObj?.id) {
                caption += `👤 Аккаунт: ${tokenObj.id}\n`;
            }
        } catch (error) {
            logDebug('Не удалось получить информацию об аккаунте:', error);
        }
    }

    // Add page URL
    if (pageUrl) {
        caption += `🔗 URL: ${pageUrl}\n`;
    }

    // Add timing and file info
    if (reason === 'error') {
        caption += `⏰ Время до ошибки: ${elapsed}ms\n`;
    } else if (reason === 'maxDuration') {
        caption += `⏰ Текущее время: ${elapsed}ms (все еще выполняется)\n`;
    } else {
        caption += `⏰ Время выполнения: ${elapsed}ms\n`;
    }

    caption += `📁 Размер файла: ${fileSizeMB} MB\n`;
    caption += `🔍 Запись началась после: ${SCREENCAST_TIMEOUT}ms\n`;

    // Add reason-specific info
    if (reason === 'maxDuration') {
        caption += '⚠️ Достигнут лимит maxDuration';
    } else if (reason === 'protocolTimeout') {
        caption += '⚠️ Превышен лимит: protocolTimeout';
    } else if (reason === 'error' && errorMessage) {
        caption += `💥 Ошибка: ${errorMessage}`;
    }

    // Add OCR text if available
    if (ocrText) {

        // Add super importance icon if verification detected
        if (isVerificationText(ocrText)) {
            caption += '\n\n🚨⚠️📝 Распознанный текст:\n';
        } else {
            caption += '\n\n📝 Распознанный текст:\n';
        }
        // Escape HTML characters and use <code> tag instead of backticks
        const escapedText = escapeHtml(ocrText);
        caption += `<code>${escapedText}</code>`;
    }

    return caption;
}
