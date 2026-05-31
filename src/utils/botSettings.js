import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError, logWarn } from '../logger/index.js';
import { SESSION_DIR } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Пути к файлам настроек
const SETTINGS_FILE = path.join(process.cwd(), SESSION_DIR, 'bot_settings.json');

/**
 * Загружает настройки бота из файла
 */
export function loadBotSettings() {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) {
            logInfo('📝 Файл настроек бота не найден, используем значения по умолчанию');
            return {
                activeModel: null,
                llmChatEnabled: false,
                lastUpdated: null
            };
        }

        const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        logInfo(`✅ Настройки бота загружены: модель=${settings.activeModel || 'default'}, LLM=${settings.llmChatEnabled}`);
        return settings;
    } catch (error) {
        logError('❌ Ошибка загрузки настроек бота', error);
        return {
            activeModel: null,
            llmChatEnabled: false,
            lastUpdated: null
        };
    }
}

/**
 * Сохраняет настройки бота в файл
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
