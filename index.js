import express from 'express';
import bodyParser from 'body-parser';

import { initBrowser, shutdownBrowser } from './src/browser/browser.js';
import apiRoutes from './src/api/routes.js';
import { getAvailableModelsFromFile, fetchModelsFromAPI, getDefaultModel, getApiKeys } from './src/api/chat.js';
import { loadTokens } from './src/api/tokenManager.js';
import { addAccountInteractive } from './src/utils/accountSetup.js';
import { logHttpRequest, logInfo, logError, logWarn, logDebug } from './src/logger/index.js';
import { prompt } from './src/utils/prompt.js';
import { PORT, HOST } from './src/config.js';
import { startTelegramBot, stopTelegramBot, notifyAllUsers, configureProxy, processPendingArchive, checkAllSubsystems, startPeriodicHealthCheck } from './src/utils/telegramBot.js';
import { getProxyInfo } from './src/utils/proxy.js';
import { checkPermissions } from './src/utils/permissionChecker.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { SESSION_DIR } from './src/config.js';

const app = express();

const port = Number.parseInt(process.env.PORT ?? PORT, 10);
const host = process.env.HOST || HOST;

if (Number.isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`Некорректное значение переменной PORT: ${process.env.PORT}`);
}

function toBoolean(value) {
    if (typeof value !== 'string') return false;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

const skipAccountMenu = toBoolean(process.env.SKIP_ACCOUNT_MENU) || toBoolean(process.env.NON_INTERACTIVE);

function ensureNonInteractiveTokens() {
    const tokens = loadTokens();
    if (!tokens.length) {
        logWarn('⚠️ Не найдено ни одного аккаунта. Сервер работает в режиме Telegram бота.');
        logWarn('📦 Отправьте архив с сессиями через Telegram бот для добавления аккаунтов.');
        // Не выходим - позволяем работать как бот для получения архивов
        return false;
    }
    const now = Date.now();
    const validTokens = tokens.filter(t => (!t.resetAt || new Date(t.resetAt).getTime() <= now) && !t.invalid);
    if (!validTokens.length) {
        logWarn('⚠️ Все аккаунты недоступны. Сервер работает в режиме Telegram бота.');
        logWarn('📦 Отправьте архив с сессиями через Telegram бот для обновления аккаунтов.');
        // Не выходим - позволяем работать как бот
        return false;
    }
    logInfo(`Автоматический запуск: обнаружено ${tokens.length} аккаунтов, из них ${validTokens.length} активны.`);
    return true;
}

app.use(logHttpRequest);
app.use(bodyParser.json({ limit: '150mb' }));
app.use(bodyParser.urlencoded({ limit: '150mb', extended: true }));

app.use((err, req, res, next) => {
    const isJsonSyntaxError = err instanceof SyntaxError && err.status === 400 && Object.prototype.hasOwnProperty.call(err, 'body');

    if (isJsonSyntaxError) {
        logWarn(`Некорректный JSON в запросе: ${err.message}`);
        return res.status(400).json({
            error: 'Некорректный JSON',
            message: 'Проверьте тело запроса: используйте валидный JSON с двойными кавычками.'
        });
    }

    return next(err);
});

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use('/api', apiRoutes);

app.use((req, res) => {
    logWarn(`404 Not Found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: 'Эндпоинт не найден' });
});

app.use((err, req, res, next) => {
    logError('Внутренняя ошибка сервера', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
process.on('SIGHUP', handleShutdown);
process.on('uncaughtException', async (error) => {
    logError('Необработанное исключение', error);
    await handleShutdown();
});

async function handleShutdown() {
    logInfo('\nПолучен сигнал завершения. Закрываем браузер...');
    stopTelegramBot();
    await shutdownBrowser();
    logInfo('Завершение работы.');
    process.exit(0);
}

/**
 * Создает ZIP архив папки session/
 */
function createSessionArchive() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `session_backup_${timestamp}.zip`;
    const archivePath = path.resolve(process.cwd(), archiveName);
    const sessionPath = path.resolve(process.cwd(), SESSION_DIR);

    console.log('\n📦 Создание архива сессии...');
    console.log(`📂 Путь к сессии: ${sessionPath}`);
    console.log(`📄 Имя архива: ${archiveName}`);

    try {
        // Проверяем существование папки сессии
        if (!fs.existsSync(sessionPath)) {
            throw new Error(`Папка сессии не найдена: ${sessionPath}`);
        }

        // Проверяем содержимое
        const files = fs.readdirSync(sessionPath);
        if (files.length === 0) {
            throw new Error('Папка сессии пуста. Сначала выполните авторизацию.');
        }

        // Создаем ZIP архив
        const command = `cd "${process.cwd()}" && zip -r "${archiveName}" "${SESSION_DIR}/"`;
        logInfo(`Выполнение команды: ${command}`);
        execSync(command, { stdio: 'inherit' });

        // Проверяем создание архива
        if (!fs.existsSync(archivePath)) {
            throw new Error('Архив не был создан');
        }

        const stats = fs.statSync(archivePath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        console.log('\n✅ Архив успешно создан!');
        console.log(`📍 Путь: ${archivePath}`);
        console.log(`📏 Размер: ${sizeMB} MB`);

        return archivePath;
    } catch (error) {
        logError('Ошибка при создании архива', error);
        throw error;
    }
}

/**
 * Проверяет наличие и содержимое .gitignore в корневой директории
 */
function validateGitignore() {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const requiredEntries = [
        'session',
        'logs',
        'uploads',
        'temp',
        'session_backup',
        'session_backup_*'
    ];
    
    if (!fs.existsSync(gitignorePath)) {
        logWarn('⚠️  Файл .gitignore не найден в корневой директории');
        logWarn('   Рекомендуется создать .gitignore для защиты чувствительных данных');
        return false;
    }
    
    const content = fs.readFileSync(gitignorePath, 'utf8');
    const lines = content.split('\n').map(line => line.trim());
    const missingEntries = [];
    
    requiredEntries.forEach(entry => {
        if (!lines.includes(entry)) {
            missingEntries.push(entry);
        }
    });
    
    if (missingEntries.length > 0) {
        logWarn(`⚠️  .gitignore отсутствует: ${missingEntries.join(', ')}`);
        logWarn('   Добавьте эти записи в .gitignore для защиты данных');
        return false;
    }
    
    logInfo('✅ .gitignore проверен - все записи на месте');
    return true;
}

/**
 * Обрабатывает CLI команды
 */
async function handleCLICommand() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        return false; // Нет команды, продолжаем обычный запуск
    }

    if (command === 'archive' || command === '--archive') {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║           Session Archive Creator                        ║');
        console.log('║                                                          ║');
        console.log('║  Создание ZIP архива папки session/                      ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');

        try {
            const archivePath = createSessionArchive();
            console.log('\n🎉 ГОТОВО!');
            console.log(`📄 Архив: ${archivePath}`);
            console.log('\n📱 Следующие шаги:');
            console.log('   1. Откройте Telegram бота');
            console.log('   2. Нажмите 📎 (скрепка)');
            console.log('   3. Выберите "Файл" (НЕ "Фото"!)');
            console.log('   4. Отправьте архив боту');
            console.log('   5. Дождитесь подтверждения\n');
            process.exit(0);
        } catch (error) {
            logError('Ошибка при создании архива', error);
            process.exit(1);
        }
    }

    return false;
}

async function startServer() {
    console.log(`
███████ ██████  ███████ ███████  ██████  ██     ██ ███████ ███    ██  █████  ██████  ██ 
██      ██   ██ ██      ██      ██    ██ ██     ██ ██      ████   ██ ██   ██ ██   ██ ██ 
█████   ██████  █████   █████   ██    ██ ██  █  ██ █████   ██ ██  ██ ███████ ██████  ██ 
██      ██   ██ ██      ██      ██ ▄▄ ██ ██ ███ ██ ██      ██  ██ ██ ██   ██ ██      ██ 
██      ██   ██ ███████ ███████  ██████   ███ ███  ███████ ██   ████ ██   ██ ██      ██ 
                                    ▀▀                                                    
   API-прокси для Qwen 
`);

    logInfo('Запуск сервера...');

    // ПЕРВЫМ ДЕЛОМ: Проверяем права доступа ко всем директориям и файлам
    const permissionsOk = await checkPermissions();
    if (!permissionsOk) {
        logError('⛔ НЕВОЗМОЖНО ЗАПУСТИТЬСЯ: Исправьте права доступа и перезапустите сервер');
        process.exit(1);
    }

    await configureProxy();


    // ПЕРВЫМ ДЕЛОМ: Проверяем и обрабатываем ожидающий архив
    const archiveProcessed = await processPendingArchive();
    if (archiveProcessed) {
        logInfo('✅ Ожидющий архив успешно распакован при запуске');
    }

    // Проверяем .gitignore
    validateGitignore();

    // Проверяем флаг перезапуска
    const restartFlagPath = path.join(process.cwd(), '.restart_flag');
    if (fs.existsSync(restartFlagPath)) {
        try {
            const restartInfo = JSON.parse(fs.readFileSync(restartFlagPath, 'utf8'));
            logInfo(`🔄 Обнаружен флаг перезапуска: ${restartInfo.reason}`);
            fs.unlinkSync(restartFlagPath);
        } catch (e) {
            logWarn('Ошибка чтения флага перезапуска', e);
        }
    }

    if (!skipAccountMenu) {
        while (true) {
            const tokens = loadTokens();
            console.log('\nСписок аккаунтов:');
            if (!tokens.length) {
                console.log('  (пусто)');
            } else {
                tokens.forEach((token, i) => {
                    const now = Date.now();
                    const isInvalid = token.invalid === true;
                    const isWaiting = Boolean(token.resetAt && new Date(token.resetAt).getTime() > now);
                    const statusLabel = isInvalid ? '❌ Недействителен' : isWaiting ? '⏳ Ожидание сброса' : '✅ OK';
                    const statusCode = isInvalid ? 0 : isWaiting ? 1 : 2;
                    console.log(`${String(i + 1).padStart(2, ' ')} | ${token.id} | ${statusLabel} (${statusCode})`);
                });
            }
            console.log('\n=== Меню ===');
            console.log('1 - Добавить новый аккаунт');
            console.log('2 - Перелогинить аккаунт с истекшим токеном');
            console.log('3 - Запустить прокси (по умолчанию)');
            console.log('4 - Удалить аккаунт');

            let choice = await prompt('Ваш выбор (Enter = 3): ');
            if (!choice) choice = '3';

            if (choice === '1') {
                await addAccountInteractive();
            } else if (choice === '2') {
                const { reloginAccountInteractive } = await import('./src/utils/accountSetup.js');
                await reloginAccountInteractive();
            } else if (choice === '3') {
                const hasValidToken = tokens.some(t => {
                    if (t.invalid) return false;
                    if (!t.resetAt) return true;
                    return new Date(t.resetAt).getTime() <= Date.now();
                });
                if (!tokens.length || !hasValidToken) {
                    console.log('Нужен хотя бы один валидный аккаунт для запуска.');
                    continue;
                }
                break;
            } else if (choice === '4') {
                const { removeAccountInteractive } = await import('./src/utils/accountSetup.js');
                await removeAccountInteractive();
            }
        }
    } else {
        const hasValidTokens = ensureNonInteractiveTokens();
        // Если нет токенов, браузер не нужен - работаем только как бот
        if (!hasValidTokens) {
            logInfo('🤖 Режим Telegram бота: ожидание архива с сессиями...');
        }
    }

    const browserInitialized = await initBrowser(false);
    if (!browserInitialized) {
        const tokens = loadTokens();
        if (tokens.length > 0) {
            logError('Не удалось инициализировать браузер. Завершение работы.');
            process.exit(1);
        } else {
            logWarn('⚠️ Браузер не инициализирован, но бот продолжит работу для получения сессий');
        }
    }

    // Запускаем Telegram бота
    const telegramBotStarted = await startTelegramBot();
    if (telegramBotStarted) {
        logInfo('🤖 Telegram бот запущен и готов принимать команды');
    }

    // Проверяем все подсистемы
    await checkAllSubsystems(telegramBotStarted);

    // Логируем информацию о прокси
    const proxyInfo = getProxyInfo();
    if (proxyInfo.telegram.configured) {
        logInfo(`📱 Telegram Прокси: ${proxyInfo.telegram.url} (${proxyInfo.telegram.active ? '✅ активен' : '❌ неактивен'})`);
    } else {
        logInfo('📱 Telegram Прокси: не настроен');
    }
    if (proxyInfo.qwen.configured) {
        logInfo(`🧠 Qwen LLM Прокси: ${proxyInfo.qwen.url} (${proxyInfo.qwen.active ? '✅ активен' : '❌ неактивен'})`);
    } else {
        logInfo('🧠 Qwen LLM Прокси: не настроен');
    }

    // Запускаем периодическую проверку здоровья каждые 4 часа
    if (telegramBotStarted) {
        startPeriodicHealthCheck();
    }

    try {
        app.listen(port, host, async () => {
            const displayHost = host === '0.0.0.0' ? 'localhost' : host;
            logInfo(`Сервер запущен на ${host}:${port}`);
            logInfo(`API доступен по адресу: http://${displayHost}:${port}/api`);
            logInfo('Для проверки статуса авторизации: GET /api/status');
            logInfo('Для отправки сообщения: POST /api/chat');
            logInfo('Для получения списка моделей: GET /api/models');
            logInfo('======================================================');
            logInfo('API v2 - История чатов хранится на серверах Qwen');
            logInfo('Создать новый чат: POST /api/chats');
            logInfo('Отправить сообщение: POST /api/chat (с chatId и parentId)');
            logInfo('======================================================');
            logInfo('Доступно 25 моделей Qwen (через систему маппинга):');
            logInfo('- Стандартные: qwen-max, qwen-plus, qwen-turbo и их latest-версии');
            logInfo('- Coder: qwen3-coder-plus, qwen2.5-coder-*b-instruct (0.5b - 32b)');
            logInfo('- Визуальные: qwen-vl-max, qwen-vl-plus и их latest-версии');
            logInfo('- Qwen 3: qwen3, qwen3-max, qwen3-plus, qwen3-omni-flash');
            logInfo('- Qwen 3.5: qwen3.5-plus, qwen3.5-flash, qwen3.5-397b-a17b, qwen3.5-122b-a10b, qwen3.5-27b, qwen3.5-35b-a3b');
            logInfo('======================================================');
            logInfo('Формат JSON запроса на чат:');
            logInfo('{ "message": "текст сообщения", "model": "название модели (опционально)", "chatId": "ID чата (опционально)", "parentId": "ID родительского сообщения (опционально)" }');
            logInfo('Пример первого запроса: { "message": "Привет, как дела?" }');
            logInfo('Пример второго запроса: { "message": "А что ты умеешь?", "chatId": "полученный_id_чата", "parentId": "полученный_parentId" }');
            logInfo('======================================================');
            logInfo('Поддержка OpenAI совместимого API: POST /api/chat/completions');
            logInfo('В ответе возвращаются chatId и parentId для продолжения диалога');
            logInfo('======================================================');

            // Загружаем список моделей (сначала из API, потом из файла как fallback)
            logInfo('🔍 Начинаем загрузку списка моделей...');
            const apiModels = await fetchModelsFromAPI();
            logDebug(`fetchModelsFromAPI вернул: ${apiModels ? apiModels.length + ' моделей' : 'null'}`);
            
            if (apiModels && apiModels.length > 0) {
                logInfo(`✅ Загружено ${apiModels.length} моделей с Qwen API`);
                logDebug(`Первые 5 моделей: ${apiModels.slice(0, 5).join(', ')}`);
                // Можно сохранить в файл при необходимости
            } else {
                logWarn('⚠️ Используем модели из локального файла');
                logDebug('Вызываем getAvailableModelsFromFile()...');
                const fileModels = getAvailableModelsFromFile();
                logDebug(`getAvailableModelsFromFile вернул: ${fileModels ? fileModels.length + ' моделей' : 'null'}`);
            }
            
            const defaultModel = getDefaultModel();
            logInfo(`🎯 Модель по умолчанию: ${defaultModel}`);
            logDebug(`getDefaultModel() вернул: ${defaultModel}`);
            
            getApiKeys();
        });
    } catch (err) {
        if (err.code === 'EADDRINUSE') {
            logError(`Порт ${port} уже используется. Возможно, сервер уже запущен.`);
            await shutdownBrowser();
            process.exit(1);
        }
        throw err;
    }
}

// Проверяем CLI команды перед запуском сервера
handleCLICommand().then(hasCommand => {
    if (!hasCommand) {
        // Нет команды CLI, запускаем сервер как обычно
        startServer().catch(async error => {
            logError('Ошибка при запуске сервера', error);
            await shutdownBrowser();
            process.exit(1);
        });
    }
});
