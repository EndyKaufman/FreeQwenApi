import express from 'express';
import { sendMessage, getAllModels, getApiKeys, createChatV2, pollTaskStatus, pagePool, extractAuthToken } from './chat.js';
import { getAuthenticationStatus, getBrowserContext } from '../browser/browser.js';
import { checkAuthentication } from '../browser/auth.js';
import { logInfo, logError, logDebug, logWarn } from '../logger/index.js';
import { getMappedModel } from './modelMapping.js';
import { getStsToken, uploadFileToQwen } from './fileUpload.js';
import { loadHistory, saveHistory } from './chatHistory.js';
import { generateImage, getAvailableImageModels, checkImageApiAvailability } from './imageGeneration.js';
import { MAX_FILE_SIZE, UPLOADS_DIR, STREAMING_CHUNK_DELAY, ALLOW_UNSCOPED_SESSION_CHAT_RESTORE, IMAGE_GENERATION_MODE, DASHSCOPE_API_KEY, FORCE_NEW_CHAT_PER_REQUEST, SESSION_DIR } from '../config.js';
import { getActiveModel } from '../utils/botSettings.js';
import { getFileDownloadProxyAgent } from '../utils/proxy.js';
import { ProxyAgent as UndiciProxyAgent } from 'undici';
import nodeFetch from 'node-fetch';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { listTokens, markInvalid, markRateLimited, markValid } from './tokenManager.js';

// Compatibility layer for Node.js 18-24
const useNativeFetch = typeof globalThis.fetch !== 'undefined';

/**
 * Создает правильный агент для текущей версии Node.js
 */
function createRoutesProxyAgent(proxyUrl) {
    if (useNativeFetch) {
        return new UndiciProxyAgent(proxyUrl);
    }
    return new UndiciProxyAgent(proxyUrl);
}

/**
 * Универсальный fetch с поддержкой прокси для Node.js 18-24
 */
async function universalRoutesFetch(url, options = {}, proxyAgent = null) {
    const controller = new AbortController();
    const timeout = options.timeout || 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const fetchOptions = {
            ...options,
            signal: controller.signal
        };

        if (proxyAgent) {
            if (useNativeFetch) {
                fetchOptions.dispatcher = proxyAgent;
            } else {
                fetchOptions.agent = proxyAgent;
            }
        }

        const fetchFn = useNativeFetch ? globalThis.fetch : nodeFetch;
        const response = await fetchFn(url, fetchOptions);
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// ─── Helpers: File processing ────────────────────────────────────────────────

/**
 * Обрабатывает файлы из разных форматов и возвращает формат для Qwen API
 * Поддерживает:
 * 1. Base64 data URLs (data:image/jpeg;base64,...)
 * 2. HTTP/HTTPS URLs (скачивает и загружает в OSS)
 * 3. Локальные файлы (загруженные через multer)
 *
 * Возвращает массив в формате: [{type: 'image', image: 'url'}] или [{type: 'file', file: 'url'}]
 */
async function processFilesForQwen(files) {
    if (!files || !Array.isArray(files) || files.length === 0) {
        return [];
    }

    const qwenFiles = [];
    const tempFiles = [];

    try {
        for (const file of files) {
            let fileUrl = null;

            // Формат 1: {url: 'data:image/...;base64,...'} или {url: 'http://...'}
            if (file.url) {
                // Если это base64 data URL - сохраняем во временный файл и загружаем в OSS
                if (file.url.startsWith('data:')) {
                    const [header, base64Data] = file.url.split(',');
                    const mimeType = header.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
                    const ext = mimeType.split('/')[1]?.split('+')[0] || 'bin';

                    const tempFileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
                    const tempFilePath = path.join(UPLOADS_DIR, tempFileName);

                    fs.writeFileSync(tempFilePath, Buffer.from(base64Data, 'base64'));
                    tempFiles.push(tempFilePath);

                    logInfo(`📁 Base64 файл сохранен: ${tempFilePath}`);

                    // Загружаем в OSS
                    const uploadResult = await uploadFileToQwen(tempFilePath);
                    if (uploadResult.success) {
                        fileUrl = uploadResult.url;
                        logInfo(`✅ Base64 файл загружен в OSS: ${uploadResult.url}`);
                    } else {
                        logError(`❌ Ошибка загрузки base64 файла: ${uploadResult.error}`);
                        continue;
                    }
                } else if (file.url.startsWith('http://') || file.url.startsWith('https://')) {
                    // HTTP/HTTPS URL - скачиваем файл и загружаем в OSS
                    logInfo(`📥 Скачивание файла: ${file.url}`);
                    logInfo(`📥 Хост файла: ${new URL(file.url).hostname}`);

                    try {
                        // Получаем прокси агент если настроен
                        const downloadProxyAgent = getFileDownloadProxyAgent();

                        let response;
                        try {
                            if (downloadProxyAgent) {
                                // Используем universalRoutesFetch с прокси (совместимо с Node.js 18-24)
                                logInfo(`🔗 Используем прокси для скачивания: ${file.url}`);
                                response = await universalRoutesFetch(file.url, { redirect: 'follow' }, downloadProxyAgent);
                            } else {
                                // Используем universalRoutesFetch без прокси
                                logWarn(`⚠️ Прокси не настроен, скачиваем напрямую: ${file.url}`);
                                response = await universalRoutesFetch(file.url, { redirect: 'follow' }, null);
                            }
                        } finally {
                            // Таймаут уже обработан в universalRoutesFetch
                        }

                        if (!response.ok) {
                            const errorBody = await response.text().catch(() => '');
                            logError(`❌ Ошибка скачивания: ${response.status} ${response.statusText}${errorBody ? ` | Ответ: ${errorBody.substring(0, 500)}` : ''}`);
                            continue;
                        }

                        // Определяем тип файла из Content-Type или расширения URL
                        const contentType = response.headers.get('content-type') || '';
                        const urlExt = file.url.split('.').pop()?.split('?')[0] || '';
                        let ext = 'bin';

                        if (contentType.includes('image/jpeg')) {ext = 'jpg';}
                        else if (contentType.includes('image/png')) {ext = 'png';}
                        else if (contentType.includes('image/gif')) {ext = 'gif';}
                        else if (contentType.includes('image/webp')) {ext = 'webp';}
                        else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'pdf', 'txt', 'doc', 'docx'].includes(urlExt)) {
                            ext = urlExt;
                        }

                        // Скачиваем во временный файл
                        const tempFileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
                        const tempFilePath = path.join(UPLOADS_DIR, tempFileName);

                        const buffer = Buffer.from(await response.arrayBuffer());
                        fs.writeFileSync(tempFilePath, buffer);
                        tempFiles.push(tempFilePath);

                        logInfo(`📁 Файл скачан: ${tempFilePath} (${buffer.length} байт)`);

                        // Загружаем в OSS
                        const uploadResult = await uploadFileToQwen(tempFilePath);
                        if (uploadResult.success) {
                            fileUrl = uploadResult.url;
                            logInfo(`✅ HTTP файл загружен в OSS: ${uploadResult.url}`);
                        } else {
                            logError(`❌ Ошибка загрузки HTTP файла: ${uploadResult.error}`);
                            continue;
                        }
                    } catch (error) {
                        logError('❌ Ошибка при скачивании файла', error);
                        continue;
                    }
                } else {
                    // Другие протоколы - передаем напрямую
                    fileUrl = file.url;
                    logInfo(`📁 URL добавлен: ${file.url}`);
                }
            }
            // Формат 2: Multer file object
            else if (file.path) {
                const uploadResult = await uploadFileToQwen(file.path);
                if (uploadResult.success) {
                    fileUrl = uploadResult.url;
                    logInfo(`✅ File uploaded to OSS: ${uploadResult.url}`);
                } else {
                    logError(`❌ Ошибка загрузки файла: ${uploadResult.error}`);
                    continue;
                }
            }

            // Определяем тип файла и добавляем в правильном формате
            if (fileUrl) {
                const isImage = fileUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
                if (isImage) {
                    qwenFiles.push({type: 'image', image: fileUrl});
                } else {
                    qwenFiles.push({type: 'file', file: fileUrl});
                }
            }
        }

        // Очищаем временные файлы
        for (const tempFile of tempFiles) {
            try {
                fs.unlinkSync(tempFile);
                logDebug(`🗑️ Временный файл удален: ${tempFile}`);
            } catch (e) {
                logDebug(`Не удалось удалить временный файл: ${e.message}`);
            }
        }

        return qwenFiles;
    } catch (error) {
        logError('Ошибка при обработке файлов', error);

        // Очищаем временные файлы при ошибке
        for (const tempFile of tempFiles) {
            try {
                fs.unlinkSync(tempFile);
            } catch (e) { /* ignore */ }
        }

        throw error;
    }
}

// Функция для генерирования детерминированного chatId на основе истории
function generateChatIdFromHistory(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return null;
    }

    // Фильтруем служебные сообщения Open WebUI
    // Игнорируем сообщения, которые начинаются с "### Task:" или "History:"
    const realMessages = messages.filter((m) => {
        if (m.role !== 'user') {return true;}
        const content = typeof m.content === 'string' ? m.content : '';
        return !content.startsWith('### Task:') && !content.startsWith('History:');
    });

    // Если остались только служебные сообщения, используем исходные
    const messagesToUse = realMessages.length > 0 ? realMessages : messages;

    // Используем хеш первого реального сообщения пользователя для создания стабильного ID
    const userMessages = messagesToUse
        .filter((m) => m.role === 'user')
        .slice(0, 1) // Берём первое сообщение пользователя
        .map((m) => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
        .join('||');

    if (!userMessages) {return null;}

    // Создаём хеш для детерминированного ID
    const hash = crypto
        .createHash('sha256')
        .update(userMessages)
        .digest('hex')
        .substring(0, 16);

    return `chat_${hash}`;
}

function normalizeIdValue(value) {
    if (value === null || value === undefined) {return null;}
    if (typeof value === 'number' || typeof value === 'bigint') {return String(value);}
    if (typeof value !== 'string') {return null;}

    const trimmed = value.trim();
    if (!trimmed) {return null;}

    const lower = trimmed.toLowerCase();
    if (lower === 'null' || lower === 'undefined') {return null;}

    return trimmed;
}

function pickFirstId(candidates) {
    for (const candidate of candidates) {
        const normalized = normalizeIdValue(candidate);
        if (normalized) {return normalized;}
    }
    return null;
}

function buildInternalChatIdFromHint(hint) {
    const normalizedHint = normalizeIdValue(hint);
    if (!normalizedHint) {return null;}

    const hash = crypto
        .createHash('sha256')
        .update(`client-conversation:${normalizedHint}`)
        .digest('hex')
        .substring(0, 16);

    return `chat_${hash}`;
}

function extractConversationHint(req) {
    const body = req.body || {};
    const metadata = body && typeof body.metadata === 'object' ? body.metadata : {};

    return pickFirstId([
        body.conversation_id,
        body.conversationId,
        body.chat_id,
        metadata.conversation_id,
        metadata.conversationId,
        metadata.chat_id,
        metadata.chatId,
        req.get?.('x-conversation-id'),
        req.get?.('x-openwebui-conversation-id'),
        req.get?.('x-chat-id'),
        req.get?.('x-openwebui-chat-id')
    ]);
}

function extractParentHint(req) {
    const body = req.body || {};
    const metadata = body && typeof body.metadata === 'object' ? body.metadata : {};

    return pickFirstId([
        body.parentId,
        body.parent_id,
        body.x_qwen_parent_id,
        body.response_id,
        metadata.parentId,
        metadata.parent_id,
        metadata.response_id,
        req.get?.('x-parent-id'),
        req.get?.('x-openwebui-parent-id')
    ]);
}

function isTruthyFlag(value) {
    if (typeof value === 'boolean') {return value;}
    if (typeof value === 'number') {return value === 1;}
    if (typeof value !== 'string') {return false;}
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function shouldForceNewChat(req) {
    const body = req.body || {};

    // Если включен режим FORCE_NEW_CHAT_PER_REQUEST - всегда создаем новый чат
    if (FORCE_NEW_CHAT_PER_REQUEST) {
        return true;
    }

    return [
        body.newChat,
        body.new_chat,
        body.resetChat,
        body.reset_chat,
        req.get?.('x-new-chat'),
        req.get?.('x-reset-chat')
    ].some(isTruthyFlag);
}

function shouldPersistSessionContext(scope = null) {
    const normalizedScope = normalizeIdValue(scope);
    return Boolean(normalizedScope) || ALLOW_UNSCOPED_SESSION_CHAT_RESTORE;
}

// Глобальное хранилище для маппинга между сгенерированными ID и реальными Qwen chatId
const chatIdMap = new Map();

function mapChatId(generatedId, qwenChatId) {
    if (generatedId) {
        chatIdMap.set(generatedId, qwenChatId);
        logDebug(`Маппинг чата: ${generatedId} -> ${qwenChatId}`);
    }
}

function getChatIdFromMap(generatedId) {
    return generatedId ? chatIdMap.get(generatedId) : null;
}

async function resolveQwenChatId(effectiveChatId, mappedModel) {
    let qwenChatId = effectiveChatId;
    const mapped = getChatIdFromMap(effectiveChatId);

    if (mapped) {
        qwenChatId = mapped;
        logInfo(`🔁 Используется сопоставленный Qwen chatId: ${qwenChatId} (from ${effectiveChatId})`);
        return qwenChatId;
    }

    if (effectiveChatId && effectiveChatId.startsWith('chat_')) {
        try {
            const created = await createChatV2(mappedModel, 'Сессия OpenWebUI');
            if (created && created.chatId) {
                mapChatId(effectiveChatId, created.chatId);
                qwenChatId = created.chatId;
                logInfo(`🔨 Создан Qwen chat ${qwenChatId} и привязан к ${effectiveChatId}`);
            }
        } catch (error) {
            logDebug(`Не удалось создать Qwen chat для ${effectiveChatId}: ${error.message}`);
        }
    }

    return qwenChatId;
}
import { testToken } from './chat.js';

function isOpenWebUiMetaRequest(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {return false;}
    const lastUserMessage = messages.filter((m) => m && m.role === 'user').pop();
    if (!lastUserMessage) {return false;}

    const content = lastUserMessage.content;
    if (Array.isArray(content)) {return false;} // multimodal / normal user message
    if (typeof content !== 'string') {return false;}

    const text = content.trimStart();

    // OpenWebUI background/meta prompts that should not reuse the main chatId/session.
    if (text.startsWith('### Task:')) {return true;}
    if (text.startsWith('History:')) {return true;}

    // Some variants embed history blocks and task instructions.
    if (text.includes('<chat_history>') && text.includes('### Task:')) {return true;}

    return false;
}

// ============================================
// СЕССИОННАЯ СИСТЕМА ДЛЯ ОТСЛЕЖИВАНИЯ ЧАТОВ
// ============================================
// Scoped-сессии (по conversation_id/chat_id) включены всегда.
// Unscoped fallback по IP + User-Agent работает только в legacy-режиме
// через ALLOW_UNSCOPED_SESSION_CHAT_RESTORE=true.
const sessionToChatMap = new Map(); // session-key -> {chatId, parentId, timestamp}

function getSessionKey(req) {
    // Создаём уникальный ключ сессии на основе IP и User-Agent
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return crypto.createHash('sha256').update(`${ip}||${userAgent}`).digest('hex');
}

function getScopedSessionKey(req, scope = null) {
    const baseKey = getSessionKey(req);
    const normalizedScope = normalizeIdValue(scope);
    return normalizedScope ? `${baseKey}::${normalizedScope}` : baseKey;
}

function getSavedChatId(req, scope = null) {
    const keysToTry = [getScopedSessionKey(req, scope)];

    for (const sessionKey of keysToTry) {
        const sessionData = sessionToChatMap.get(sessionKey);
        if (sessionData && (Date.now() - sessionData.timestamp) < 3600000) { // 1 hour
            return sessionData;
        }
    }

    return null;
}
function saveChatIdForSession(req, chatId, parentId, scope = null) {
    const sessionKey = getScopedSessionKey(req, scope);
    const normalizedScope = normalizeIdValue(scope);

    sessionToChatMap.set(sessionKey, {
        chatId,
        parentId,
        scope: normalizedScope,
        timestamp: Date.now()
    });

    const scopeSuffix = normalizedScope ? ` (scope=${normalizedScope})` : '';
    logDebug(`Saved chatId ${chatId} for session ${sessionKey.substring(0, 8)}${scopeSuffix}`);
}
// Очистка старых сессий каждые 10 минут
setInterval(() => {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    let cleaned = 0;
    for (const [key, value] of sessionToChatMap.entries()) {
        if (value.timestamp < oneHourAgo) {
            sessionToChatMap.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        logDebug(`Очищено ${cleaned} старых сессий`);
    }
}, 600000); // 10 минут

const router = express.Router();

// ─── Multer для загрузки файлов ──────────────────────────────────────────────

const storage = multer.diskStorage({
    destination(req, file, cb) {
        const uploadDir = path.join(process.cwd(), UPLOADS_DIR);
        if (!fs.existsSync(uploadDir)) {fs.mkdirSync(uploadDir, { recursive: true });}
        cb(null, uploadDir);
    },
    filename(req, file, cb) {
        cb(null, Date.now() + '-' + crypto.randomBytes(8).toString('hex') + '-' + file.originalname);
    }
});

const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE } });

// ─── Auth middleware ─────────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
    const apiKeys = getApiKeys();
    if (apiKeys.length === 0) {return next();}

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logError('Отсутствует или некорректный заголовок авторизации');
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const token = authHeader.substring(7).trim();
    if (!apiKeys.includes(token)) {
        logError('Предоставлен недействительный API ключ');
        return res.status(401).json({ error: 'Недействительный токен' });
    }
    next();
}

router.use(authMiddleware);
router.use((req, res, next) => {
    req.url = req.url.replace(/\/v[12](?=\/|$)/g, '').replace(/\/+/g, '/');
    next();
});

// ─── Helpers: message parsing ────────────────────────────────────────────────

async function parseOpenAIMessages(messages) {
    const systemMsg = messages.find((msg) => msg.role === 'system');
    const systemMessage = systemMsg ? systemMsg.content : null;
    const lastUserMessage = messages.filter((msg) => msg.role === 'user').pop();

    if (!lastUserMessage) {
        return { messageContent: null, systemMessage };
    }

    let messageContent = lastUserMessage.content;
    const extractedFiles = [];

    // Преобразуем OpenAI format content array во внутренний формат
    if (Array.isArray(messageContent)) {
        messageContent = messageContent.map((item) => {
            if (item.type === 'text') {
                return { type: 'text', text: item.text };
            } else if (item.type === 'image_url' && item.image_url) {
                // OpenAI format: image_url: { url: '...' }
                // Извлекаем для загрузки в OSS
                extractedFiles.push({url: item.image_url.url});
                return null; // Удаляем, файлы будут добавлены позже
            } else if (item.type === 'image') {
                // Уже во внутреннем формате
                extractedFiles.push({url: item.image});
                return null;
            }
            return item;
        }).filter((item) => item !== null); // Убираем null
    }

    // Поддерживаем также формат: content: 'text', files: [{url: '...'}]
    // Добавляем файлы из lastUserMessage.files в extractedFiles
    if (lastUserMessage.files && Array.isArray(lastUserMessage.files)) {
        lastUserMessage.files.forEach((f) => {
            if (f.url) {
                extractedFiles.push({url: f.url});
            }
        });
    }

    // Используем только extractedFiles (уже содержит все файлы)
    const rawFiles = extractedFiles;

    // Обрабатываем все файлы (base64 -> OSS, локальные -> OSS, URLs -> как есть)
    const files = rawFiles.length > 0 ? await processFilesForQwen(rawFiles) : [];

    // Добавляем файлы в messageContent
    if (Array.isArray(messageContent) && files.length > 0) {
        messageContent = [...messageContent, ...files];
    } else if (files.length > 0) {
        // Если messageContent был строкой, превращаем в массив
        messageContent = [
            { type: 'text', text: messageContent },
            ...files
        ];
    }

    return { messageContent, systemMessage };
}

function buildCombinedTools(tools, functions, toolChoice) {
    const combinedTools = tools || (functions ? functions.map((fn) => ({ type: 'function', function: fn })) : null);
    return { combinedTools, toolChoice };
}

// ─── Helpers: streaming ──────────────────────────────────────────────────────

async function handleStreamingResponse(res, mappedModel, messageContent, chatId, parentId, combinedTools, toolChoice, systemMessage) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const writeSse = (payload) => res.write('data: ' + JSON.stringify(payload) + '\n\n');

    writeSse({
        id: 'chatcmpl-stream', object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000), model: mappedModel,
        choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }]
    });

    try {
        const result = await sendMessage(messageContent, mappedModel, chatId, parentId, null, combinedTools, toolChoice, systemMessage);

        if (result.error) {
            writeSse({
                id: 'chatcmpl-stream', object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000), model: mappedModel,
                choices: [{ index: 0, delta: { content: `Error: ${result.error}` }, finish_reason: null }]
            });
        } else if (result.choices?.[0]?.message) {
            const content = String(result.choices[0].message.content || '');
            const codePoints = Array.from(content);
            const chunkSize = 16;
            for (let i = 0; i < codePoints.length; i += chunkSize) {
                writeSse({
                    id: 'chatcmpl-stream', object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000), model: mappedModel,
                    choices: [{ index: 0, delta: { content: codePoints.slice(i, i + chunkSize).join('') }, finish_reason: null }]
                });
                await new Promise((r) => setTimeout(r, STREAMING_CHUNK_DELAY));
            }
        }

        writeSse({
            id: 'chatcmpl-stream', object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000), model: mappedModel,
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
        });
        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        logError('Ошибка при обработке потокового запроса', error);
        writeSse({
            id: 'chatcmpl-stream', object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000), model: mappedModel,
            choices: [{ index: 0, delta: { content: 'Internal server error' }, finish_reason: 'stop' }]
        });
        res.write('data: [DONE]\n\n');
        res.end();
    }
}

function handleNonStreamingResponse(res, result, mappedModel) {
    if (result.error) {
        return res.status(500).json({ error: { message: result.error, type: 'server_error' } });
    }

    res.json({
        id: result.id || 'chatcmpl-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: result.model || mappedModel,
        choices: result.choices || [{ index: 0, message: { role: 'assistant', content: '' }, finish_reason: 'stop' }],
        usage: result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        chatId: result.chatId,
        parentId: result.parentId
    });
}

// ─── Routes ──────────────────────────────────────────────────────────────────

router.post('/chat', async (req, res) => {
    try {
        const { message, messages, model, chatId, parentId, stream } = req.body;

        // Поддержка как message, так и messages для совместимости
        let messageContent = message;
        let systemMessage = null;
        let allMessages = messages; // Сохраняем всю историю
        const isMeta = isOpenWebUiMetaRequest(messages);

        if (messages && Array.isArray(messages)) {
            const parsed = await parseOpenAIMessages(messages);
            systemMessage = parsed.systemMessage;
            if (parsed.messageContent) {messageContent = parsed.messageContent;}
        }

        if (!messageContent) {
            logError('Запрос без сообщения');
            return res.status(400).json({ error: 'Сообщение не указано' });
        }

        logInfo(`Получен запрос: ${typeof messageContent === 'string' ? messageContent.substring(0, 50) + (messageContent.length > 50 ? '...' : '') : 'Составное сообщение'}`);
        if (systemMessage) {
            logInfo(`System message: ${systemMessage.substring(0, 50)}${systemMessage.length > 50 ? '...' : ''}`);
        }
        if (chatId && !isMeta) {
            logInfo(`Используется chatId: ${chatId}, parentId: ${parentId || 'null'}`);
        } else if (isMeta) {
            logDebug('OpenWebUI meta-запрос: используем отдельный чат (без привязки к сессии)');
        }
        if (allMessages && allMessages.length > 1) {
            logInfo(`История содержит ${allMessages.length} сообщений`);
        }

        let mappedModel = model || getActiveModel();
        if (model) {
            mappedModel = getMappedModel(model);
            if (mappedModel !== model) {
                logInfo(`Модель "${model}" заменена на "${mappedModel}"`);
            }
        }
        logInfo(`Используется модель: ${mappedModel}`);

        // Поддержка стриминга для OpenWebUI
        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            // Важно для OpenWebUI - не кэшировать
            res.setHeader('X-Accel-Buffering', 'no');

            const writeSse = (payload) => {
                res.write('data: ' + JSON.stringify(payload) + '\n\n');
            };

            try {
                // Setup streaming callback
                let streamingCallback = null;
                let hasStreamedChunks = false;
                if (stream) {
                    streamingCallback = (chunk) => {
                        hasStreamedChunks = true;
                        writeSse({
                            id: 'chatcmpl-' + Date.now(),
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: mappedModel,
                            choices: [
                                { index: 0, delta: { content: chunk }, finish_reason: null }
                            ]
                        });
                    };
                }

                const result = await sendMessage(
                    messageContent,
                    mappedModel,
                    isMeta ? null : chatId,
                    isMeta ? null : parentId,
                    null,
                    null,
                    null,
                    systemMessage,
                    't2t',
                    null,
                    true,
                    0,
                    streamingCallback
                );

                if (result.error) {
                    writeSse({
                        id: 'chatcmpl-' + Date.now(),
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: mappedModel,
                        choices: [
                            { index: 0, delta: { content: `Error: ${result.error}` }, finish_reason: 'stop' }
                        ]
                    });
                } else if (!hasStreamedChunks && result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) {
                    // Qwen вернул JSON вместо SSE - отправляем контент одним чанком
                    const content = result.choices[0].message.content;
                    logDebug(`JSON response content length: ${content.length}`);
                    if (typeof streamingCallback === 'function') {
                        streamingCallback(content);
                    }
                } else {
                    logDebug(`Result structure: ${JSON.stringify(Object.keys(result))}`);
                }
                // Чанки уже были отправлены через streamingCallback, не дублируем!

                // Финальный чанк
                writeSse({
                    id: 'chatcmpl-' + Date.now(),
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: mappedModel,
                    choices: [
                        { index: 0, delta: {}, finish_reason: 'stop' }
                    ]
                });
                res.write('data: [DONE]\n\n');
                res.end();
                return;
            } catch (error) {
                logError('Ошибка при обработке потокового запроса', error);
                writeSse({
                    id: 'chatcmpl-stream',
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: mappedModel,
                    choices: [
                        { index: 0, delta: { content: 'Internal server error' }, finish_reason: 'stop' }
                    ]
                });
                res.write('data: [DONE]\n\n');
                res.end();
                return;
            }
        }

        const result = await sendMessage(messageContent, mappedModel, isMeta ? null : chatId, isMeta ? null : parentId, null, null, null, systemMessage);

        if (result.choices && result.choices[0] && result.choices[0].message) {
            const responseLength = result.choices[0].message.content ? result.choices[0].message.content.length : 0;
            logInfo(`Ответ успешно сформирован для запроса, длина ответа: ${responseLength}`);

            // Сохраняем историю чата
            if (result.chatId) {
                try {
                    const currentChat = loadHistory(result.chatId);
                    const updatedMessages = allMessages || [
                        { role: 'user', content: messageContent },
                        { role: 'assistant', content: result.choices[0].message.content }
                    ];
                    saveHistory(result.chatId, { ...currentChat, messages: updatedMessages });
                } catch (e) {
                    logDebug(`Не удалось сохранить историю: ${e.message}`);
                }
            }
        } else if (result.error) {
            logInfo(`Получена ошибка в ответе: ${result.error}`);
        }

        res.json(result);
    } catch (error) {
        logError('Ошибка при обработке запроса', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

router.get('/models', async (req, res) => {
    try {
        logInfo('Запрос на получение списка моделей');
        const modelsRaw = getAllModels();
        const openAiModels = {
            object: 'list',
            data: modelsRaw.models.map((m) => ({
                id: m.id || m.name || m,
                object: 'model',
                created: 0,
                owned_by: 'qwen',
                permission: []
            }))
        };
        logInfo(`Возвращено ${openAiModels.data.length} моделей (OpenAI формат)`);
        res.json(openAiModels);
    } catch (error) {
        logError('Ошибка при получении списка моделей', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

router.get('/status', async (req, res) => {
    try {
        logInfo('Запрос статуса авторизации');
        const tokens = listTokens();
        const now = Date.now();

        // Фильтруем только действительные токены с cookies
        const validTokens = tokens.filter((t) => {
            if (t.invalid) {return false;}
            if (t.resetAt && new Date(t.resetAt).getTime() > now) {return false;}
            if (t.expiryTime && t.expiryTime <= now) {return false;}
            // Проверяем наличие cookies.json
            const cookiesPath = path.join(process.cwd(), SESSION_DIR, 'accounts', t.id, 'cookies.json');
            if (!fs.existsSync(cookiesPath)) {return false;}
            return true;
        });

        const accounts = await Promise.all(validTokens.map(async (t) => {
            const accInfo = { id: t.id, status: 'UNKNOWN', resetAt: t.resetAt || null };

            if (t.resetAt) {
                const resetTime = new Date(t.resetAt).getTime();
                if (resetTime > Date.now()) { accInfo.status = 'WAIT'; return accInfo; }
            }

            const testResult = await testToken(t.token);
            if (testResult === 'OK') { accInfo.status = 'OK'; if (t.invalid || t.resetAt) {markValid(t.id);} }
            else if (testResult === 'RATELIMIT') { accInfo.status = 'WAIT'; markRateLimited(t.id, 24); }
            else if (testResult === 'UNAUTHORIZED') { accInfo.status = 'INVALID'; if (!t.invalid) {markInvalid(t.id);} }
            else { accInfo.status = 'ERROR'; }
            return accInfo;
        }));

        const browserContext = getBrowserContext();
        if (!browserContext) {
            logError('Браузер не инициализирован');
            return res.json({ authenticated: false, message: 'Браузер не инициализирован', accounts });
        }

        if (getAuthenticationStatus()) {return res.json({ accounts });}

        await checkAuthentication(browserContext);
        const isAuthenticated = getAuthenticationStatus();
        logInfo(`Статус авторизации: ${isAuthenticated ? 'активна' : 'требуется авторизация'}`);
        res.json({ authenticated: isAuthenticated, message: isAuthenticated ? 'Авторизация активна' : 'Требуется авторизация', accounts });
    } catch (error) {
        logError('Ошибка при проверке статуса авторизации', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

router.post('/chats', async (req, res) => {
    try {
        const { name, model } = req.body;
        // Приоритет: переданная модель > activeModel из настроек
        const chatModel = model ? getMappedModel(model) : getActiveModel();
        logInfo(`Создание нового чата${name ? ` с именем: ${name}` : ''}, модель: ${chatModel}`);
        const result = await createChatV2(chatModel, name || 'Новый чат');
        if (result.error) { logError(`Ошибка создания чата: ${result.error}`); return res.status(500).json({ error: result.error }); }
        logInfo(`Создан новый чат v2 с ID: ${result.chatId}`);
        res.json({ chatId: result.chatId, success: true });
    } catch (error) {
        logError('Ошибка при создании чата', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

router.get('/chat/completions', (req, res) => {
    res.status(405).json({
        error: 'Метод не поддерживается',
        message: 'Используйте POST /api/chat/completions'
    });
});

router.post('/chat/completions', async (req, res) => {
    try {
        const { messages, model, stream, tools, functions, tool_choice, chatId } = req.body;
        const snakeCaseChatId = normalizeIdValue(req.body?.chat_id);
        const explicitChatId = normalizeIdValue(chatId) || snakeCaseChatId;
        const explicitParentId = extractParentHint(req);
        const conversationHint = extractConversationHint(req);
        const conversationScope = conversationHint ? `conversation:${conversationHint}` : null;
        const forceNewChat = shouldForceNewChat(req);
        logInfo(`Получен OpenAI-совместимый запрос${stream ? ' (stream)' : ''}`);

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            logError('Запрос без сообщений');
            return res.status(400).json({ error: 'Сообщения не указаны' });
        }

        const isMeta = isOpenWebUiMetaRequest(messages);

        // Используем переданный chatId ИЛИ восстанавливаем из сессии
        let effectiveChatId = explicitChatId;
        let effectiveParentId = explicitParentId;

        if (forceNewChat && !explicitChatId && !isMeta) {
            effectiveChatId = `chat_${crypto.randomBytes(8).toString('hex')}`;
            effectiveParentId = null;
            logInfo(`Принудительно запрошен новый чат (newChat/resetChat): ${effectiveChatId}`);
        }

        if (!effectiveChatId && !isMeta) {
            if (conversationHint) {
                const scopedSession = forceNewChat ? null : getSavedChatId(req, conversationScope);
                if (scopedSession?.chatId) {
                    effectiveChatId = scopedSession.chatId;
                    if (!effectiveParentId && scopedSession.parentId) {
                        effectiveParentId = scopedSession.parentId;
                    }
                    logInfo(`Restored scoped chatId from session: ${effectiveChatId}`);
                } else {
                    effectiveChatId = buildInternalChatIdFromHint(conversationHint);
                    logInfo(`Using client conversation-id key: ${effectiveChatId}`);
                }
            } else if (ALLOW_UNSCOPED_SESSION_CHAT_RESTORE) {
                const savedSession = forceNewChat ? null : getSavedChatId(req);
                if (savedSession?.chatId) {
                    effectiveChatId = savedSession.chatId;
                    if (!effectiveParentId && savedSession.parentId) {
                        effectiveParentId = savedSession.parentId;
                    }
                    logInfo(`Restored chatId from session: ${effectiveChatId}`);
                }

                if (!effectiveChatId) {
                    const generatedId = generateChatIdFromHistory(messages);
                    if (generatedId) {
                        effectiveChatId = generatedId;
                        logInfo(`Created new chatId for session: ${effectiveChatId}`);
                    }
                }
            } else {
                logDebug('chatId/conversation_id не переданы, unscoped session fallback отключён');
            }
        }

        // Извлекаем system message если есть
        const systemMsg = messages.find((msg) => msg.role === 'system');
        const systemMessage = systemMsg ? systemMsg.content : null;

        const lastUserMessage = messages.filter((msg) => msg.role === 'user').pop();
        if (!lastUserMessage) {
            logError('В запросе нет сообщений от пользователя');
            return res.status(400).json({ error: 'В запросе нет сообщений от пользователя' });
        }

        let messageContent = lastUserMessage.content;

        // Преобразуем OpenAI format content array во внутренний формат
        const extractedFiles = []; // Files из content array

        if (Array.isArray(messageContent)) {
            messageContent = messageContent.map((item) => {
                if (item.type === 'text') {
                    return { type: 'text', text: item.text };
                } else if (item.type === 'image_url' && item.image_url) {
                    // OpenAI format: image_url: { url: '...' }
                    // Извлекаем URL/base64 для загрузки в OSS
                    extractedFiles.push({url: item.image_url.url});
                    return { type: 'text', text: '' }; // Заменяем на пустой текст, файлы будут в files
                } else if (item.type === 'image') {
                    // Уже во внутреннем формате
                    extractedFiles.push({url: item.image});
                    return { type: 'text', text: '' };
                }
                return item;
            });

            // Убираем пустые text элементы
            messageContent = messageContent.filter((item) => item.type !== 'text' || item.text.trim());
        }

        // Поддерживаем также формат: content: 'text', files: [{url: '...'}]
        // Добавляем файлы из lastUserMessage.files в extractedFiles
        if (lastUserMessage.files && Array.isArray(lastUserMessage.files)) {
            lastUserMessage.files.forEach((f) => {
                if (f.url) {
                    extractedFiles.push({url: f.url});
                }
            });
        }

        // Используем только extractedFiles (уже содержит все файлы)
        const rawFiles = extractedFiles;

        // Обрабатываем все файлы (base64 -> OSS, локальные -> OSS, URLs -> как есть)
        const files = rawFiles.length > 0 ? await processFilesForQwen(rawFiles) : [];

        // Добавляем файлы в messageContent
        if (Array.isArray(messageContent) && files.length > 0) {
            messageContent = [...messageContent, ...files];
        } else if (files.length > 0) {
            messageContent = [
                { type: 'text', text: messageContent },
                ...files
            ];
        }

        // Файлы уже встроены в messageContent, не передаем отдельно чтобы избежать дублирования
        const filesForSend = null;

        if (isMeta) {
            effectiveChatId = null;
            effectiveParentId = null;
            logDebug('OpenWebUI meta-запрос: используем отдельный чат (без привязки к сессии)');
        }

        // Приоритет: переданная модель > activeModel из настроек
        let mappedModel = model ? getMappedModel(model) : getActiveModel();
        if (model && mappedModel !== model) {
            logInfo(`Модель "${model}" заменена на "${mappedModel}"`);
        }
        logInfo(`Используется модель: ${mappedModel}`);
        if (systemMessage) {logInfo(`System message: ${systemMessage.substring(0, 50)}${systemMessage.length > 50 ? '...' : ''}`);}

        const { combinedTools } = buildCombinedTools(tools, functions, tool_choice);

        if (systemMessage) {
            logInfo(`System message: ${systemMessage.substring(0, 50)}${systemMessage.length > 50 ? '...' : ''}`);
        }

        // Логируем полную историю сообщений
        logInfo(`История содержит ${messages.length} сообщений: ${messages.map((m) => m.role).join(', ')}`);
        if (effectiveChatId) {
            logInfo(`Используется chatId: ${effectiveChatId}, parentId: ${effectiveParentId || 'null'}`);
        }

        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.setHeader('Transfer-Encoding', 'chunked');

            const writeSse = (payload) => {
                res.write('data: ' + JSON.stringify(payload) + '\n\n');
            };

            try {
                const combinedTools = tools || (functions ? functions.map((fn) => ({ type: 'function', function: fn })) : null);
                const qwenChatId = await resolveQwenChatId(effectiveChatId, mappedModel);

                // Setup streaming callback if stream=true
                let streamingCallback = null;
                let hasStreamedChunks = false;
                if (stream) {
                    streamingCallback = (chunk) => {
                        hasStreamedChunks = true;
                        writeSse({
                            id: 'chatcmpl-stream',
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: mappedModel,
                            choices: [
                                { index: 0, delta: { content: chunk }, finish_reason: null }
                            ]
                        });
                    };
                }

                const result = await sendMessage(
                    messageContent,
                    mappedModel,
                    qwenChatId,
                    effectiveParentId,
                    filesForSend, // ← Файлы уже в messageContent, не передаем отдельно
                    combinedTools,
                    tool_choice,
                    systemMessage,
                    't2t',
                    null,
                    true,
                    0,
                    streamingCallback
                );

                // Сохраняем chatId в сессию для следующих запросов
                if (!isMeta && result.chatId) {
                    // Если мы использовали сгенерированный effectiveChatId — сохраните маппинг
                    if (effectiveChatId && effectiveChatId.startsWith('chat_') && result.chatId) {
                        mapChatId(effectiveChatId, result.chatId);
                        logDebug(`Маппинг сохранён: ${effectiveChatId} -> ${result.chatId}`);
                    }
                    if (shouldPersistSessionContext(conversationScope)) {
                        saveChatIdForSession(req, result.chatId, result.parentId, conversationScope);
                    }
                }

                if (result.error) {
                    writeSse({
                        id: 'chatcmpl-stream',
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: mappedModel,
                        choices: [
                            { index: 0, delta: { content: `Error: ${result.error}` }, finish_reason: null }
                        ]
                    });
                } else if (!hasStreamedChunks && result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) {
                    // Qwen вернул JSON вместо SSE - отправляем контент одним чанком
                    const content = result.choices[0].message.content;
                    logDebug(`JSON response content length: ${content.length}`);
                    if (typeof streamingCallback === 'function') {
                        streamingCallback(content);
                    }
                } else {
                    logDebug(`Result structure: ${JSON.stringify(Object.keys(result))}`);
                }
                // Чанки уже были отправлены через streamingCallback, не дублируем!

                writeSse({
                    id: 'chatcmpl-stream',
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: mappedModel,
                    choices: [
                        { index: 0, delta: {}, finish_reason: 'stop' }
                    ]
                });
                res.write('data: [DONE]\n\n');
                res.end();

            } catch (error) {
                logError('Ошибка при обработке потокового запроса', error);
                writeSse({
                    id: 'chatcmpl-stream',
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: mappedModel,
                    choices: [
                        { index: 0, delta: { content: 'Internal server error' }, finish_reason: 'stop' }
                    ]
                });
                res.write('data: [DONE]\n\n');
                res.end();
            }
        } else {
            const combinedTools = tools || (functions ? functions.map((fn) => ({ type: 'function', function: fn })) : null);
            const qwenChatId = await resolveQwenChatId(effectiveChatId, mappedModel);
            const result = await sendMessage(messageContent, mappedModel, qwenChatId, effectiveParentId, null, combinedTools, tool_choice, systemMessage);

            // Сохраняем chatId в сессию для следующих запросов
            if (!isMeta && result.chatId) {
                if (effectiveChatId && effectiveChatId.startsWith('chat_') && result.chatId) {
                    mapChatId(effectiveChatId, result.chatId);
                    logDebug(`Маппинг сохранён: ${effectiveChatId} -> ${result.chatId}`);
                }
                if (shouldPersistSessionContext(conversationScope)) {
                    saveChatIdForSession(req, result.chatId, result.parentId, conversationScope);
                }
            }

            if (result.error) {
                return res.status(500).json({
                    error: { message: result.error, type: 'server_error' }
                });
            }

            const openaiResponse = {
                id: result.id || 'chatcmpl-' + Date.now(),
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: result.model || mappedModel,
                choices: result.choices || [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: result.choices?.[0]?.message?.content || ''
                    },
                    finish_reason: 'stop'
                }],
                usage: result.usage || {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0
                },
                chatId: result.chatId,
                parentId: result.parentId
            };

            // Сохраняем историю чата
            if (result.chatId) {
                try {
                    const currentChat = loadHistory(result.chatId);
                    const responseMessage = {
                        role: 'assistant',
                        content: openaiResponse.choices[0].message.content
                    };
                    const updatedMessages = messages.concat([responseMessage]);
                    saveHistory(result.chatId, { ...currentChat, messages: updatedMessages });
                } catch (e) {
                    logDebug(`Не удалось сохранить историю: ${e.message}`);
                }
            }

            res.json(openaiResponse);
        }
    } catch (error) {
        logError('Ошибка при обработке запроса', error);
        res.status(500).json({ error: { message: 'Внутренняя ошибка сервера', type: 'server_error' } });
    }
});

// OpenAI совместимый эндпоинт v1 (для Open WebUI и других клиентов)
router.post('/v1/chat/completions', async (req, res) => {
    try {
        const { messages, model, stream, tools, functions, tool_choice, chatId } = req.body;
        const snakeCaseChatId = normalizeIdValue(req.body?.chat_id);
        const explicitChatId = normalizeIdValue(chatId) || snakeCaseChatId;
        const explicitParentId = extractParentHint(req);
        const conversationHint = extractConversationHint(req);
        const conversationScope = conversationHint ? `conversation:${conversationHint}` : null;
        const forceNewChat = shouldForceNewChat(req);

        logInfo(`Получен OpenAI v1 запрос${stream ? ' (stream)' : ''}`);

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            logError('Запрос без сообщений');
            return res.status(400).json({ error: 'Сообщения не указаны' });
        }

        const isMeta = isOpenWebUiMetaRequest(messages);

        // Используем переданный chatId ИЛИ восстанавливаем из сессии
        let effectiveChatId = explicitChatId;
        let effectiveParentId = explicitParentId;

        if (forceNewChat && !explicitChatId && !isMeta) {
            effectiveChatId = `chat_${crypto.randomBytes(8).toString('hex')}`;
            effectiveParentId = null;
            logInfo(`Принудительно запрошен новый чат (newChat/resetChat): ${effectiveChatId}`);
        }

        if (!effectiveChatId && !isMeta) {
            if (conversationHint) {
                const scopedSession = forceNewChat ? null : getSavedChatId(req, conversationScope);
                if (scopedSession?.chatId) {
                    effectiveChatId = scopedSession.chatId;
                    if (!effectiveParentId && scopedSession.parentId) {
                        effectiveParentId = scopedSession.parentId;
                    }
                    logInfo(`Restored scoped chatId from session: ${effectiveChatId}`);
                } else {
                    effectiveChatId = buildInternalChatIdFromHint(conversationHint);
                    logInfo(`Using client conversation-id key: ${effectiveChatId}`);
                }
            } else if (ALLOW_UNSCOPED_SESSION_CHAT_RESTORE) {
                const savedSession = forceNewChat ? null : getSavedChatId(req);
                if (savedSession?.chatId) {
                    effectiveChatId = savedSession.chatId;
                    if (!effectiveParentId && savedSession.parentId) {
                        effectiveParentId = savedSession.parentId;
                    }
                    logInfo(`Restored chatId from session: ${effectiveChatId}`);
                }

                if (!effectiveChatId) {
                    const generatedId = generateChatIdFromHistory(messages);
                    if (generatedId) {
                        effectiveChatId = generatedId;
                        logInfo(`Created new chatId for session: ${effectiveChatId}`);
                    }
                }
            } else {
                logDebug('chatId/conversation_id не переданы, unscoped session fallback отключён');
            }
        }

        // Извлекаем system message если есть
        const systemMsg = messages.find((msg) => msg.role === 'system');
        const systemMessage = systemMsg ? systemMsg.content : null;

        const lastUserMessage = messages.filter((msg) => msg.role === 'user').pop();
        if (!lastUserMessage) {
            logError('В запросе нет сообщений от пользователя');
            return res.status(400).json({ error: 'В запросе нет сообщений от пользователя' });
        }

        let messageContent = lastUserMessage.content;

        // Преобразуем OpenAI format content array во внутренний формат
        const extractedFiles = []; // Files из content array

        if (Array.isArray(messageContent)) {
            messageContent = messageContent.map((item) => {
                if (item.type === 'text') {
                    return { type: 'text', text: item.text };
                } else if (item.type === 'image_url' && item.image_url) {
                    // OpenAI format: image_url: { url: '...' }
                    // Извлекаем URL/base64 для загрузки в OSS
                    extractedFiles.push({url: item.image_url.url});
                    return { type: 'text', text: '' }; // Заменяем на пустой текст, файлы будут в files
                } else if (item.type === 'image') {
                    // Уже во внутреннем формате
                    extractedFiles.push({url: item.image});
                    return { type: 'text', text: '' };
                }
                return item;
            });

            // Убираем пустые text элементы
            messageContent = messageContent.filter((item) => item.type !== 'text' || item.text.trim());
        }

        // Поддерживаем также формат: content: 'text', files: [{url: '...'}]
        // Добавляем файлы из lastUserMessage.files в extractedFiles
        if (lastUserMessage.files && Array.isArray(lastUserMessage.files)) {
            lastUserMessage.files.forEach((f) => {
                if (f.url) {
                    extractedFiles.push({url: f.url});
                }
            });
        }

        // Используем только extractedFiles (уже содержит все файлы)
        const rawFiles = extractedFiles;

        // Обрабатываем все файлы (base64 -> OSS, локальные -> OSS, URLs -> как есть)
        const files = rawFiles.length > 0 ? await processFilesForQwen(rawFiles) : [];

        // Добавляем файлы в messageContent
        if (Array.isArray(messageContent) && files.length > 0) {
            messageContent = [...messageContent, ...files];
        } else if (files.length > 0) {
            messageContent = [
                { type: 'text', text: messageContent },
                ...files
            ];
        }

        // Файлы уже встроены в messageContent, не передаем отдельно чтобы избежать дублирования
        const filesForSend = null;

        if (isMeta) {
            effectiveChatId = null;
            effectiveParentId = null;
            logDebug('OpenWebUI meta-запрос: используем отдельный чат (без привязки к сессии)');
        }

        // Приоритет: переданная модель > activeModel из настроек
        let mappedModel = model ? getMappedModel(model) : getActiveModel();
        if (model && mappedModel !== model) {
            logInfo(`Модель "${model}" заменена на "${mappedModel}"`);
        }
        logInfo(`Используется модель: ${mappedModel}`);

        if (systemMessage) {
            logInfo(`System message: ${systemMessage.substring(0, 50)}${systemMessage.length > 50 ? '...' : ''}`);
        }

        // Логируем полную историю сообщений
        logInfo(`История содержит ${messages.length} сообщений: ${messages.map((m) => m.role).join(', ')}`);
        if (effectiveChatId) {
            logInfo(`Используется chatId: ${effectiveChatId}, parentId: ${effectiveParentId || 'null'}`);
        }

        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.setHeader('Transfer-Encoding', 'chunked');

            const writeSse = (payload) => {
                res.write('data: ' + JSON.stringify(payload) + '\n\n');
            };

            try {
                const combinedTools = tools || (functions ? functions.map((fn) => ({ type: 'function', function: fn })) : null);
                const qwenChatId = await resolveQwenChatId(effectiveChatId, mappedModel);

                // Setup streaming callback if stream=true
                let streamingCallback = null;
                let hasStreamedChunks = false;
                if (stream) {
                    streamingCallback = (chunk) => {
                        hasStreamedChunks = true;
                        // OpenWebUI не нуждается в role в чанках - только контент
                        writeSse({
                            id: 'chatcmpl-' + Date.now(),
                            object: 'chat.completion.chunk',
                            created: Math.floor(Date.now() / 1000),
                            model: mappedModel,
                            choices: [
                                { index: 0, delta: { content: chunk }, finish_reason: null }
                            ]
                        });
                    };
                }

                const result = await sendMessage(
                    messageContent,
                    mappedModel,
                    qwenChatId,
                    effectiveParentId,
                    filesForSend, // ← Файлы уже в messageContent, не передаем отдельно
                    combinedTools,
                    tool_choice,
                    systemMessage,
                    't2t',
                    null,
                    true,
                    0,
                    streamingCallback
                );

                // Сохраняем chatId в сессию для следующих запросов
                if (!isMeta && result.chatId) {
                    if (shouldPersistSessionContext(conversationScope)) {
                        saveChatIdForSession(req, result.chatId, result.parentId, conversationScope);
                    }
                }

                if (result.error) {
                    writeSse({
                        id: 'chatcmpl-stream',
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: mappedModel,
                        choices: [
                            { index: 0, delta: { content: `Error: ${result.error}` }, finish_reason: 'stop' }
                        ]
                    });
                } else if (!hasStreamedChunks && result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) {
                    // Qwen вернул JSON вместо SSE - отправляем контент одним чанком
                    const content = result.choices[0].message.content;
                    logDebug(`JSON response content length: ${content.length}`);
                    if (typeof streamingCallback === 'function') {
                        streamingCallback(content);
                    }
                } else {
                    logDebug(`Result structure: ${JSON.stringify(Object.keys(result))}`);
                }
                // Чанки уже были отправлены через streamingCallback, не дублируем!

                writeSse({
                    id: 'chatcmpl-stream',
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: mappedModel,
                    choices: [
                        { index: 0, delta: {}, finish_reason: 'stop' }
                    ]
                });
                res.write('data: [DONE]\n\n');
                res.end();

            } catch (error) {
                logError('Ошибка при обработке потокового запроса', error);
                writeSse({
                    id: 'chatcmpl-stream',
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: mappedModel,
                    choices: [
                        { index: 0, delta: { content: 'Internal server error' }, finish_reason: 'stop' }
                    ]
                });
                res.write('data: [DONE]\n\n');
                res.end();
            }
        } else {
            const combinedTools = tools || (functions ? functions.map((fn) => ({ type: 'function', function: fn })) : null);
            const qwenChatId = await resolveQwenChatId(effectiveChatId, mappedModel);

            const result = await sendMessage(messageContent, mappedModel, qwenChatId, effectiveParentId, filesForSend, combinedTools, tool_choice, systemMessage);

            // Сохраняем chatId в сессии для следующих запросов
            if (!isMeta && result.chatId) {
                // Если мы использовали сгенерированный effectiveChatId — сохраните маппинг
                if (effectiveChatId && effectiveChatId.startsWith('chat_') && result.chatId) {
                    mapChatId(effectiveChatId, result.chatId);
                    logDebug(`Маппинг сохранён: ${effectiveChatId} -> ${result.chatId}`);
                }
                if (shouldPersistSessionContext(conversationScope)) {
                    saveChatIdForSession(req, result.chatId, result.parentId, conversationScope);
                }
            }

            if (result.error) {
                return res.status(500).json({
                    error: { message: result.error, type: 'server_error' }
                });
            }

            // Извлекаем контент сообщения
            let messageText = '';
            if (result.choices && result.choices[0] && result.choices[0].message) {
                messageText = result.choices[0].message.content || '';
            } else if (result.response && result.response.text) {
                messageText = result.response.text;
            }

            const openaiResponse = {
                id: result.id || 'chatcmpl-' + Date.now(),
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: result.model || mappedModel,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: messageText
                    },
                    finish_reason: 'stop'
                }],
                usage: result.usage || {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0
                },
                // Передаём метаданные для сохранения контекста
                x_qwen_chat_id: result.chatId,
                x_qwen_parent_id: result.parentId || result.response_id
            };

            // Сохраняем историю чата для v1 эндпоинта
            if (result.chatId) {
                // Сохраняем chatId в сессии для последующих запросов от этого клиента
                if (!isMeta) {
                    try {
                        if (shouldPersistSessionContext(conversationScope)) {
                            saveChatIdForSession(req, result.chatId, result.parentId || result.response_id, conversationScope);
                        }
                    } catch (e) {
                        logDebug(`Не удалось сохранить chatId в сессии: ${e.message}`);
                    }
                }

                try {
                    const currentChat = loadHistory(result.chatId);
                    const responseMessage = {
                        role: 'assistant',
                        content: messageText
                    };
                    const updatedMessages = messages.concat([responseMessage]);
                    saveHistory(result.chatId, { ...currentChat, messages: updatedMessages });
                } catch (e) {
                    logDebug(`Не удалось сохранить историю: ${e.message}`);
                }
            }

            res.json(openaiResponse);
        }
    } catch (error) {
        logError('Ошибка при обработке v1 запроса', error);
        res.status(500).json({ error: { message: 'Внутренняя ошибка сервера', type: 'server_error' } });
    }
});

router.post('/files/getstsToken', async (req, res) => {
    try {
        logInfo(`Запрос на получение STS токена: ${JSON.stringify(req.body)}`);
        const fileInfo = req.body;
        if (!fileInfo?.filename || !fileInfo?.filesize || !fileInfo?.filetype) {
            logError('Некорректные данные о файле');
            return res.status(400).json({ error: 'Некорректные данные о файле' });
        }
        res.json(await getStsToken(fileInfo));
    } catch (error) {
        logError('Ошибка при получении STS токена', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

router.post('/files/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) { logError('Файл не был загружен'); return res.status(400).json({ error: 'Файл не был загружен' }); }
        logInfo(`Файл загружен на сервер: ${req.file.originalname} (${req.file.size} байт)`);

        const result = await uploadFileToQwen(req.file.path);

        try { fs.unlinkSync(req.file.path); } catch { /* file already removed or inaccessible */ }

        if (result.success) {
            logInfo(`Файл успешно загружен в OSS: ${result.fileName}`);
            res.json({ success: true, file: { name: result.fileName, url: result.url, size: req.file.size, type: req.file.mimetype } });
        } else {
            logError(`Ошибка при загрузке файла в OSS: ${result.error}`);
            res.status(500).json({ error: 'Ошибка при загрузке файла' });
        }
    } catch (error) {
        logError('Ошибка при загрузке файла', error);
        if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch { /* ignore */ } }
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// ─── Multipart Chat Endpoint (OpenAI-compatible with files) ─────────────────

/**
 * POST /api/chat/multipart - Chat with file uploads via multipart/form-data
 * OpenAI-compatible endpoint that supports both JSON and file uploads
 *
 * Fields:
 * - message: Text message (required)
 * - model: Model name (optional)
 * - stream: Enable streaming (optional, boolean)
 * - files[]: Multiple files (optional, up to 5 files, max 10MB each)
 */
router.post('/chat/multipart', upload.array('files', 5), async (req, res) => {
    try {
        const { message, model, stream } = req.body;
        const uploadedFiles = req.files || [];

        if (!message) {
            logError('Запрос без сообщения');
            return res.status(400).json({ error: 'Сообщение не указано' });
        }

        logInfo(`Получен multipart запрос: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
        if (uploadedFiles.length > 0) {
            logInfo(`Прикреплено файлов: ${uploadedFiles.length}`);
        }

        let mappedModel = model || getActiveModel();
        if (model) {
            mappedModel = getMappedModel(model);
            if (mappedModel !== model) {
                logInfo(`Модель "${model}" заменена на "${mappedModel}"`);
            }
        }
        logInfo(`Используется модель: ${mappedModel}`);

        // Обрабатываем загруженные файлы
        const files = uploadedFiles.length > 0 ? await processFilesForQwen(uploadedFiles) : [];

        // Встраиваем файлы в messageContent как в test 2
        let messageContent = message;
        if (files.length > 0) {
            messageContent = [
                { type: 'text', text: message },
                ...files
            ];
        }

        // Подготовка streaming если нужно
        if (stream === 'true' || stream === '1' || stream === true) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.setHeader('Transfer-Encoding', 'chunked');

            const writeSse = (payload) => {
                res.write('data: ' + JSON.stringify(payload) + '\n\n');
            };

            try {
                writeSse({
                    id: 'chatcmpl-stream',
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: mappedModel,
                    choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }]
                });

                let streamingCallback = null;
                let hasStreamedChunks = false;
                streamingCallback = (chunk) => {
                    hasStreamedChunks = true;
                    writeSse({
                        id: 'chatcmpl-stream',
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: mappedModel,
                        choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }]
                    });
                };

                const result = await sendMessage(
                    messageContent,
                    mappedModel,
                    null, // chatId
                    null, // parentId
                    null, // files - теперь в messageContent
                    null, // tools
                    null, // toolChoice
                    null, // systemMessage
                    't2t',
                    null,
                    true,
                    0,
                    streamingCallback
                );

                if (result.error) {
                    writeSse({
                        id: 'chatcmpl-stream',
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: mappedModel,
                        choices: [{ index: 0, delta: { content: `Error: ${result.error}` }, finish_reason: 'stop' }]
                    });
                } else if (!hasStreamedChunks && result.choices?.[0]?.message?.content) {
                    const content = result.choices[0].message.content;
                    if (typeof streamingCallback === 'function') {
                        streamingCallback(content);
                    }
                }

                writeSse({
                    id: 'chatcmpl-stream',
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: mappedModel,
                    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
                });
                res.write('data: [DONE]\n\n');
                res.end();

            } catch (error) {
                logError('Ошибка при обработке потокового multipart запроса', error);
                writeSse({
                    id: 'chatcmpl-stream',
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: mappedModel,
                    choices: [{ index: 0, delta: { content: 'Internal server error' }, finish_reason: 'stop' }]
                });
                res.write('data: [DONE]\n\n');
                res.end();

            }
        } else {
            // Non-streaming response
            const result = await sendMessage(
                messageContent,
                mappedModel,
                null,
                null,
                null, // files - теперь в messageContent
                null,
                null,
                null,
                't2t',
                null,
                true
            );

            if (result.error) {
                return res.status(500).json({
                    error: { message: result.error, type: 'server_error' }
                });
            }

            const openaiResponse = {
                id: result.id || 'chatcmpl-' + Date.now(),
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: result.model || mappedModel,
                choices: result.choices || [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: result.choices?.[0]?.message?.content || ''
                    },
                    finish_reason: 'stop'
                }],
                usage: result.usage || {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0
                },
                chatId: result.chatId,
                parentId: result.parentId
            };

            res.json(openaiResponse);
        }
    } catch (error) {
        logError('Ошибка при обработке multipart запроса', error);
        res.status(500).json({ error: { message: 'Внутренняя ошибка сервера', type: 'server_error' } });
    }
});

// Эндпоинт для сохранения истории чата (для работы с Open WebUI)
router.post('/chats/:chatId/history', async (req, res) => {
    try {
        const { chatId } = req.params;
        const { messages } = req.body;

        logInfo(`Запрос сохранения истории для чата: ${chatId}`);

        if (!messages || !Array.isArray(messages)) {
            logError('История сообщений не указана или некорректна');
            return res.status(400).json({ error: 'История сообщений должна быть массивом' });
        }

        // Здесь можно добавить логику сохранения истории
        // Для теперь просто подтверждаем сохранение
        res.json({
            success: true,
            chatId: chatId,
            messagesCount: messages.length
        });
    } catch (error) {
        logError('Ошибка при сохранении истории чата', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// Эндпоинт для получения истории чата (для работы с Open WebUI)
router.get('/chats/:chatId/history', async (req, res) => {
    try {
        const { chatId } = req.params;

        logInfo(`Запрос истории для чата: ${chatId}`);

        // Здесь можно добавить логику получения истории из БД
        // Для теперь возвращаем пустую историю
        res.json({
            success: true,
            chatId: chatId,
            messages: []
        });
    } catch (error) {
        logError('Ошибка при получении истории чата', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// ============================================
// ЭНДПОИНТЫ ДЛЯ ГЕНЕРАЦИИ ИЗОБРАЖЕНИЙ
// ============================================

/**
 * POST /api/images/generations - Генерация изображений по тексту (OpenAI DALL-E совместимый)
 * Формат запроса совместим с OpenAI Images API
 */
router.post('/images/generations', async (req, res) => {
    try {
        const { prompt, model, n, size, response_format, user } = req.body;

        logInfo('Получен запрос на генерацию изображения');
        logDebug(`Prompt: ${prompt?.substring(0, 100)}${prompt?.length > 100 ? '...' : ''}`);

        if (!prompt) {
            return res.status(400).json({ error: 'Параметр "prompt" обязателен' });
        }

        // Маппинг моделей OpenAI на Qwen Image модели
        let imageModel = model || 'qwen-image-plus';
        if (imageModel === 'dall-e-3' || imageModel === 'dall-e-2') {
            imageModel = 'qwen-image-plus';
        }

        // Проверка доступности API
        if (IMAGE_GENERATION_MODE === 'dashscope' && !DASHSCOPE_API_KEY) {
            return res.status(503).json({
                error: 'API генерации изображений не настроен',
                message: 'Установите переменную окружения DASHSCOPE_API_KEY или переключитесь на IMAGE_GENERATION_MODE=browser'
            });
        }

        // Преобразование размера из формата OpenAI в формат Qwen
        let qwenSize = '1024*1024';
        if (size) {
            const sizeMap = {
                '1024x1024': '1024*1024',
                '1024x1792': '1024*1792',
                '1792x1024': '1792*1024',
                '512x512': '512*512',
                '768x768': '768*768',
                '960x960': '960*960'
            };
            qwenSize = sizeMap[size] || '1024*1024';
        }

        const result = await generateImage(prompt, imageModel, {
            n: n || 1,
            size: qwenSize,
            promptExtend: true,
            watermark: false
        });

        if (result.error) {
            logError(`Ошибка генерации: ${result.error}`);
            return res.status(500).json({
                error: 'Ошибка генерации изображения',
                message: result.error
            });
        }

        // Формируем ответ в формате OpenAI Images API
        const responseData = {
            created: Math.floor(Date.now() / 1000),
            data: [{
                url: result.imageUrl,
                revised_prompt: prompt
            }]
        };

        logInfo(`Изображение сгенерировано: ${result.imageUrl}`);
        res.json(responseData);

    } catch (error) {
        logError('Ошибка при генерации изображения', error);
        res.status(500).json({
            error: 'Внутренняя ошибка сервера',
            message: error.message
        });
    }
});

/**
 * GET /api/images/models - Получение списка моделей генерации изображений
 */
router.get('/images/models', async (req, res) => {
    try {
        const models = getAvailableImageModels();

        res.json({
            object: 'list',
            data: models.map((model) => ({
                id: model,
                object: 'model',
                created: Date.now(),
                owned_by: 'qwen',
                permission: [],
                capability: 'image_generation'
            }))
        });
    } catch (error) {
        logError('Ошибка при получении списка моделей изображений', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

/**
 * GET /api/images/status - Проверка статуса API генерации изображений
 */
router.get('/images/status', async (req, res) => {
    try {
        const isAvailable = await checkImageApiAvailability();

        res.json({
            available: isAvailable,
            mode: IMAGE_GENERATION_MODE,
            apiKeyConfigured: !!DASHSCOPE_API_KEY,
            message: IMAGE_GENERATION_MODE === 'browser'
                ? (isAvailable ? 'Browser mode активен' : 'Браузер не инициализирован')
                : (isAvailable
                    ? 'DashScope API доступен'
                    : DASHSCOPE_API_KEY
                        ? 'DashScope API недоступен или неверные учётные данные'
                        : 'API ключ DASHSCOPE_API_KEY не настроен')
        });
    } catch (error) {
        logError('Ошибка при проверке статуса API изображений', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// ============================================
// OPENAI-COMPATIBLE V1 ENDPOINTS
// ============================================

/**
 * GET /v1/images/generations - OpenAI-compatible image generation
 * Полная совместимость с openai-node и openai-python SDK
 */
router.post('/v1/images/generations', async (req, res) => {
    try {
        const { prompt, model, n, size, response_format, quality, style, user } = req.body;

        logInfo('[OpenAI v1] Получен запрос на генерацию изображения');
        logDebug(`Prompt: ${prompt?.substring(0, 100)}${prompt?.length > 100 ? '...' : ''}`);

        if (!prompt) {
            return res.status(400).json({
                error: {
                    message: 'Parameter "prompt" is required',
                    type: 'invalid_request_error',
                    param: 'prompt',
                    code: null
                }
            });
        }

        // Маппинг моделей OpenAI на Qwen Image модели
        let imageModel = model || 'qwen-image-plus';
        const modelMapping = {
            'dall-e-3': 'qwen-image-max',
            'dall-e-2': 'qwen-image-plus',
            'qwen-image-max': 'qwen-image-max',
            'qwen-image-plus': 'qwen-image-plus',
            'qwen-image': 'qwen-image',
            'wan2.6-t2i': 'wan2.6-t2i',
            'wan2.5-t2i-preview': 'wan2.5-t2i-preview',
            'wan2.2-t2i-flash': 'wan2.2-t2i-flash'
        };
        imageModel = modelMapping[model] || 'qwen-image-plus';

        // Проверка доступности API
        if (IMAGE_GENERATION_MODE === 'dashscope' && !DASHSCOPE_API_KEY) {
            return res.status(503).json({
                error: {
                    message: 'Image generation API is not configured',
                    type: 'server_error',
                    param: null,
                    code: 'service_unavailable'
                }
            });
        }

        // Преобразование размера из формата OpenAI в формат Qwen
        let qwenSize = '1024*1024';
        if (size) {
            const sizeMap = {
                '1024x1024': '1024*1024',
                '1024x1792': '1024*1792',
                '1792x1024': '1792*1024',
                '512x512': '512*512',
                '768x768': '768x768',
                '960x960': '960*960'
            };
            qwenSize = sizeMap[size] || '1024*1024';
        }

        const result = await generateImage(prompt, imageModel, {
            n: n || 1,
            size: qwenSize,
            promptExtend: true,
            watermark: false
        });

        if (result.error) {
            logError(`Ошибка генерации: ${result.error}`);
            return res.status(500).json({
                error: {
                    message: `Image generation failed: ${result.error}`,
                    type: 'server_error',
                    param: null,
                    code: 'generation_failed'
                }
            });
        }

        // Формируем ответ в формате OpenAI Images API
        const responseData = {
            created: Math.floor(Date.now() / 1000),
            data: [{
                url: result.imageUrl,
                revised_prompt: prompt
            }]
        };

        // Если запрошено несколько изображений (когда API поддерживает)
        if (n > 1 && result.imageUrls) {
            responseData.data = result.imageUrls.map((url) => ({
                url,
                revised_prompt: prompt
            }));
        }

        logInfo(`[OpenAI v1] Изображение сгенерировано: ${result.imageUrl}`);
        res.json(responseData);

    } catch (error) {
        logError('[OpenAI v1] Ошибка при генерации изображения', error);
        res.status(500).json({
            error: {
                message: `Internal server error: ${error.message}`,
                type: 'server_error',
                param: null,
                code: null
            }
        });
    }
});

/**
 * GET /v1/models - OpenAI-compatible models list (включая image models)
 */
router.get('/v1/models', async (req, res) => {
    try {
        const chatModels = getAllModels();
        const imageModels = getAvailableImageModels();

        const allModels = {
            object: 'list',
            data: [
                // Chat models
                ...chatModels.models.map((m) => ({
                    id: m.id || m.name || m,
                    object: 'model',
                    created: 0,
                    owned_by: 'qwen',
                    permission: [],
                    capabilities: ['chat', 'completion']
                })),
                // Image generation models
                ...imageModels.map((model) => ({
                    id: model,
                    object: 'model',
                    created: Date.now(),
                    owned_by: 'qwen',
                    permission: [],
                    capabilities: ['image_generation']
                }))
            ]
        };

        logInfo(`[OpenAI v1] Возвращено ${allModels.data.length} моделей`);
        res.json(allModels);
    } catch (error) {
        logError('[OpenAI v1] Ошибка при получении списка моделей', error);
        res.status(500).json({
            error: {
                message: 'Internal server error',
                type: 'server_error',
                param: null,
                code: null
            }
        });
    }
});

export default router;
