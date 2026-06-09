#!/usr/bin/env node

/**
 * Session Archive Creator
 * 
 * This script:
 * 1. Opens browser for Qwen authentication
 * 2. Waits for user to login
 * 3. Saves session cookies and tokens
 * 4. Creates a ZIP archive of the session folder
 * 
 * Usage:
 *   npm run create-session-archive
 *   or
 *   node scripts/createSessionArchive.js
 */

import { initBrowser, shutdownBrowser, getBrowserContext } from '../src/browser/browser.js';
import { extractAuthToken } from '../src/api/chat.js';
import { loadAuthToken, saveAuthToken } from '../src/browser/session.js';
import { loadTokens, saveTokens } from '../src/api/tokenManager.js';
import { logInfo, logError, logWarn } from '../src/logger/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { SESSION_DIR } from '../src/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SESSION_PATH = path.resolve(ROOT_DIR, SESSION_DIR);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Prompt user for input
 */
function promptUser(question) {
    return new Promise(resolve => {
        process.stdout.write(question);
        const onData = (data) => {
            process.stdin.removeListener('data', onData);
            process.stdin.pause();
            resolve(data.toString().trim());
        };
        process.stdin.resume();
        process.stdin.once('data', onData);
    });
}

/**
 * Create ZIP archive of session folder
 */
function createSessionArchive() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `session_backup_${timestamp}.zip`;
    const archivePath = path.resolve(ROOT_DIR, archiveName);

    console.log('\n📦 Создание архива сессии...');
    console.log(`📂 Путь к сессии: ${SESSION_PATH}`);
    console.log(`📄 Имя архива: ${archiveName}`);

    try {
        // Check if session directory exists
        if (!fs.existsSync(SESSION_PATH)) {
            throw new Error(`Папка сессии не найдена: ${SESSION_PATH}`);
        }

        // Check if session has any content
        const files = fs.readdirSync(SESSION_PATH);
        if (files.length === 0) {
            throw new Error('Папка сессии пуста. Сначала выполните авторизацию.');
        }

        // Create ZIP archive
        const command = `cd "${ROOT_DIR}" && zip -r "${archiveName}" "${SESSION_DIR}/"`;
        logInfo(`Выполнение команды: ${command}`);
        execSync(command, { stdio: 'inherit' });

        // Verify archive was created
        if (!fs.existsSync(archivePath)) {
            throw new Error('Архив не был создан');
        }

        const stats = fs.statSync(archivePath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        console.log('\n✅ Архив успешно создан!');
        console.log(`📍 Путь: ${archivePath}`);
        console.log(`📏 Размер: ${sizeMB} MB`);
        console.log('\n📤 Теперь вы можете отправить этот архив через Telegram бота');

        return archivePath;
    } catch (error) {
        logError('Ошибка при создании архива', error);
        throw error;
    }
}

/**
 * Main function
 */
async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║           Session Archive Creator                        ║
║                                                          ║
║  This script will:                                       ║
║  1. Open browser for authentication                      ║
║  2. Save session after login                             ║
║  3. Create ZIP archive of session folder                 ║
╚══════════════════════════════════════════════════════════╝
`);

    try {
        // Step 1: Initialize browser
        console.log('\n🌐 Шаг 1/4: Открытие браузера...');
        const browserOk = await initBrowser(true, true);
        
        if (!browserOk) {
            throw new Error('Не удалось инициализировать браузер');
        }

        console.log('✅ Браузер открыт');

        // Step 2: Wait for authentication
        console.log('\n🔐 Шаг 2/4: Авторизация...');
        console.log('\n' + '─'.repeat(60));
        console.log('📋 ИНСТРУКЦИЯ:');
        console.log('   1. Войдите в систему через GitHub или другой способ');
        console.log('   2. Дождитесь полной загрузки главной страницы');
        console.log('   3. Вернитесь в консоль и нажмите ENTER');
        console.log('─'.repeat(60));

        await promptUser('\n👉 Нажмите ENTER после успешной авторизации...');

        // Step 3: Extract and save session
        console.log('\n💾 Шаг 3/4: Сохранение сессии...');
        
        const ctx = getBrowserContext();
        let token = await extractAuthToken(ctx, true);

        if (!token) {
            token = loadAuthToken();
            if (token) {
                logInfo('Токен получен из сохраненного файла');
            }
        }

        if (!token) {
            logWarn('Токен не получен, но продолжаем (возможно сессия сохранена)');
        } else {
            // Save token
            const accountId = 'acc_' + Date.now();
            const accountDir = path.resolve(SESSION_PATH, 'accounts', accountId);
            
            if (!fs.existsSync(accountDir)) {
                fs.mkdirSync(accountDir, { recursive: true });
            }

            fs.writeFileSync(path.join(accountDir, 'token.txt'), token, 'utf8');
            saveAuthToken(token);

            // Save cookies
            try {
                const cookies = await ctx.cookies();
                fs.writeFileSync(path.join(accountDir, 'cookies.json'), JSON.stringify(cookies, null, 2));
                logInfo(`Cookies сохранены для аккаунта ${accountId} (${cookies.length} cookies)`);
            } catch (error) {
                logWarn('Не удалось сохранить cookies, но токен сохранен', error);
            }

            // Update tokens.json
            const tokens = loadTokens();
            tokens.push({ id: accountId, token, resetAt: null });
            saveTokens(tokens);

            console.log(`✅ Сессия сохранена: ${accountId}`);
        }

        // Close browser
        await shutdownBrowser();
        console.log('✅ Браузер закрыт');

        // Step 4: Create archive
        console.log('\n📦 Шаг 4/4: Создание архива...');
        const archivePath = createSessionArchive();

        console.log('\n' + '═'.repeat(60));
        console.log('🎉 ГОТОВО!');
        console.log('═'.repeat(60));
        console.log(`\n📄 Архив: ${archivePath}`);
        console.log('\n📱 Следующие шаги:');
        console.log('   1. Откройте Telegram бота');
        console.log('   2. Нажмите 📎 (скрепка)');
        console.log('   3. Выберите "Файл" (НЕ "Фото"!)');
        console.log('   4. Отправьте архив боту');
        console.log('   5. Дождитесь подтверждения');
        console.log('\n✨ Успехов!');

    } catch (error) {
        logError('Ошибка при создании архива сессии', error);
        console.error('\n❌ Произошла ошибка:', error.message);
        
        // Try to cleanup
        try {
            await shutdownBrowser();
        } catch (e) {
            // ignore
        }
        
        process.exit(1);
    }
}

// Run
main().catch(error => {
    logError('Fatal error', error);
    process.exit(1);
});
