import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logError, logWarn, logInfo } from '../logger/index.js';
import { SESSION_DIR, ACCOUNTS_DIR, TOKEN_EXPIRY_WARNING_MS } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SESSION_PATH = path.resolve(__dirname, '..', '..', SESSION_DIR);
const ACCOUNTS_PATH = path.join(SESSION_PATH, ACCOUNTS_DIR);
const TOKENS_FILE = path.join(SESSION_PATH, 'tokens.json');

let pointer = 0;

function ensureSessionDir() {
    if (!fs.existsSync(SESSION_PATH)) {fs.mkdirSync(SESSION_PATH, { recursive: true });}
    if (!fs.existsSync(ACCOUNTS_PATH)) {fs.mkdirSync(ACCOUNTS_PATH, { recursive: true });}
}

/**
 * Проверяет наличие cookies.json для аккаунта
 * @param {string} accountId - ID аккаунта
 * @returns {boolean} - true если cookies.json существует
 */
export function hasCookies(accountId) {
    const cookiesPath = path.join(ACCOUNTS_PATH, accountId, 'cookies.json');
    return fs.existsSync(cookiesPath);
}

/**
 * Извлекает JWT токен из cookies.json
 * @param {string} accountId - ID аккаунта
 * @returns {string|null} - JWT токен или null
 */
function extractTokenFromCookies(accountId) {
    try {
        const cookiesPath = path.join(ACCOUNTS_PATH, accountId, 'cookies.json');
        if (!fs.existsSync(cookiesPath)) {return null;}

        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));

        // Ищем cookie с именем 'token'
        const tokenCookie = cookies.find((cookie) => cookie.name === 'token');

        if (tokenCookie && tokenCookie.value) {
            return tokenCookie.value;
        }

        return null;
    } catch (error) {
        // Тихо возвращаем null - это не критичная операция
        return null;
    }
}

/**
 * Восстанавливает token.txt из cookies.json если token.txt отсутствует
 * @param {string} accountId - ID аккаунта
 * @returns {boolean} - true если токен был восстановлен
 */
function restoreTokenFromFile(accountId) {
    const tokenPath = path.join(ACCOUNTS_PATH, accountId, 'token.txt');

    // Если token.txt уже существует, ничего не делаем
    if (fs.existsSync(tokenPath)) {return false;}

    // Пытаемся извлечь токен из cookies.json
    const token = extractTokenFromCookies(accountId);

    if (token) {
        try {
            fs.writeFileSync(tokenPath, token, 'utf8');
            logInfo(`✅ ${accountId}: Токен восстановлен из cookies.json`);
            return true;
        } catch (error) {
            logWarn(`⚠️ ${accountId}: Не удалось создать token.txt: ${error.message}`);
            return false;
        }
    }

    return false;
}

/**
 * Декодирует JWT токен и извлекает время истечения
 * @param {string} token - JWT токен
 * @returns {number|null} - Время истечения в миллисекундах или null
 */
function decodeJwtExpiry(token) {
    try {
        if (!token || typeof token !== 'string') {return null;}

        const parts = token.split('.');
        if (parts.length !== 3) {return null;}

        // Декодируем payload (вторая часть JWT)
        // JWT использует URL-safe base64, нужно заменить - на + и _ на /
        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');

        // Добавляем padding если нужно
        while (base64.length % 4) {
            base64 += '=';
        }

        const payload = Buffer.from(base64, 'base64').toString('utf8');
        const decoded = JSON.parse(payload);

        // JWT использует поле 'exp' для времени истечения (в секундах)
        if (decoded.exp) {
            return decoded.exp * 1000; // Конвертируем в миллисекунды
        }

        return null;
    } catch (error) {
        // Если не удалось декодировать, возвращаем null
        return null;
    }
}

export function loadTokens() {
    ensureSessionDir();
    if (!fs.existsSync(TOKENS_FILE)) {return [];}
    try {
        const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));

        // Автоматически восстанавливаем token.txt из cookies.json если нужно
        tokens.forEach((token) => {
            if (token.id) {
                restoreTokenFromFile(token.id);
            }
        });

        // Добавляем expiryTime для каждого токена, если его нет
        const tokensWithExpiry = tokens.map((token) => {
            if (!token.expiryTime && token.token) {
                token.expiryTime = decodeJwtExpiry(token.token);
            }
            return token;
        });

        // Сортируем токены по времени создания (самые свежие первые)
        // ID имеет формат 'acc_<timestamp>', извлекаем timestamp для сортировки
        return tokensWithExpiry.sort((a, b) => {
            const timestampA = parseInt(a.id.replace('acc_', ''), 10) || 0;
            const timestampB = parseInt(b.id.replace('acc_', ''), 10) || 0;
            return timestampB - timestampA; // По убыванию (новые первые)
        });
    } catch (e) {
        logError('TokenManager: ошибка чтения tokens.json', e);
        return [];
    }
}

export function saveTokens(tokens) {
    ensureSessionDir();
    try {
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
    } catch (e) {
        // Не логируем EACCES как ошибку - это предупреждение
        if (e.code === 'EACCES') {
            logWarn('⚠️ Нет прав на записи tokens.json. Запустите: sudo chown -R $USER:$USER session/');
        } else {
            logError('TokenManager: ошибка сохранения tokens.json', e);
        }
    }
}

export async function getAvailableToken() {
    const tokens = loadTokens();
    const now = Date.now();

    // Фильтруем токены: не rate-limited, не invalid, JWT не истёк, и есть cookies
    const valid = tokens.filter((t) => {
        // Пропускаем недействительные токены
        if (t.invalid) {return false;}

        // Пропускаем токены с rate limit в будущем
        if (t.resetAt && new Date(t.resetAt).getTime() > now) {return false;}

        // Пропускаем токены с истёкшим JWT
        if (t.expiryTime && t.expiryTime <= now) {return false;}

        // Пропускаем токены без cookies.json
        if (!hasCookies(t.id)) {return false;}

        return true;
    });

    if (!valid.length) {return null;}
    const token = valid[pointer % valid.length];
    pointer = (pointer + 1) % valid.length;
    return token;
}

export function hasValidTokens() {
    const tokens = loadTokens();
    const now = Date.now();

    // Проверяем, есть ли хотя бы один валидный токен с cookies
    return tokens.some((t) => {
        // Пропускаем недействительные токены
        if (t.invalid) {return false;}

        // Пропускаем токены с rate limit в будущем
        if (t.resetAt && new Date(t.resetAt).getTime() > now) {return false;}

        // Пропускаем токены с истёкшим JWT
        if (t.expiryTime && t.expiryTime <= now) {return false;}

        // Пропускаем токены без cookies.json
        if (!hasCookies(t.id)) {return false;}

        return true;
    });
}

export function markRateLimited(id, hours = 24) {
    const tokens = loadTokens();
    const idx = tokens.findIndex((t) => t.id === id);
    if (idx !== -1) {
        tokens[idx].resetAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
        saveTokens(tokens);
    }
}

export function removeToken(id) {
    saveTokens(loadTokens().filter((t) => t.id !== id));
}

export { removeToken as removeInvalidToken };

export function markInvalid(id) {
    const tokens = loadTokens();
    const idx = tokens.findIndex((t) => t.id === id);
    if (idx !== -1) { tokens[idx].invalid = true; saveTokens(tokens); }
}

export function markValid(id, newToken) {
    const tokens = loadTokens();
    const idx = tokens.findIndex((t) => t.id === id);
    if (idx !== -1) {
        tokens[idx].invalid = false;
        tokens[idx].resetAt = null;
        if (newToken) {tokens[idx].token = newToken;}
        saveTokens(tokens);
    }
}

export function listTokens() {
    return loadTokens();
}

/**
 * Получает только действительные токены (не истекшие, не invalid, не rate-limited, с cookies)
 * @returns {Array} - Массив действительных токенов
 */
export function getValidTokens() {
    const tokens = loadTokens();
    const now = Date.now();

    return tokens.filter((t) => {
        // Пропускаем недействительные токены
        if (t.invalid) {return false;}

        // Пропускаем токены с rate limit в будущем
        if (t.resetAt && new Date(t.resetAt).getTime() > now) {return false;}

        // Пропускаем токены с истёкшим JWT
        if (t.expiryTime && t.expiryTime <= now) {return false;}

        // Пропускаем токены без cookies.json
        if (!hasCookies(t.id)) {return false;}

        return true;
    });
}

/**
 * Проверяет, истекает ли токен в ближайшее время
 * Проверяет оба параметра: resetAt (rate limit) и expiryTime (JWT expiry)
 * @param {string} tokenId - ID токена
 * @param {number} warningMs - Время предупреждения в мс (по умолчанию 1 час)
 * @returns {object} - {willExpireSoon: boolean, expiresAt: Date|null, timeLeft: number|null}
 */
export function checkTokenExpiry(tokenId, warningMs = TOKEN_EXPIRY_WARNING_MS) {
    const tokens = loadTokens();
    const token = tokens.find((t) => t.id === tokenId);

    if (!token) {
        return { willExpireSoon: false, expiresAt: null, timeLeft: null, tokenFound: false };
    }

    const now = Date.now();

    // Если токен помечен как недействительный
    if (token.invalid) {
        return { willExpireSoon: true, expiresAt: null, timeLeft: null, tokenFound: true, isInvalid: true };
    }

    // Проверяем JWT expiry time (если есть)
    if (token.expiryTime) {
        const jwtTimeLeft = token.expiryTime - now;

        // Если JWT уже истёк
        if (jwtTimeLeft <= 0) {
            return {
                willExpireSoon: true,
                expiresAt: new Date(token.expiryTime),
                timeLeft: 0,
                tokenFound: true,
                isExpired: true,
                expiredType: 'jwt'
            };
        }

        // Если JWT истекает в ближайшее время
        if (jwtTimeLeft <= warningMs) {
            return {
                willExpireSoon: true,
                expiresAt: new Date(token.expiryTime),
                timeLeft: jwtTimeLeft,
                tokenFound: true,
                isExpiringSoon: true,
                expiredType: 'jwt'
            };
        }
    }

    // Если есть время сброса лимита
    if (token.resetAt) {
        const resetTime = new Date(token.resetAt).getTime();
        const timeLeft = resetTime - now;

        // Если уже истёк или истекает в ближайшее время
        if (timeLeft <= 0) {
            return {
                willExpireSoon: true,
                expiresAt: new Date(token.resetAt),
                timeLeft: 0,
                tokenFound: true,
                isExpired: true,
                expiredType: 'rate_limit'
            };
        }

        if (timeLeft <= warningMs) {
            return {
                willExpireSoon: true,
                expiresAt: new Date(token.resetAt),
                timeLeft,
                tokenFound: true,
                isExpiringSoon: true,
                expiredType: 'rate_limit'
            };
        }

        return {
            willExpireSoon: false,
            expiresAt: new Date(token.resetAt),
            timeLeft,
            tokenFound: true
        };
    }

    // Если нет времени сброса, токен активен
    return { willExpireSoon: false, expiresAt: null, timeLeft: null, tokenFound: true };
}

/**
 * Проверяет все токены и возвращает информацию об истекающих
 * @param {number} warningMs - Время предупреждения в мс
 * @returns {object} - {expiringTokens: Array, allTokensExpired: boolean, totalTokens: number}
 */
export function checkAllTokensExpiry(warningMs = TOKEN_EXPIRY_WARNING_MS) {
    const tokens = loadTokens();
    const now = Date.now();

    const expiringTokens = [];
    let activeTokens = 0;

    tokens.forEach((token) => {
        const expiryInfo = checkTokenExpiry(token.id, warningMs);

        if (expiryInfo.willExpireSoon) {
            expiringTokens.push({
                ...token,
                expiryInfo
            });
        } else {
            activeTokens++;
        }
    });

    return {
        expiringTokens,
        allTokensExpired: activeTokens === 0,
        totalTokens: tokens.length,
        activeTokens
    };
}

/**
 * Получает токен, который не истекает в ближайшее время
 * Проверяет оба параметра: resetAt (rate limit) и expiryTime (JWT expiry)
 * Требует наличия cookies.json
 * @param {number} warningMs - Время предупреждения в мс
 * @returns {object|null} - Токен или null
 */
export function getSafeToken(warningMs = TOKEN_EXPIRY_WARNING_MS) {
    const tokens = loadTokens();
    const now = Date.now();

    // Фильтруем токены, которые не истекают в ближайшее время и имеют cookies
    const safeTokens = tokens.filter((t) => {
        // Пропускаем недействительные токены
        if (t.invalid) {return false;}

        // Пропускаем токены без cookies.json
        if (!hasCookies(t.id)) {return false;}

        // Проверяем rate limit reset time
        if (t.resetAt) {
            const resetTime = new Date(t.resetAt).getTime();
            // Если reset time в будущем и меньше warningMs - токен небезопасен
            if (resetTime > now && (resetTime - now) <= warningMs) {
                return false;
            }
        }

        // Проверяем JWT expiry time (если есть)
        if (t.expiryTime) {
            const jwtTimeLeft = t.expiryTime - now;
            // Если JWT истекает в ближайшее время - токен небезопасен
            if (jwtTimeLeft <= warningMs) {
                return false;
            }
        }

        return true;
    });

    if (safeTokens.length === 0) {
        return null;
    }

    const token = safeTokens[pointer % safeTokens.length];
    pointer = (pointer + 1) % safeTokens.length;

    logInfo(`Использован безопасный токен: ${token.id}`);
    return token;
}
