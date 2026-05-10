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
    if (!fs.existsSync(SESSION_PATH)) fs.mkdirSync(SESSION_PATH, { recursive: true });
    if (!fs.existsSync(ACCOUNTS_PATH)) fs.mkdirSync(ACCOUNTS_PATH, { recursive: true });
}

/**
 * Декодирует JWT токен и извлекает время истечения
 * @param {string} token - JWT токен
 * @returns {number|null} - Время истечения в миллисекундах или null
 */
function decodeJwtExpiry(token) {
    try {
        if (!token || typeof token !== 'string') return null;
        
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
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
    if (!fs.existsSync(TOKENS_FILE)) return [];
    try {
        const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
        
        // Добавляем expiryTime для каждого токена, если его нет
        return tokens.map(token => {
            if (!token.expiryTime && token.token) {
                token.expiryTime = decodeJwtExpiry(token.token);
            }
            return token;
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
        logError('TokenManager: ошибка сохранения tokens.json', e);
    }
}

export async function getAvailableToken() {
    const tokens = loadTokens();
    const now = Date.now();
    const valid = tokens.filter(t => (!t.resetAt || new Date(t.resetAt).getTime() <= now) && !t.invalid);
    if (!valid.length) return null;
    const token = valid[pointer % valid.length];
    pointer = (pointer + 1) % valid.length;
    return token;
}

export function hasValidTokens() {
    const tokens = loadTokens();
    const now = Date.now();
    return tokens.some(t => (!t.resetAt || new Date(t.resetAt).getTime() <= now) && !t.invalid);
}

export function markRateLimited(id, hours = 24) {
    const tokens = loadTokens();
    const idx = tokens.findIndex(t => t.id === id);
    if (idx !== -1) {
        tokens[idx].resetAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
        saveTokens(tokens);
    }
}

export function removeToken(id) {
    saveTokens(loadTokens().filter(t => t.id !== id));
}

export { removeToken as removeInvalidToken };

export function markInvalid(id) {
    const tokens = loadTokens();
    const idx = tokens.findIndex(t => t.id === id);
    if (idx !== -1) { tokens[idx].invalid = true; saveTokens(tokens); }
}

export function markValid(id, newToken) {
    const tokens = loadTokens();
    const idx = tokens.findIndex(t => t.id === id);
    if (idx !== -1) {
        tokens[idx].invalid = false;
        tokens[idx].resetAt = null;
        if (newToken) tokens[idx].token = newToken;
        saveTokens(tokens);
    }
}

export function listTokens() {
    return loadTokens();
}

/**
 * Проверяет, истекает ли токен в ближайшее время
 * @param {string} tokenId - ID токена
 * @param {number} warningMs - Время предупреждения в мс (по умолчанию 1 час)
 * @returns {object} - {willExpireSoon: boolean, expiresAt: Date|null, timeLeft: number|null}
 */
export function checkTokenExpiry(tokenId, warningMs = TOKEN_EXPIRY_WARNING_MS) {
    const tokens = loadTokens();
    const token = tokens.find(t => t.id === tokenId);
    
    if (!token) {
        return { willExpireSoon: false, expiresAt: null, timeLeft: null, tokenFound: false };
    }

    const now = Date.now();
    
    // Если токен помечен как недействительный
    if (token.invalid) {
        return { willExpireSoon: true, expiresAt: null, timeLeft: null, tokenFound: true, isInvalid: true };
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
                isExpired: true 
            };
        }
        
        if (timeLeft <= warningMs) {
            return { 
                willExpireSoon: true, 
                expiresAt: new Date(token.resetAt), 
                timeLeft, 
                tokenFound: true,
                isExpiringSoon: true
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

    tokens.forEach(token => {
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
 * @param {number} warningMs - Время предупреждения в мс
 * @returns {object|null} - Токен или null
 */
export async function getSafeToken(warningMs = TOKEN_EXPIRY_WARNING_MS) {
    const tokens = loadTokens();
    const now = Date.now();
    
    // Фильтруем токены, которые не истекают в ближайшее время
    const safeTokens = tokens.filter(t => {
        if (t.invalid) return false;
        if (!t.resetAt) return true;
        
        const resetTime = new Date(t.resetAt).getTime();
        return resetTime <= now || (resetTime - now) > warningMs;
    });

    if (safeTokens.length === 0) {
        return null;
    }

    const token = safeTokens[pointer % safeTokens.length];
    pointer = (pointer + 1) % safeTokens.length;
    
    logInfo(`Использован безопасный токен: ${token.id}`);
    return token;
}
