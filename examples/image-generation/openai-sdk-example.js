// Пример использования генерации изображений через OpenAI SDK
// Полная совместимость с openai-node библиотекой

import OpenAI from 'openai';

// Настройка клиента для вашего API
const openai = new OpenAI({
    baseURL: 'http://localhost:3000/v1', // URL вашего API
    apiKey: 'your-api-key' // Или из .env
});

async function generateImage() {
    try {
        console.log('🎨 Генерация изображения через OpenAI SDK...');

        const image = await openai.images.generate({
            prompt: 'A beautiful sunset over the ocean with dramatic clouds',
            model: 'dall-e-3', // Будет замаплено на qwen-image-max
            size: '1024x1024',
            n: 1
        });

        console.log('✅ Изображение сгенерировано!');
        console.log('URL:', image.data[0].url);
        console.log('Revised prompt:', image.data[0].revised_prompt);
        console.log('Created:', new Date(image.created * 1000).toISOString());

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

async function listImageModels() {
    try {
        console.log('\n📋 Список моделей для генерации изображений:');

        const models = await openai.models.list();
        const imageModels = models.data.filter((m) =>
            m.capabilities?.includes('image_generation')
        );

        imageModels.forEach((model) => {
            console.log(`  - ${model.id} (${model.owned_by})`);
        });

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

// Запуск
await generateImage();
await listImageModels();
