// Пример управления диалогами через header x-chat-id
// Этот подход полностью совместим с OpenAI API

import OpenAI from 'openai';

const openai = new OpenAI({
    baseURL: 'http://localhost:3264/api',
    apiKey: 'dummy-key' // Ключ не используется, но требуется для SDK
});

async function conversationWithHeader() {
    try {
        console.log('=== Пример 1: Новый диалог через уникальный x-chat-id ===\n');

        // Каждый уникальный x-chat-id создает отдельный диалог
        const conversationId1 = 'my-conversation-001';

        const response1 = await openai.chat.completions.create({
            messages: [
                { role: 'user', content: 'Меня зовут Алексей. Запомни это.' }
            ],
            model: 'qwen-max-latest'
        }, {
            headers: {
                'x-chat-id': conversationId1
            }
        });

        console.log('Ответ 1:', response1.choices[0].message.content);
        console.log('Conversation ID:', conversationId1);
        console.log('Internal chatId:', response1.chatId);

        console.log('\n=== Пример 2: Продолжение того же диалога ===\n');

        // Используем тот же x-chat-id - диалог продолжится
        const response2 = await openai.chat.completions.create({
            messages: [
                { role: 'user', content: 'Как меня зовут?' }
            ],
            model: 'qwen-max-latest'
        }, {
            headers: {
                'x-chat-id': conversationId1
            }
        });

        console.log('Ответ 2:', response2.choices[0].message.content);

        console.log('\n=== Пример 3: Совершенно новый диалог ===\n');

        // Новый x-chat-id - создается отдельный диалог
        const conversationId2 = 'my-conversation-002';

        const response3 = await openai.chat.completions.create({
            messages: [
                { role: 'user', content: 'Как меня зовут?' }
            ],
            model: 'qwen-max-latest'
        }, {
            headers: {
                'x-chat-id': conversationId2
            }
        });

        console.log('Ответ 3:', response3.choices[0].message.content);
        console.log('(должен ответить, что не знает, т.к. это новый диалог)');

    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// Запуск
conversationWithHeader();
