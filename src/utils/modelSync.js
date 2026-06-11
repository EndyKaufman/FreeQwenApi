import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logWarn, logError } from '../logger/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const QWEN_CHAT_URL = process.env.QWEN_CHAT_URL || 'https://chat.qwen.ai/';
const OUTPUT_FILE = process.env.QWEN_MODELS_FILE || path.join(__dirname, '..', 'AvailableModels.txt');
const DOC_FILE = process.env.QWEN_MODELS_DOC || path.join(process.cwd(), 'docs', 'QWEN_CHAT_MODELS.md');

/**
 * Remove duplicates while preserving order
 * @param {string[]} values
 * @returns {string[]}
 */
function uniq(values) {
    const seen = new Set();
    const result = [];
    for (const value of values) {
        const normalized = String(value || '').trim();
        if (!normalized || seen.has(normalized)) {continue;}
        seen.add(normalized);
        result.push(normalized);
    }
    return result;
}

/**
 * Read existing models from file
 * @param {string} file
 * @returns {string[]}
 */
function readExistingModels(file) {
    if (!fs.existsSync(file)) {return [];}
    return fs.readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
}

/**
 * Extract prerendered JSON from Qwen Chat HTML
 * @param {string} html
 * @returns {object}
 */
function extractPrerenderedJson(html) {
    const match = html.match(/window\.__prerendered_data\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
    if (!match) {
        throw new Error('Не удалось найти window.__prerendered_data в HTML Qwen Chat');
    }
    return JSON.parse(match[1]);
}

/**
 * Extract model capabilities
 * @param {object} model
 * @returns {string[]}
 */
function capabilitiesOf(model) {
    const caps = model?.info?.meta?.capabilities || {};
    const labels = {
        audio: 'аудио',
        document: 'документы',
        search: 'поиск',
        thinking: 'thinking-режим',
        video: 'видео',
        vision: 'зрение'
    };
    return Object.entries(caps)
        .filter(([, enabled]) => Boolean(enabled))
        .map(([name]) => labels[name] || name)
        .sort();
}

/**
 * Fetch models from Qwen Chat prerendered data
 * @returns {Promise<Array<{id: string, name: string, capabilities: string[], description: string}>>}
 */
export async function fetchQwenChatModels() {
    logInfo('🔍 Загрузка моделей с Qwen Chat (prerendered data)...');

    try {
        const response = await fetch(QWEN_CHAT_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        if (!response.ok) {
            throw new Error(`Запрос к Qwen Chat не удался: HTTP ${response.status}`);
        }

        const html = await response.text();
        const data = extractPrerenderedJson(html);
        const models = Array.isArray(data.models) ? data.models : [];

        const result = models
            .map((model) => ({
                id: model.id,
                name: model.name || model.id,
                capabilities: capabilitiesOf(model),
                description: model?.info?.meta?.short_description || model?.info?.meta?.description || ''
            }))
            .filter((model) => model.id);

        logInfo(`✅ Найдено ${result.length} моделей в Qwen Chat`);
        return result;
    } catch (error) {
        logError('❌ Ошибка загрузки моделей с Qwen Chat', error);
        throw error;
    }
}

/**
 * Write models to AvailableModels.txt
 * @param {string} file
 * @param {string[]} models
 */
function writeModelsFile(file, models) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const header = [
        '# Qwen Models - Updated from Qwen Chat',
        `# Last updated: ${new Date().toISOString().split('T')[0]}`,
        `# Total: ${models.length} models from Qwen Chat prerendered data`,
        ''
    ].join('\n');

    fs.writeFileSync(file, `${header}\n${models.join('\n')}\n`, 'utf8');
    logInfo(`📝 Список моделей записан: ${models.length} моделей -> ${file}`);
}

/**
 * Write synchronization documentation
 * @param {string} file
 * @param {Array<{id: string, name: string, capabilities: string[], description: string}>} discoveredModels
 * @param {string[]} mergedIds
 * @param {string[]} previousIds
 */
function writeDocFile(file, discoveredModels, mergedIds, previousIds) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const now = new Date().toISOString();
    const discoveredIds = discoveredModels.map((model) => model.id);
    const added = discoveredIds.filter((id) => !previousIds.includes(id));
    const missingFromChat = previousIds.filter((id) => !discoveredIds.includes(id));

    const lines = [];
    lines.push('# Синхронизация моделей Qwen Chat');
    lines.push('');
    lines.push(`Сгенерировано: ${now}`);
    lines.push('');
    lines.push('Источник: prerendered-метаданные моделей с https://chat.qwen.ai/.');
    lines.push('');
    lines.push('## Модели, которые сейчас видны в Qwen Chat');
    lines.push('');
    for (const model of discoveredModels) {
        const caps = model.capabilities.length ? ` — ${model.capabilities.join(', ')}` : '';
        lines.push(`- \`${model.id}\`${caps}`);
    }
    lines.push('');
    lines.push('## Добавлено последней синхронизацией');
    lines.push('');
    if (added.length) {
        for (const id of added) {lines.push(`- \`${id}\``);}
    } else {
        lines.push('- Новых моделей нет.');
    }
    lines.push('');
    lines.push('## Модели эндпоинта, которых нет в текущих landing-метаданных Qwen Chat');
    lines.push('');
    if (missingFromChat.length) {
        for (const id of missingFromChat) {lines.push(`- \`${id}\``);}
    } else {
        lines.push('- Таких моделей нет.');
    }
    lines.push('');
    lines.push('## Итоговый объединённый список моделей эндпоинта');
    lines.push('');
    for (const id of mergedIds) {lines.push(`- \`${id}\``);}
    lines.push('');

    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    logInfo(`📄 Отчёт синхронизации записан: ${file}`);
}

/**
 * Main synchronization function
 * @returns {Promise<string[]>} - Merged list of model IDs
 */
export async function syncQwenModels() {
    try {
        const existing = uniq(readExistingModels(OUTPUT_FILE));
        const discovered = await fetchQwenChatModels();
        const discoveredIds = uniq(discovered.map((model) => model.id));
        const merged = uniq([...discoveredIds, ...existing]);

        writeModelsFile(OUTPUT_FILE, merged);
        writeDocFile(DOC_FILE, discovered, merged, existing);

        logInfo(`Найдено моделей Qwen Chat: ${discoveredIds.length}`);
        logInfo(`Список моделей эндпоинта записан: ${merged.length} моделей -> ${OUTPUT_FILE}`);

        const added = discoveredIds.filter((id) => !existing.includes(id));
        if (added.length) {
            logInfo(`✨ Новые модели: ${added.join(', ')}`);
        }

        return merged;
    } catch (error) {
        logError('❌ Синхронизация моделей не удалась', error);
        throw error;
    }
}
