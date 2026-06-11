import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { initBrowser, shutdownBrowser, getBrowserContext } from '../browser/browser.js';
import { extractAuthToken } from '../api/chat.js';
import { loadTokens, saveTokens, markValid, removeToken } from '../api/tokenManager.js';
import { loadAuthToken } from '../browser/session.js';
import { logInfo, logError, logWarn } from '../logger/index.js';
import { prompt } from './prompt.js';
import { SESSION_DIR, ACCOUNTS_DIR } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function ensureAccountDir(id) {
    const accountDir = path.resolve(__dirname, '..', '..', SESSION_DIR, ACCOUNTS_DIR, id);
    if (!fs.existsSync(accountDir)) {fs.mkdirSync(accountDir, { recursive: true });}
    return accountDir;
}

export async function addAccountInteractive() {
    logInfo('======================================================');
    logInfo('Добавление нового аккаунта Qwen');
    logInfo('Браузер откроется, войдите в систему, затем вернитесь к консоли.');
    logInfo('======================================================');

    const ok = await initBrowser(true, true);
    if (!ok) {
        logError('Не удалось запустить браузер.');
        return null;
    }

    const ctx = getBrowserContext();
    let token = await extractAuthToken(ctx, true);

    if (!token) {
        token = loadAuthToken();
        if (token) {logInfo('Токен получен из сохранённого файла.');}
    }

    if (!token) {
        logError('Токен не был получен. Аккаунт не добавлен.');
        await shutdownBrowser();
        return null;
    }

    const id = 'acc_' + Date.now();

    // Save cookies before shutting down browser
    try {
        const cookies = await ctx.cookies();
        const accountDir = path.resolve(__dirname, '..', '..', SESSION_DIR, ACCOUNTS_DIR);
        const accDir = path.join(accountDir, id);
        if (!fs.existsSync(accDir)) {fs.mkdirSync(accDir, { recursive: true });}
        fs.writeFileSync(path.join(accDir, 'cookies.json'), JSON.stringify(cookies, null, 2), 'utf8');
        logInfo(`Cookies сохранены для аккаунта ${id} (${cookies.length} cookies)`);
    } catch (error) {
        logWarn('Не удалось сохранить cookies, но токен был сохранен', error);
    }

    await shutdownBrowser();

    ensureAccountDir(id);
    fs.writeFileSync(path.resolve(__dirname, '..', '..', SESSION_DIR, ACCOUNTS_DIR, id, 'token.txt'), token, 'utf8');

    const list = loadTokens();
    list.push({ id, token, resetAt: null });
    saveTokens(list);

    logInfo(`Аккаунт '${id}' добавлен. Всего аккаунтов: ${list.length}`);
    logInfo('======================================================');
    return id;
}

export async function interactiveAccountMenu() {
    while (true) {
        console.log('\n=== Меню управления аккаунтами ===');
        console.log('1 - Добавить новый аккаунт');
        console.log('2 - Завершить');
        const choice = await prompt('Ваш выбор (1/2): ');
        if (choice === '1') {await addAccountInteractive();}
        else if (choice === '2') {break;}
        else {console.log('Неверный выбор.');}
    }
}

export async function reloginAccountInteractive() {
    const tokens = loadTokens();
    const invalids = tokens.filter((t) => t.invalid);
    if (!invalids.length) {
        console.log('Нет аккаунтов, требующих повторного входа.');
        await prompt('Нажмите ENTER чтобы вернуться в меню...');
        return;
    }

    console.log('\nАккаунты с истекшим токеном:');
    invalids.forEach((t, idx) => console.log(`${idx + 1} - ${t.id}`));
    const choice = await prompt('Выберите номер аккаунта для повторного входа: ');
    const num = parseInt(choice, 10);
    if (isNaN(num) || num < 1 || num > invalids.length) {
        console.log('Неверный выбор.');
        return;
    }
    const account = invalids[num - 1];

    logInfo(`Повторная авторизация для ${account.id}`);
    const ok = await initBrowser(true, true);
    if (!ok) { logError('Не удалось запустить браузер.'); return; }

    const ctx = getBrowserContext();
    const token = await extractAuthToken(ctx, true);

    // Save cookies before shutting down browser
    try {
        const cookies = await ctx.cookies();
        const accountDir = path.resolve(__dirname, '..', '..', SESSION_DIR, ACCOUNTS_DIR);
        const accDir = path.join(accountDir, account.id);
        if (!fs.existsSync(accDir)) {fs.mkdirSync(accDir, { recursive: true });}
        fs.writeFileSync(path.join(accDir, 'cookies.json'), JSON.stringify(cookies, null, 2), 'utf8');
        logInfo(`Cookies обновлены для аккаунта ${account.id} (${cookies.length} cookies)`);
    } catch (error) {
        logWarn('Не удалось сохранить cookies, но токен был обновлен', error);
    }

    await shutdownBrowser();

    if (!token) { logError('Не удалось извлечь токен.'); return; }

    markValid(account.id, token);
    fs.writeFileSync(path.resolve(__dirname, '..', '..', SESSION_DIR, ACCOUNTS_DIR, account.id, 'token.txt'), token, 'utf8');
    logInfo(`Токен обновлён для ${account.id}`);
}

export async function removeAccountInteractive() {
    const tokens = loadTokens();
    if (!tokens.length) {
        console.log('Нет сохранённых аккаунтов.');
        await prompt('ENTER чтобы вернуться...');
        return;
    }

    const now = Date.now();
    const validTokens = tokens.filter((t) => {
        if (t.invalid) {return false;}
        if (t.resetAt && new Date(t.resetAt).getTime() > now) {return false;}
        if (t.expiryTime && t.expiryTime <= now) {return false;}
        // Проверяем наличие cookies.json
        const cookiesPath = path.resolve(__dirname, '..', '..', SESSION_DIR, ACCOUNTS_DIR, t.id, 'cookies.json');
        if (!fs.existsSync(cookiesPath)) {return false;}
        return true;
    });

    if (validTokens.length === 0) {
        console.log('Нет действительных аккаунтов.');
        await prompt('ENTER чтобы вернуться...');
        return;
    }

    console.log('\nДоступные аккаунты:');
    validTokens.forEach((t, idx) => console.log(`${idx + 1} - ${t.id}`));
    const choice = await prompt('Номер аккаунта, который нужно удалить (или ENTER для отмены): ');
    if (!choice) {return;}
    const num = parseInt(choice, 10);
    if (isNaN(num) || num < 1 || num > validTokens.length) {
        console.log('Неверный выбор.');
        await prompt('ENTER чтобы вернуться...');
        return;
    }

    const acc = validTokens[num - 1];
    const confirm = await prompt(`Точно удалить ${acc.id}? (y/N): `);
    if (confirm.toLowerCase() !== 'y') {return;}

    removeToken(acc.id);
    const dir = path.resolve(__dirname, '..', '..', SESSION_DIR, ACCOUNTS_DIR, acc.id);
    if (fs.existsSync(dir)) {fs.rmSync(dir, { recursive: true, force: true });}

    logInfo(`Аккаунт ${acc.id} удалён.`);
    await prompt('ENTER чтобы вернуться...');
}
