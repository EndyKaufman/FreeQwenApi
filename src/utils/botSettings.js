import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError, logWarn } from '../logger/index.js';
import { SESSION_DIR, DEFAULT_MODEL } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Пути к файлам настроек
const SETTINGS_FILE = path.join(process.cwd(), SESSION_DIR, 'bot_settings.json');

// Кэш настроек
let settingsCache = null;
let settingsCacheMTime = null; // Время последнего изменения файла

/**
 * Проверяет изменился ли файл с момента последнего чтения
 */
function hasFileChanged() {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) {
            return true; // Файл не существует, нужно перечитать
        }

        const stats = fs.statSync(SETTINGS_FILE);
        const currentMTime = stats.mtimeMs;

        // Если кэш пуст или время изменения отличается - файл изменился
        return !settingsCacheMTime || currentMTime !== settingsCacheMTime;
    } catch (error) {
        return true; // При ошибке перечитываем
    }
}

/**
 * Загружает настройки бота из файла (с кэшированием)
 */
export function loadBotSettings() {
    try {
        // Проверяем есть ли файл
        if (!fs.existsSync(SETTINGS_FILE)) {
            if (!settingsCache) {
                logInfo('📝 Файл настроек бота не найден, используем значения по умолчанию');
            }
            const defaultSettings = {
                activeModel: null,
                llmChatEnabled: false,
                lastUpdated: null
            };
            settingsCache = defaultSettings;
            settingsCacheMTime = null;
            return defaultSettings;
        }

        // Проверяем изменился ли файл
        if (!hasFileChanged() && settingsCache) {
            // Файл не изменился, возвращаем кэш
            return settingsCache;
        }

        // Файл изменился или кэш пуст - читаем файл
        const stats = fs.statSync(SETTINGS_FILE);
        settingsCacheMTime = stats.mtimeMs;

        const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        settingsCache = settings;

        logInfo(`✅ Настройки бота загружены из файла: модель=${settings.activeModel || 'default'}, LLM=${settings.llmChatEnabled}`);
        return settings;
    } catch (error) {
        logError('❌ Ошибка загрузки настроек бота', error);
        // Возвращаем кэш если есть, иначе defaults
        if (settingsCache) {
            logWarn('⚠️ Используется кэш настроек из-за ошибки чтения');
            return settingsCache;
        }
        return {
            activeModel: null,
            llmChatEnabled: false,
            lastUpdated: null
        };
    }
}

/**
 * Сохраняет настройки бота в файл и обновляет кэш
 */
export function saveBotSettings(settings) {
    try {
        // Создаем директорию session если не существует
        const sessionPath = path.join(process.cwd(), SESSION_DIR);
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }

        settings.lastUpdated = new Date().toISOString();

        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');

        // Обновляем кэш
        settingsCache = settings;
        // Обновляем время модификации
        const stats = fs.statSync(SETTINGS_FILE);
        settingsCacheMTime = stats.mtimeMs;

        logInfo(`💾 Настройки бота сохранены: модель=${settings.activeModel || 'default'}, LLM=${settings.llmChatEnabled}`);
        return true;
    } catch (error) {
        logError('❌ Ошибка сохранения настроек бота', error);
        return false;
    }
}

/**
 * Загружает модели для конкретных чатов (не используется, все используют activeModel)
 */
export function loadChatModels() {
    return {};
}

/**
 * Сохраняет модели для конкретных чатов (не используется, все используют activeModel)
 */
export function saveChatModels(chatModels) {
    return true;
}

/**
 * Принудительно очищает кэш настроек
 * Используйте если файл был изменен вручную
 */
export function clearSettingsCache() {
    settingsCache = null;
    settingsCacheMTime = null;
    logInfo('🗑️ Кэш настроек очищен');
}

/**
 * Получает активную модель из настроек бота
 * Приоритет: activeModel из bot_settings.json > DEFAULT_MODEL из .env > первая модель из AvailableModels.txt
 * @returns {string} название модели
 */
export function getActiveModel() {
    try {
        const settings = loadBotSettings();

        // Если есть activeModel в настройках бота - используем его
        if (settings && settings.activeModel) {
            return settings.activeModel;
        }

        // Иначе используем DEFAULT_MODEL из .env
        if (DEFAULT_MODEL) {
            return DEFAULT_MODEL;
        }

        // Fallback: первая модель из списка доступных
        try {
            const modelsFile = path.join(process.cwd(), 'src', 'AvailableModels.txt');
            if (fs.existsSync(modelsFile)) {
                const modelsContent = fs.readFileSync(modelsFile, 'utf8');
                const models = modelsContent.split('\n').map((m) => m.trim()).filter((m) => m && !m.startsWith('#'));
                if (models.length > 0) {
                    return models[0];
                }
            }
        } catch (e) {
            // Если не удалось загрузить список моделей
        }

        // Последний fallback
        return 'qwen3.5-plus';
    } catch (error) {
        logError('❌ Ошибка получения активной модели', error);
        return 'qwen3.5-plus';
    }
}

/**
 * Получает текущий статус кэша (для отладки)
 */
export function getCacheStatus() {
    return {
        hasCache: settingsCache !== null,
        cacheMTime: settingsCacheMTime,
        cachedModel: settingsCache?.activeModel || null,
        cachedLLM: settingsCache?.llmChatEnabled || false
    };
}

/**
 * Устанавливает модель для конкретного чата
 */
export function setChatModel(chatId, modelName) {
    try {
        const chatModels = loadChatModels();
        chatModels[String(chatId)] = modelName;
        return saveChatModels(chatModels);
    } catch (error) {
        logError(`❌ Ошибка установки модели для чата ${chatId}`, error);
        return false;
    }
}

/**
 * Получает модель для конкретного чата
 */
export function getChatModel(chatId) {
    try {
        const chatModels = loadChatModels();
        return chatModels[String(chatId)] || null;
    } catch (error) {
        logError(`❌ Ошибка получения модели для чата ${chatId}`, error);
        return null;
    }
}

/**
 * Удаляет модель для конкретного чата
 */
export function removeChatModel(chatId) {
    try {
        const chatModels = loadChatModels();
        delete chatModels[String(chatId)];
        return saveChatModels(chatModels);
    } catch (error) {
        logError(`❌ Ошибка удаления модели для чата ${chatId}`, error);
        return false;
    }
}
