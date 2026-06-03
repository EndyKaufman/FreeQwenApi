// Тест генерации изображений в обоих режимах
import { generateImage, checkImageApiAvailability } from '../../src/api/imageGeneration.js';
import { IMAGE_GENERATION_MODE } from '../../src/config.js';

async function testImageGeneration() {
    console.log('🧪 Тестирование генерации изображений\n');
    console.log(`Текущий режим: ${IMAGE_GENERATION_MODE}`);
    
    // Проверка доступности API
    console.log('\n📋 Проверка доступности API...');
    const isAvailable = await checkImageApiAvailability();
    console.log(`API доступен: ${isAvailable ? '✅' : '❌'}`);
    
    if (!isAvailable) {
        console.log('⚠️ API недоступен. Проверьте настройки.');
        return;
    }
    
    // Тест генерации
    console.log('\n🎨 Тест генерации изображения...');
    const prompt = 'A beautiful sunset over the ocean with dramatic clouds';
    
    const result = await generateImage(prompt, 'qwen-image-plus', {
        size: '1024*1024'
    });
    
    if (result.success) {
        console.log('✅ Изображение успешно сгенерировано!');
        console.log(`URL: ${result.imageUrl}`);
        console.log(`Model: ${result.model}`);
        console.log(`Prompt: ${result.prompt}`);
        if (result.chatId) {
            console.log(`Chat ID: ${result.chatId}`);
        }
    } else {
        console.log('❌ Ошибка генерации:');
        console.log(`Error: ${result.error}`);
        if (result.details) {
            console.log(`Details: ${result.details}`);
        }
    }
}

// Запуск теста
testImageGeneration().catch(console.error);
