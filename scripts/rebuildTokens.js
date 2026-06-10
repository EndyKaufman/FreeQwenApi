#!/usr/bin/env node

/**
 * Rebuild tokens.json from account directories
 *
 * This script scans the session/accounts directory for token.txt files
 * and rebuilds the tokens.json registry.
 *
 * Usage:
 *   npm run rebuild-tokens
 *   or
 *   node scripts/rebuildTokens.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SESSION_DIR, ACCOUNTS_DIR } from '../src/config.js';
import { logInfo, logError, logWarn } from '../src/logger/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SESSION_PATH = path.resolve(ROOT_DIR, SESSION_DIR);
const ACCOUNTS_PATH = path.join(SESSION_PATH, ACCOUNTS_DIR);
const TOKENS_FILE = path.join(SESSION_PATH, 'tokens.json');

/**
 * Decode JWT to get expiry time
 */
function decodeJwtExpiry(token) {
    try {
        if (!token || typeof token !== 'string') {return null;}

        const parts = token.split('.');
        if (parts.length !== 3) {return null;}

        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
            base64 += '=';
        }

        const payload = Buffer.from(base64, 'base64').toString('utf8');
        const decoded = JSON.parse(payload);

        if (decoded.exp) {
            return decoded.exp * 1000;
        }

        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Извлекает JWT токен из cookies.json
 * @param {string} cookiesPath - путь к cookies.json
 * @returns {string|null} - JWT токен или null
 */
function extractTokenFromCookies(cookiesPath) {
    try {
        if (!fs.existsSync(cookiesPath)) {return null;}

        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));

        // Ищем cookie с именем 'token'
        const tokenCookie = cookies.find((cookie) => cookie.name === 'token');

        if (tokenCookie && tokenCookie.value) {
            return tokenCookie.value;
        }

        return null;
    } catch (error) {
        logWarn(`  Ошибка чтения cookies: ${error.message}`);
        return null;
    }
}

/**
 * Rebuild tokens.json from account directories
 */
function rebuildTokens() {
    console.log('🔍 Scanning account directories...\n');

    if (!fs.existsSync(ACCOUNTS_PATH)) {
        logError(`Accounts directory not found: ${ACCOUNTS_PATH}`);
        process.exit(1);
    }

    const accounts = fs.readdirSync(ACCOUNTS_PATH).filter((dir) => {
        return fs.statSync(path.join(ACCOUNTS_PATH, dir)).isDirectory();
    });

    if (accounts.length === 0) {
        logWarn('No account directories found');
        process.exit(0);
    }

    console.log(`📁 Found ${accounts.length} account(s):\n`);

    const tokens = [];
    const now = Date.now();

    for (const accountId of accounts) {
        const accountDir = path.join(ACCOUNTS_PATH, accountId);
        const tokenFile = path.join(accountDir, 'token.txt');
        const cookiesFile = path.join(accountDir, 'cookies.json');

        // Проверяем наличие cookies.json
        const hasCookies = fs.existsSync(cookiesFile);

        if (!fs.existsSync(tokenFile)) {
            if (hasCookies) {
                // Аккаунт имеет cookies.json но не имеет token.txt
                // Пытаемся извлечь токен из cookies
                logInfo(`  🔍 ${accountId}: Нет token.txt, извлекаю токен из cookies.json...`);

                const tokenFromCookies = extractTokenFromCookies(cookiesFile);

                if (tokenFromCookies) {
                    // Успешно извлекли токен из cookies!
                    logInfo(`  ✅ ${accountId}: Токен извлечён из cookies.json`);
                    fs.writeFileSync(tokenFile, tokenFromCookies, 'utf8');

                    // Теперь обрабатываем как обычный токен
                    const expiryTime = decodeJwtExpiry(tokenFromCookies);
                    let expiryStatus = '✅ Valid';

                    if (expiryTime) {
                        const timeLeft = expiryTime - now;
                        if (timeLeft <= 0) {
                            expiryStatus = '❌ Expired';
                        } else {
                            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            expiryStatus = `⏰ ${days}d ${hours}h left`;
                        }
                    }

                    const tokenEntry = {
                        id: accountId,
                        token: tokenFromCookies,
                        resetAt: null,
                        invalid: false,
                        expiryTime: expiryTime
                    };
                    tokens.push(tokenEntry);
                    console.log(`  ✅ ${accountId}: ${expiryStatus} (из cookies)`);
                } else {
                    // Не удалось извлечь токен из cookies
                    logWarn(`  ⚠️  ${accountId}: Нет токена в cookies.json`);
                    continue;
                }
            } else {
                // Нет ни token.txt ни cookies.json - пропускаем
                logWarn(`  ⚠️  ${accountId}: Нет token.txt и cookies.json - пропускается`);
                continue;
            }
        } else {
            // token.txt существует
            try {
                const token = fs.readFileSync(tokenFile, 'utf8').trim();

                if (!token) {
                    logWarn(`  ⚠️  ${accountId}: Пустой token`);
                    continue;
                }

                // Проверяем это placeholder или реальный токен
                if (token.startsWith('PLACEHOLDER_')) {
                    const hasCookiesNow = fs.existsSync(cookiesFile);
                    logWarn(`  ⚠️  ${accountId}: Placeholder токен${hasCookiesNow ? ' (есть cookies)' : ' (нет cookies)'}`);

                    const tokenEntry = {
                        id: accountId,
                        token: token,
                        resetAt: null,
                        invalid: true,
                        expiryTime: null,
                        needsReauth: true
                    };
                    tokens.push(tokenEntry);
                    console.log(`  ⏸️  ${accountId}: Placeholder (ожидает аутентификации)`);
                    continue;
                }

                // Decode JWT expiry
                const expiryTime = decodeJwtExpiry(token);
                let expiryStatus = '✅ Valid';

                if (expiryTime) {
                    const timeLeft = expiryTime - now;
                    if (timeLeft <= 0) {
                        expiryStatus = '❌ Expired';
                    } else {
                        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        expiryStatus = `⏰ ${days}d ${hours}h left`;
                    }
                } else {
                    expiryStatus = '⚠️  No expiry';
                }

                // Build token entry
                const tokenEntry = {
                    id: accountId,
                    token: token,
                    resetAt: null,
                    invalid: false,
                    expiryTime: expiryTime
                };

                tokens.push(tokenEntry);
                console.log(`  ✅ ${accountId}: ${expiryStatus}`);

            } catch (error) {
                logError(`  ❌ ${accountId}: Error reading token`, error);
            }
        }
    }

    console.log('\n📊 Summary:');
    console.log(`   Total accounts: ${accounts.length}`);
    console.log(`   Valid tokens: ${tokens.length}`);

    // Save tokens.json
    try {
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
        console.log('\n✅ tokens.json rebuilt successfully!');
        console.log(`📄 File: ${TOKENS_FILE}`);
    } catch (error) {
        logError('Failed to save tokens.json', error);
        process.exit(1);
    }

    // Show token details
    console.log('\n📋 Token Details:');
    tokens.forEach((t, i) => {
        const expiryDate = t.expiryTime ? new Date(t.expiryTime).toISOString() : 'N/A';
        console.log(`\n${i + 1}. ${t.id}`);
        console.log(`   Expires: ${expiryDate}`);
        console.log(`   Token: ${t.token.substring(0, 50)}...`);
    });

    console.log('\n✨ Done! You can now start the server.');
}

// Run
rebuildTokens();
