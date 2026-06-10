import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Determine if running as global CLI or local development
const isGlobalInstall = process.env.QWEN_API_PROXY_GLOBAL === 'true';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');

// Use current working directory for global install, package root for development
const BASE_DIR = isGlobalInstall ? process.cwd() : PACKAGE_ROOT;

// Load .env file from working directory
const envPath = path.join(BASE_DIR, '.env');
const dotenvResult = dotenv.config({ path: envPath });
if (dotenvResult.error) {
    console.warn('⚠️  .env file not found, using environment variables');
} else {
    console.log('✅ .env file loaded');
}

// config.js — Единый источник конфигурации проекта.
// Все значения читаются из env-переменных с фоллбэками на дефолты.

function toBoolean(value) {
    if (typeof value === 'boolean') {return value;}
    if (typeof value === 'number') {return value === 1;}
    if (typeof value !== 'string') {return false;}
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

// ─── API URLs ────────────────────────────────────────────────────────────────
const QWEN_BASE_URL = process.env.QWEN_BASE_URL || 'https://chat.qwen.ai';

export const CHAT_API_URL = process.env.CHAT_API_URL || `${QWEN_BASE_URL}/api/v2/chat/completions`;
export const CREATE_CHAT_URL = process.env.CREATE_CHAT_URL || `${QWEN_BASE_URL}/api/v2/chats/new`;
export const CHAT_PAGE_URL = process.env.CHAT_PAGE_URL || `${QWEN_BASE_URL}/`;
export const TASK_STATUS_URL = process.env.TASK_STATUS_URL || `${QWEN_BASE_URL}/api/v1/tasks/status`;
export const STS_TOKEN_API_URL = process.env.STS_TOKEN_API_URL || `${QWEN_BASE_URL}/api/v1/files/getstsToken`;
export const AUTH_SIGNIN_URL = process.env.AUTH_SIGNIN_URL || `${QWEN_BASE_URL}/auth?action=signin`;
export const OSS_SDK_URL = process.env.OSS_SDK_URL || 'https://gosspublic.alicdn.com/aliyun-oss-sdk-6.20.0.min.js';
export const MODELS_API_URL = process.env.MODELS_API_URL || `${QWEN_BASE_URL}/api/v2/models`;

// ─── Таймауты (мс) ──────────────────────────────────────────────────────────
export const PAGE_TIMEOUT = Number(process.env.PAGE_TIMEOUT) || 120_000;
export const AUTH_TIMEOUT = Number(process.env.AUTH_TIMEOUT) || 120_000;
export const NAVIGATION_TIMEOUT = Number(process.env.NAVIGATION_TIMEOUT) || 60_000;
export const RETRY_DELAY = Number(process.env.RETRY_DELAY) || 2_000;
export const STREAMING_CHUNK_DELAY = Number(process.env.STREAMING_CHUNK_DELAY) || 20;
export const TELEGRAM_TIMEOUT = Number(process.env.TELEGRAM_TIMEOUT) || 300_000; // 5 minutes

// ─── Лимиты ─────────────────────────────────────────────────────────────────
export const PAGE_POOL_SIZE = Number(process.env.PAGE_POOL_SIZE) || 3;
export const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10 MB
export const MAX_HISTORY_LENGTH = Number(process.env.MAX_HISTORY_LENGTH) || 100;
export const MAX_RETRY_COUNT = Number(process.env.MAX_RETRY_COUNT) || 3;
export const TASK_POLL_MAX_ATTEMPTS = Number(process.env.TASK_POLL_MAX_ATTEMPTS) || 90;
export const TASK_POLL_INTERVAL = Number(process.env.TASK_POLL_INTERVAL) || 2_000;

// ─── Paths (relative to working directory) ───────────────────────────────────────
export const SESSION_DIR = process.env.SESSION_DIR || 'session';
export const ACCOUNTS_DIR = 'accounts';
export const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';
export const LOGS_DIR = process.env.LOGS_DIR || 'logs';
export const TEMP_DIR = process.env.TEMP_DIR || 'temp';

// Export base directory for use in other modules
export { BASE_DIR };

// ─── Браузер ─────────────────────────────────────────────────────────────────
export const VIEWPORT_WIDTH = Number(process.env.VIEWPORT_WIDTH) || 1920;
export const VIEWPORT_HEIGHT = Number(process.env.VIEWPORT_HEIGHT) || 1080;
export const USER_AGENT = process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ─── Сервер ──────────────────────────────────────────────────────────────────
export const PORT = Number(process.env.PORT) || 3264;
export const HOST = process.env.HOST || '0.0.0.0';
// DEFAULT_MODEL будет установлен динамически из списка моделей, если не задан в .env
export const DEFAULT_MODEL = process.env.DEFAULT_MODEL || null;
export const ALLOW_UNSCOPED_SESSION_CHAT_RESTORE = toBoolean(process.env.ALLOW_UNSCOPED_SESSION_CHAT_RESTORE);

// ─── Режим сессий чата ──────────────────────────────────────────────────────
// FORCE_NEW_CHAT_PER_REQUEST=true: каждый запрос создает новый диалог (как OpenAI API)
// FORCE_NEW_CHAT_PER_REQUEST=false (по умолчанию): восстанавливает предыдущий диалог
export const FORCE_NEW_CHAT_PER_REQUEST = toBoolean(process.env.FORCE_NEW_CHAT_PER_REQUEST);

// ─── Логирование ─────────────────────────────────────────────────────────────
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const LOG_MAX_SIZE = Number(process.env.LOG_MAX_SIZE) || 5_242_880; // 5 MB
export const LOG_MAX_FILES = Number(process.env.LOG_MAX_FILES) || 5;

// ─── Telegram уведомления ───────────────────────────────────────────────────
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || null;
export const TELEGRAM_USER_IDS = process.env.TELEGRAM_USER_IDS
    ? process.env.TELEGRAM_USER_IDS.split(',').map((id) => id.trim()).filter((id) => id)
    : [];
export const TOKEN_EXPIRY_WARNING_MS = Number(process.env.TOKEN_EXPIRY_WARNING_MS) || 3600000; // 1 hour

// ─── Telegram прокси ────────────────────────────────────────────────────────
export const TELEGRAM_PROXY = process.env.TELEGRAM_PROXY || null;
export const TELEGRAM_PROXY_URL = process.env.TELEGRAM_PROXY_URL || null;

// ─── Qwen LLM прокси ────────────────────────────────────────────────────────
export const QWEN_PROXY = process.env.QWEN_PROXY || null;

// ─── Прокси для скачивания файлов ───────────────────────────────────────────
export const FILE_DOWNLOAD_PROXY = process.env.FILE_DOWNLOAD_PROXY || null;

// ─── Генерация изображений ──────────────────────────────────────────────────
// Режим генерации: 'dashscope' (по умолчанию) или 'browser'
// 'dashscope' - использует DASHSCOPE_API_KEY напрямую через DashScope API
// 'browser' - использует браузер (аналогично генерации текста через Qwen Chat)
export const IMAGE_GENERATION_MODE = process.env.IMAGE_GENERATION_MODE || 'dashscope';

// DashScope API ключ (требуется при IMAGE_GENERATION_MODE='dashscope')
export const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || null;
