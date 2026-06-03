// Примеры использования API с файлами
// Демонстрация всех поддерживаемых форматов
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import FormData from 'form-data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = 'http://localhost:3264/api';

// ============================================
// Формат 1: Multipart Form Data (новый endpoint)
// ============================================

async function testMultipartUpload() {
    console.log('\n=== Тест 1: Multipart Form Data ===\n');

    const formData = new FormData();
    formData.append('message', 'Проанализируй эти изображения и опиши что на них');
    formData.append('model', 'qwen-vl-max');

    // Добавляем файлы
    const imagePath1 = path.join(__dirname, '../file-upload/test-image.jpg');
    const imagePath2 = path.join(__dirname, '../file-upload/test-image.jpg');

    if (fs.existsSync(imagePath1)) {
        formData.append('files', fs.createReadStream(imagePath1));
        formData.append('files', fs.createReadStream(imagePath2));
        console.log('📎 Прикреплено файлов: 2');
    }

    try {
        const response = await axios.post(`${API_URL}/chat/multipart`, formData, {
            headers: formData.getHeaders()
        });

        console.log('✅ Ответ получен:');
        console.log(response.data.choices[0].message.content);
    } catch (error) {
        console.error('❌ Ошибка:', error.response?.data || error.message);
    }
}

// ============================================
// Формат 2: OpenAI-compatible с base64
// ============================================

async function testOpenAIBase64() {
    console.log('\n=== Тест 2: OpenAI Format с Base64 ===\n');

    const imagePath = path.join(__dirname, '../file-upload/test-image.jpg');

    if (!fs.existsSync(imagePath)) {
        console.log('⚠️  Тестовый файл не найден, пропускаем');
        return;
    }

    // Читаем файл и конвертируем в base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    const payload = {
        model: 'qwen-vl-max',
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'Что изображено на этом фото?' },
                    {
                        type: 'image_url',
                        image_url: { url: dataUrl }
                    }
                ]
            }
        ]
    };

    try {
        const response = await axios.post(`${API_URL}/chat/completions`, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('✅ Ответ получен:');
        console.log(response.data.choices[0].message.content);
    } catch (error) {
        console.error('❌ Ошибка:', error.response?.data || error.message);
    }
}

// ============================================
// Формат 3: Custom files array
// ============================================

async function testCustomFilesArray() {
    console.log('\n=== Тест 3: Custom Files Array ===\n');

    const payload = {
        model: 'qwen-vl-max',
        messages: [
            {
                role: 'user',
                content: 'Опиши изображения',
                files: [
                    { url: 'https://loremflickr.com/cache/resized/1616_25930085350_b6ef86ddd9_c_320_240_nofilter.jpg' },
                    { url: 'https://loremflickr.com/cache/resized/4137_4786929075_be678ce15c_320_240_nofilter.jpg' }
                ]
            }
        ]
    };

    console.log('📎 Files:', payload.messages[0].files);
    console.log('(Пример с внешними URL)');

    try {
        const response = await axios.post(`${API_URL}/chat/completions`, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('✅ Ответ:', response.data.choices[0].message.content);
    } catch (error) {
        console.error('❌ Ошибка:', error.response?.data || error.message);
    }
}

// ============================================
// Формат 4: Streaming с файлами
// ============================================

async function testStreamingWithFiles() {
    console.log('\n=== Тест 4: Streaming с Multipart ===\n');

    const formData = new FormData();
    formData.append('message', 'Опиши что на изображении');
    formData.append('stream', 'true');

    const imagePath = path.join(__dirname, '../file-upload/test-image.jpg');
    if (fs.existsSync(imagePath)) {
        formData.append('files', fs.createReadStream(imagePath));
    }

    try {
        const response = await axios.post(`${API_URL}/chat/multipart`, formData, {
            headers: formData.getHeaders(),
            responseType: 'stream'
        });

        console.log('🔄 Streaming started...\n');

        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                        const content = data.choices[0]?.delta?.content;
                        if (content) {
                            process.stdout.write(content);
                        }
                    } catch { /* ignore parse errors */ }
                }
            }
        });

        response.data.on('end', () => {
            console.log('\n\n✅ Streaming complete');
        });
    } catch (error) {
        console.error('❌ Ошибка:', error.response?.data || error.message);
    }
}

// ============================================
// Запуск тестов
// ============================================

async function runAllTests() {
    console.log('🚀 Тестирование API с файлами\n');
    console.log('Убедитесь что сервер запущен на http://localhost:3264');

    await testMultipartUpload();
    await testOpenAIBase64();
    await testCustomFilesArray();
    await testStreamingWithFiles();

    console.log('\n✅ Все тесты завершены!');
}

// Запускаем
runAllTests().catch(console.error);
