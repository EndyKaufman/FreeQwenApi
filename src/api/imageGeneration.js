// imageGeneration.js - Модуль для генерации изображений через Qwen Image API
import axios from 'axios';
import { logInfo, logError, logDebug } from '../logger/index.js';
import { sendMessage } from './chat.js';
import { IMAGE_GENERATION_MODE, DASHSCOPE_API_KEY } from '../config.js';

const DASHSCOPE_API_BASE = 'https://dashscope-intl.aliyuncs.com/api/v1';

// Модели для генерации изображений
const IMAGE_GENERATION_MODELS = [
    'qwen-image-max',
    'qwen-image-plus',
    'qwen-image',
    'wan2.6-t2i',
    'wan2.5-t2i-preview',
    'wan2.2-t2i-flash'
];

/**
 * Генерация изображения по текстовому описанию
 * @param {string} prompt - Текстовое описание изображения
 * @param {string} model - Модель для генерации
 * @param {object} options - Дополнительные параметры
 * @returns {Promise<object>} - Результат генерации
 */
export async function generateImage(prompt, model = 'qwen-image-plus', options = {}) {
    // Определяем режим генерации
    const mode = IMAGE_GENERATION_MODE;
    
    if (mode === 'browser') {
        logInfo('🎨 Генерация изображения через browser mode...');
        return generateImageViaBrowser(prompt, model, options);
    } else {
        logInfo('🎨 Генерация изображения через DashScope API...');
        return generateImageViaDashScope(prompt, model, options);
    }
}

/**
 * Генерация изображения через DashScope API (прямой вызов)
 */
async function generateImageViaDashScope(prompt, model = 'qwen-image-plus', options = {}) {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    
    if (!apiKey) {
        logError('API ключ DASHSCOPE_API_KEY не установлен');
        return {
            error: 'API ключ DASHSCOPE_API_KEY не установлен. Пожалуйста, настройте переменную окружения.'
        };
    }

    try {
        logInfo(`Генерация изображения через ${model}...`);
        logDebug(`Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);

        const payload = {
            model: model,
            input: {
                prompt: prompt,
                negative_prompt: options.negativePrompt || ' '
            },
            parameters: {
                size: options.size || '1024*1024',
                n: options.n || 1,
                prompt_extend: options.promptExtend !== false,
                watermark: options.watermark || false
            }
        };

        // Асинхронный запрос для Wan моделей
        const isWanModel = model.startsWith('wan');
        const endpoint = isWanModel 
            ? `${DASHSCOPE_API_BASE}/services/aigc/text2image/image-synthesis`
            : `${DASHSCOPE_API_BASE}/services/aigc/text2image/image-synthesis`;

        const response = await axios.post(endpoint, payload, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-DashScope-Async': isWanModel ? 'enable' : undefined
            },
            timeout: 120000
        });

        const data = response.data;

        // Асинхронный режим - получаем task_id и опрашиваем статус
        if (data.output?.task_id) {
            logInfo(`Задача создана: ${data.output.task_id}`);
            return await pollTaskStatus(data.output.task_id, apiKey);
        }

        // Синхронный режим - сразу получаем результат
        if (data.output?.results && data.output.results.length > 0) {
            const imageUrl = data.output.results[0].url;
            logInfo(`Изображение сгенерировано: ${imageUrl}`);
            return {
                success: true,
                imageUrl: imageUrl,
                taskId: data.output.task_id,
                model: model,
                prompt: prompt
            };
        }

        return {
            error: 'Неожиданный формат ответа от API',
            rawData: data
        };

    } catch (error) {
        logError('Ошибка при генерации изображения', error);
        return {
            error: error.response?.data?.message || error.message || 'Неизвестная ошибка'
        };
    }
}

/**
 * Генерация изображения через браузер (аналогично генерации текста)
 * Использует Qwen Chat API с chat_type='t2i'
 */
async function generateImageViaBrowser(prompt, model = 'qwen-image-plus', options = {}) {
    try {
        logInfo(`🖼️ Browser mode: генерация изображения через ${model}...`);
        logDebug(`Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);

        // Используем sendMessage с chatType='t2i' (text-to-image)
        const result = await sendMessage(
            prompt,
            model,
            null, // chatId - будет создан автоматически
            null, // parentId
            null, // files
            null, // tools
            null, // toolChoice
            null, // systemMessage
            't2i', // chatType - text to image
            options.size || '1024*1024', // size
            true // waitForCompletion
        );

        // Проверяем результат
        if (result.error) {
            logError('❌ Ошибка генерации изображения (browser mode)', result.error);
            return {
                error: result.error,
                details: result.details || 'Browser mode generation failed'
            };
        }

        // Извлекаем URL изображения из ответа
        let imageUrl = null;
        
        // Проверяем разные форматы ответа
        if (result.imageUrl) {
            imageUrl = result.imageUrl;
        } else if (result.choices?.[0]?.message?.content) {
            const content = result.choices[0].message.content;
            // Если контент - это URL изображения
            if (content.startsWith('http') || content.startsWith('data:')) {
                imageUrl = content;
            } else {
                // Пытаемся извлечь URL из markdown или JSON
                const urlMatch = content.match(/\[(?:Generated Image)?\]\(([^)]+)\)/);
                if (urlMatch) {
                    imageUrl = urlMatch[1];
                } else {
                    // Пробуем распарсить как JSON
                    try {
                        const parsed = JSON.parse(content);
                        imageUrl = parsed.url || parsed.image_url || parsed.imageUrl;
                    } catch {
                        // Не JSON, используем как есть
                        logWarn('⚠️ Ответ не содержит явного URL изображения');
                    }
                }
            }
        }

        if (!imageUrl) {
            logError('❌ URL изображения не найден в ответе');
            logDebug('Response:', JSON.stringify(result, null, 2));
            return {
                error: 'Image URL not found in response',
                rawResponse: result
            };
        }

        logInfo(`✅ Изображение сгенерировано (browser mode): ${imageUrl}`);
        return {
            success: true,
            imageUrl: imageUrl,
            model: model,
            prompt: prompt,
            chatId: result.chatId,
            parentId: result.parentId
        };

    } catch (error) {
        logError('❌ Ошибка при генерации изображения (browser mode)', error);
        return {
            error: error.message || 'Unknown error in browser mode'
        };
    }
}

/**
 * Опрос статуса задачи генерации изображения
 * @param {string} taskId - ID задачи
 * @param {string} apiKey - API ключ
 * @returns {Promise<object>} - Результат генерации
 */
async function pollTaskStatus(taskId, apiKey) {
    const maxAttempts = 60;
    const pollInterval = 2000; // 2 секунды

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await axios.get(
                `${DASHSCOPE_API_BASE}/tasks/${taskId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    }
                }
            );

            const task = response.data;
            const taskStatus = task.output?.task_status;

            logDebug(`Статус задачи ${taskId}: ${taskStatus} (попытка ${attempt + 1}/${maxAttempts})`);

            if (taskStatus === 'SUCCEEDED') {
                const imageUrl = task.output?.results?.[0]?.url;
                if (imageUrl) {
                    logInfo(`Изображение сгенерировано: ${imageUrl}`);
                    return {
                        success: true,
                        imageUrl: imageUrl,
                        taskId: taskId,
                        model: task.input?.model || 'unknown'
                    };
                }
                return { error: 'Изображение не найдено в результате' };
            }

            if (taskStatus === 'FAILED' || taskStatus === 'CANCELLED') {
                return {
                    error: `Задача завершена со статусом: ${taskStatus}`,
                    message: task.output?.message || 'Неизвестная ошибка'
                };
            }

            // PENDING или RUNNING - продолжаем опрос
            await new Promise(resolve => setTimeout(resolve, pollInterval));

        } catch (error) {
            logError(`Ошибка при опросе задачи ${taskId}`, error);
            if (attempt === maxAttempts - 1) {
                return { error: `Ошибка опроса: ${error.message}` };
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
    }

    return { error: 'Превышено время ожидания генерации изображения' };
}

/**
 * Получить список доступных моделей генерации изображений
 * @returns {string[]} - Список моделей
 */
export function getAvailableImageModels() {
    return IMAGE_GENERATION_MODELS;
}

/**
 * Проверка доступности API генерации изображений
 * @returns {Promise<boolean>} - Статус доступности
 */
export async function checkImageApiAvailability() {
    const mode = IMAGE_GENERATION_MODE;
    
    // Browser mode всегда доступен (если браузер работает)
    if (mode === 'browser') {
        logDebug('🖼️ Browser mode: проверка через статус браузера');
        const { getBrowserContext, getAuthenticationStatus } = await import('../browser/browser.js');
        const browserContext = getBrowserContext();
        const isAuthenticated = getAuthenticationStatus();
        return !!(browserContext && isAuthenticated);
    }
    
    // DashScope mode: проверяем API ключ
    const apiKey = DASHSCOPE_API_KEY;
    
    if (!apiKey) {
        return false;
    }

    try {
        // Простой тестовый запрос для проверки API
        await axios.get(`${DASHSCOPE_API_BASE}/models`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 5000
        });
        return true;
    } catch (error) {
        logDebug(`API генерации изображений недоступен: ${error.message}`);
        return false;
    }
}
