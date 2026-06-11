import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { saveSession, saveAuthToken } from './session.js';
import { startManualAuthentication } from './auth.js';
import { clearPagePool, getAuthToken } from '../api/chat.js';
import { pageEvaluateWithScreencast } from '../utils/pageEvaluateWrapper.js';
import fs from 'fs';
import path from 'path';
import { logInfo, logError, logWarn, logDebug } from '../logger/index.js';
import {
    CHAT_PAGE_URL, NAVIGATION_TIMEOUT, RETRY_DELAY,
    VIEWPORT_WIDTH, VIEWPORT_HEIGHT, USER_AGENT,
    SESSION_DIR, ACCOUNTS_DIR, PUPPETEER_CONSOLE_LOGS,
    PUPPETEER_PROTOCOL_TIMEOUT, MOUSE_MOVEMENT_DURATION, BROWSER_PERSISTENCE_MODE
} from '../config.js';

puppeteer.use(StealthPlugin());

let browserInstance = null;
let browserContext = null;
export let isAuthenticated = false;
let dedicatedPage = null; // Для режима profile - единственная вкладка
let profileDir = null; // Путь к директории профиля
let isTabInitialized = false; // Флаг: вкладка уже инициализирована через UI

/**
 * Получить путь к директории профиля браузера
 * @returns {string} Путь к директории профиля
 */
function getProfileDir() {
    const profilesDir = path.join(process.cwd(), SESSION_DIR, 'browser-profiles');
    if (!fs.existsSync(profilesDir)) {
        fs.mkdirSync(profilesDir, { recursive: true });
    }
    return path.join(profilesDir, 'default');
}

/**
 * Найти самый свежий профиль браузера
 * @returns {string|null} Путь к самому свежему профилю или null
 */
function getLatestProfile() {
    const profilesDir = path.join(process.cwd(), SESSION_DIR, 'browser-profiles');
    if (!fs.existsSync(profilesDir)) {
        return null;
    }

    const profiles = fs.readdirSync(profilesDir).filter((name) => {
        const fullPath = path.join(profilesDir, name);
        return fs.statSync(fullPath).isDirectory();
    });

    if (profiles.length === 0) {
        return null;
    }

    // Сортируем по времени модификации (самый свежий первый)
    const profilesWithTime = profiles.map((name) => {
        const fullPath = path.join(profilesDir, name);
        const stat = fs.statSync(fullPath);
        return { name, fullPath, mtime: stat.mtimeMs };
    });

    profilesWithTime.sort((a, b) => b.mtime - a.mtime);
    return profilesWithTime[0].fullPath;
}

/**
 * Initialize browser tab by interacting with UI
 * This makes the tab look like a real user session
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 */
export async function initializeTabWithUI(page) {
    try {
        logInfo('🔧 Инициализация вкладки через взаимодействие с UI...');

        // Переходим на главную страницу
        await page.goto(CHAT_PAGE_URL, { waitUntil: 'networkidle2', timeout: NAVIGATION_TIMEOUT });
        await delay(2000);

        // Ждем появления textarea (message input)
        logDebug('⏳ Ожидание появления поля ввода...');

        // Пробуем найти по XPath
        let textarea = null;
        try {
            const xpathResult = await page.$x('//*[@id="dropzone-container"]/div[2]/div/div[2]/div/div/textarea');
            if (xpathResult && xpathResult.length > 0) {
                textarea = xpathResult[0];
                logDebug('✅ Textarea найден по XPath');
            }
        } catch (e) {
            logDebug('XPath не сработал, пробуем по классу');
        }

        // Если не нашли по XPath, ищем по классу
        if (!textarea) {
            textarea = await page.$('.message-input-textarea');
            if (textarea) {
                logDebug('✅ Textarea найден по классу .message-input-textarea');
            }
        }

        if (!textarea) {
            logWarn('⚠️ Textarea не найден, пропускаем инициализацию');
            return false;
        }

        // Кликаем на textarea
        logDebug('🖱️ Клик на поле ввода...');
        await textarea.click();
        await delay(500);

        // Вводим "ping"
        logDebug('⌨️ Ввод "ping"...');
        await textarea.type('ping', { delay: 50 });
        await delay(500);

        // Нажимаем Enter
        logDebug('⌨️ Нажатие Enter...');
        await page.keyboard.press('Enter');

        // Ждем пока запрос обработается
        logDebug('⏳ Ожидание ответа от сервера...');
        await delay(3000);

        // Проверяем что появился ответ
        const hasResponse = await page.evaluate(() => {
            // Ищем элементы с ответом ассистента (более специфичные селекторы Qwen)
            const responseElements = document.querySelectorAll(
                '[class*="message-content"][class*="phase-answer"], ' +
                '[class*="response"], ' +
                '[class*="assistant-message"]'
            );
            return responseElements.length > 0;
        });

        if (hasResponse) {
            logInfo('✅ Вкладка успешно инициализирована через UI');
            return true;
        } else {
            logWarn('⚠️ Ответ не обнаружен, но вкладка считается готовой');
            return true;
        }
    } catch (error) {
        logError('❌ Ошибка при инициализации вкладки через UI', error);
        return false;
    }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Simulate random mouse movement to make the tab appear more human-like
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 */
export async function simulateHumanMouseMovement(page) {
    // Skip if duration is 0 or not set
    if (!MOUSE_MOVEMENT_DURATION || MOUSE_MOVEMENT_DURATION <= 0) {
        logDebug('Симуляция движений мыши отключена (MOUSE_MOVEMENT_DURATION=0)');
        return;
    }

    logDebug(`Симуляция движений мыши в течение ${MOUSE_MOVEMENT_DURATION}мс...`);

    const viewport = { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT };
    const duration = MOUSE_MOVEMENT_DURATION;
    const interval = 50; // Move every 50ms
    const steps = duration / interval;

    for (let i = 0; i < steps; i++) {
        // Generate random coordinates within the viewport
        const x = Math.floor(Math.random() * viewport.width);
        const y = Math.floor(Math.random() * viewport.height);

        // Move mouse to random position
        await page.mouse.move(x, y);

        // Wait before next movement
        await delay(interval);
    }

    logDebug('Симуляция движений мыши завершена');
}

/**
 * Setup console event listeners to capture errors and warnings from browser tabs
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 */
function setupBrowserConsoleLogging(page) {
    page.on('console', (msg) => {
        const type = msg.type();
        const text = msg.text();

        // Only log errors and warnings to avoid noise
        if (type === 'error') {
            console.error(`🌐 [BROWSER ERROR] ${text}`);
        } else if (type === 'warning') {
            console.warn(`🌐 [BROWSER WARNING] ${text}`);
        }
    });

    page.on('pageerror', (error) => {
        console.error(`🌐 [BROWSER PAGE ERROR] ${error.message}`);
        if (error.stack) {
            console.error(`📍 Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
        }
    });
}

export async function initBrowser(visibleMode = true, skipManualRestart = false, skipManualAuth = false) {
    if (browserInstance) { return true; }

    logInfo(`Инициализация браузера с Puppeteer Stealth... (режим: ${BROWSER_PERSISTENCE_MODE})`);
    try {
        const isProfileMode = BROWSER_PERSISTENCE_MODE === 'profile';

        // В режиме profile используем userDataDir
        if (isProfileMode) {
            // При авторизации создаем новый профиль, иначе загружаем самый свежий
            if (visibleMode && !skipManualAuth) {
                profileDir = getProfileDir();
                logInfo(`📁 Создание нового профиля: ${profileDir}`);
            } else {
                profileDir = getLatestProfile() || getProfileDir();
                logInfo(`📁 Загрузка профиля: ${profileDir}`);
            }
        }

        const launchOptions = {
            headless: !visibleMode,
            slowMo: visibleMode ? 30 : 0,
            executablePath: process.env.CHROME_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                `--window-size=${VIEWPORT_WIDTH},${VIEWPORT_HEIGHT}`,
                '--start-maximized',
                '--disable-infobars',
                '--disable-extensions',
                '--disable-gpu',
                '--no-first-run',
                '--no-default-browser-check',
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-spki-list'
            ],
            defaultViewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
            ignoreHTTPSErrors: true,
            protocolTimeout: PUPPETEER_PROTOCOL_TIMEOUT
        };

        // Добавляем userDataDir только в режиме profile
        if (isProfileMode && profileDir) {
            launchOptions.userDataDir = profileDir;
            logDebug(`🔧 userDataDir: ${profileDir}`);
        }

        browserInstance = await puppeteer.launch(launchOptions);

        const pages = await browserInstance.pages();
        const page = pages.length > 0 ? pages[0] : await browserInstance.newPage();

        // В режиме profile сохраняем единственную вкладку
        if (isProfileMode) {
            dedicatedPage = page;
            logInfo('🔒 Режим profile: все запросы будут идти через одну вкладку');
        }

        // Simulate human-like mouse movement after tab creation
        await simulateHumanMouseMovement(page);

        await page.setUserAgent(USER_AGENT);
        await page.setViewport({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT, deviceScaleFactor: 1 });
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        });

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
            Object.defineProperty(navigator, 'plugins', {
                get: () => [{ 0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' }, description: 'Portable Document Format', filename: 'internal-pdf-viewer', length: 1, name: 'Chrome PDF Plugin' }]
            });
            Object.defineProperty(navigator, 'connection', {
                get: () => ({ effectiveType: '4g', rtt: 50, downlink: 10, saveData: false })
            });
            if (!navigator.getBattery) {
                navigator.getBattery = () => Promise.resolve({ charging: true, chargingTime: 0, dischargingTime: Infinity, level: 1 });
            }

            const originalAddEventListener = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function (type, listener, options) {
                if (type === 'mousemove' || type === 'mousedown' || type === 'mouseup') {
                    const wrappedListener = function (event) { setTimeout(() => listener.call(this, event), Math.random() * 3); };
                    return originalAddEventListener.call(this, type, wrappedListener, options);
                }
                return originalAddEventListener.call(this, type, listener, options);
            };

            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function (type) {
                const context = this.getContext('2d');
                if (context) {
                    const imageData = context.getImageData(0, 0, this.width, this.height);
                    const data = imageData.data;
                    for (let i = 0; i < data.length; i += 4) {
                        const noise = Math.floor(Math.random() * 5) - 2;
                        data[i] = Math.max(0, Math.min(255, data[i] + noise));
                        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
                        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
                    }
                    context.putImageData(imageData, 0, 0);
                }
                return originalToDataURL.apply(this, arguments);
            };
        });

        browserContext = page;
        logInfo('Браузер инициализирован с максимальной защитой от обнаружения');

        // В режиме profile инициализируем вкладку через UI
        if (isProfileMode && !visibleMode) {
            // В headless режиме всегда инициализируем вкладку
            const initSuccess = await initializeTabWithUI(page);
            if (initSuccess) {
                isTabInitialized = true;
                logInfo('✅ Вкладка готова к работе (инициализирована через UI)');
            } else {
                logWarn('⚠️ Инициализация вкладки через UI не удалась, но продолжаем работу');
                isTabInitialized = true; // Считаем готовой даже если что-то пошло не так
            }
        }

        // Setup console logging for browser tabs if enabled
        if (PUPPETEER_CONSOLE_LOGS) {
            setupBrowserConsoleLogging(page);

            // Also listen for new pages/tabs
            browserInstance.on('targetcreated', async (target) => {
                if (target.type() === 'page') {
                    try {
                        const newPage = await target.page();
                        if (newPage) {
                            setupBrowserConsoleLogging(newPage);
                        }
                    } catch (error) {
                        // Ignore errors for pages that can't be accessed
                    }
                }
            });
        }

        if (visibleMode && !skipManualAuth) {
            await startManualAuthenticationPuppeteer(page, skipManualRestart);
        }
        // loadSessionPuppeteer removed — was dead code (always returned false)

        return true;
    } catch (error) {
        logError('Ошибка при инициализации браузера', error);
        return false;
    }
}

async function saveSessionPuppeteer(page) {
    try {
        const cookies = await page.cookies();
        const sessionDir = path.join(process.cwd(), SESSION_DIR, ACCOUNTS_DIR);
        if (!fs.existsSync(sessionDir)) { fs.mkdirSync(sessionDir, { recursive: true }); }

        const accountId = `acc_${Date.now()}`;
        const accountDir = path.join(sessionDir, accountId);
        if (!fs.existsSync(accountDir)) { fs.mkdirSync(accountDir, { recursive: true }); }

        fs.writeFileSync(path.join(accountDir, 'cookies.json'), JSON.stringify(cookies, null, 2));
        logInfo(`📝 ${accountId}: Получено ${cookies.length} cookies`);

        // Автоматически извлекаем и сохраняем токен из cookies
        const tokenCookie = cookies.find((cookie) => cookie.name === 'token');
        if (tokenCookie && tokenCookie.value) {
            fs.writeFileSync(path.join(accountDir, 'token.txt'), tokenCookie.value, 'utf8');
            logInfo(`✅ Cookies сохранены для аккаунта ${accountId}, токен автоматически извлечён`);
        } else {
            logInfo(`📝 Cookies сохранены для аккаунта ${accountId} (${cookies.length} cookies)`);
        }
        return accountId;
    } catch (error) {
        logError('Ошибка при сохранении сессии', error);
        return null;
    }
}

async function startManualAuthenticationPuppeteer(page, skipManualRestart) {
    try {
        logInfo('Открытие страницы для ручной авторизации...');
        await page.goto(CHAT_PAGE_URL, { waitUntil: 'networkidle2', timeout: NAVIGATION_TIMEOUT });
        await delay(5000);

        console.log('------------------------------------------------------');
        console.log('               НЕОБХОДИМА АВТОРИЗАЦИЯ');
        console.log('------------------------------------------------------');
        console.log('Пожалуйста, выполните следующие действия:');
        console.log('1. Войдите в систему в открытом браузере');
        console.log('2. ВАЖНО: Двигайте мышью естественно, не спешите');
        console.log('3. Если появится слайдер капчи - решите её медленно');
        console.log('4. Дождитесь полной загрузки главной страницы');
        console.log('5. После успешной авторизации нажмите ENTER в консоли');
        console.log('------------------------------------------------------');
        console.log('После успешной авторизации нажмите ENTER для продолжения...');

        await new Promise((resolve) => {
            if (process.stdin.isTTY) { process.stdin.setRawMode(false); }
            process.stdin.resume();
            process.stdin.setEncoding('utf8');
            const onData = (key) => {
                if (key === '\n' || key === '\r' || key.charCodeAt(0) === 13) {
                    process.stdin.pause();
                    process.stdin.removeListener('data', onData);
                    logInfo('Получено подтверждение, продолжаем...');
                    resolve();
                }
            };
            process.stdin.on('data', onData);
        });

        const cookies = await page.cookies();
        logInfo(`Сохранено ${cookies.length} cookies`);

        const token = await pageEvaluateWithScreencast(page, () =>
            localStorage.getItem('token') || localStorage.getItem('auth_token') ||
            localStorage.getItem('access_token') || sessionStorage.getItem('token') ||
            sessionStorage.getItem('auth_token') || null
        );

        if (token) {
            logInfo('Токен найден и будет сохранен');
            saveAuthToken(token);
        } else {
            logWarn('Токен не найден в localStorage/sessionStorage');
            logInfo('Попытка извлечь токен из cookies...');
            const tokenCookie = cookies.find((c) => c.name.toLowerCase().includes('token') || c.name.toLowerCase().includes('auth'));
            if (tokenCookie) {
                logInfo(`Токен найден в cookie: ${tokenCookie.name}`);
                saveAuthToken(tokenCookie.value);
            }
        }

        const accountId = await saveSessionPuppeteer(page);
        if (accountId) { logInfo(`Сессия сохранена с ID: ${accountId}`); }

        setAuthenticationStatus(true);
        logInfo('Авторизация завершена успешно');

        if (!skipManualRestart) { await restartBrowserInHeadlessMode(); }
    } catch (error) {
        logError('Ошибка при ручной авторизации', error);
        throw error;
    }
}

export async function restartBrowserInHeadlessMode() {
    logInfo('Перезапуск браузера в фоновом режиме...');
    const token = getAuthToken();
    if (token) { logDebug('Сохранение токена...'); saveAuthToken(token); await delay(1000); }
    await shutdownBrowser();
    await delay(RETRY_DELAY);
    const success = await initBrowser(false);
    logInfo(success ? 'Браузер перезапущен в фоновом режиме' : 'Ошибка при перезапуске браузера');
}

export async function shutdownBrowser() {
    try {
        // В режиме profile сохраняем состояние перед закрытием
        if (BROWSER_PERSISTENCE_MODE === 'profile' && dedicatedPage) {
            try {
                logInfo('💾 Сохранение состояния браузера перед закрытием...');
                // Просто ждем немного чтобы браузер успел сохранить данные на диск
                await delay(1000);
                logInfo('✅ Состояние браузера сохранено');
            } catch (e) {
                logWarn('⚠️ Не удалось сохранить состояние браузера', e);
            }
        }

        try { await clearPagePool(); } catch (e) { logError('Ошибка при очистке пула страниц', e); }
        if (browserInstance) {
            try {
                const pages = await browserInstance.pages();
                for (const page of pages) { await page.close().catch(() => { }); }
                await browserInstance.close();
            } catch (e) { logError('Ошибка при закрытии браузера', e); }
        }
        browserContext = null;
        browserInstance = null;
        dedicatedPage = null;
        isTabInitialized = false;
        logInfo('Браузер закрыт');
    } catch (error) {
        logError('Ошибка при завершении работы браузера', error);
    }
}

export function getBrowserContext() { return browserContext; }
export function getDedicatedPage() { return dedicatedPage; }
export function isProfileMode() { return BROWSER_PERSISTENCE_MODE === 'profile'; }
export function isTabReady() { return isTabInitialized; }
export function setAuthenticationStatus(status) { isAuthenticated = status; }
export function getAuthenticationStatus() { return isAuthenticated; }
