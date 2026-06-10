// Пример правильного управления диалогами с OpenAI SDK
// Показывает 3 способа создания нового чата

import OpenAI from 'openai';

const openai = new OpenAI({
    baseURL: 'http://localhost:3264/api',
    apiKey: 'free-qwen-api'
});

async function testNewChatCreation() {
    console.log('=== Тест 1: Использование extraHeaders с x-chat-id ===\n');

    // Способ 1: Правильная передача header через extraHeaders
    const randomId1 = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const response1 = await openai.chat.completions.create({
        model: 'qwen-max-latest',
        messages: [
            { role: 'user', content: 'Это первый запрос в новом чате. Меня зовут Alice.' }
        ]
    }, {
        extraHeaders: {
            'x-chat-id': randomId1
        }
    });

    console.log('Ответ 1:', response1.choices[0].message.content);
    console.log('Chat ID:', randomId1);
    console.log('Internal chatId:', response1.chatId);
    console.log('Parent ID:', response1.parentId);

    console.log('\n=== Тест 2: Использование chat_id в body ===\n');

    // Способ 2: Передача chat_id напрямую в body
    const randomId2 = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const response2 = await openai.chat.completions.create({
        model: 'qwen-max-latest',
        messages: [
            { role: 'user', content: 'Это второй запрос в другом чате. Меня зовут Bob.' }
        ],
        chat_id: randomId2
    });

    console.log('Ответ 2:', response2.choices[0].message.content);
    console.log('Chat ID:', randomId2);
    console.log('Internal chatId:', response2.chatId);
    console.log('Parent ID:', response2.parentId);

    console.log('\n=== Тест 3: Использование newChat флага ===\n');

    // Способ 3: Использование флага newChat для принудительного создания нового чата
    const response3 = await openai.chat.completions.create({
        model: 'qwen-max-latest',
        messages: [
            { role: 'user', content: 'Это третий запрос с newChat=true. Меня зовут Charlie.' }
        ],
        newChat: true
    });

    console.log('Ответ 3:', response3.choices[0].message.content);
    console.log('Internal chatId:', response3.chatId);
    console.log('Parent ID:', response3.parentId);

    console.log('\n=== Тест 4: Принудительный FORCE_NEW_CHAT_PER_REQUEST режим ===\n');
    console.log('Для этого режима добавьте в .env:');
    console.log('FORCE_NEW_CHAT_PER_REQUEST=true');
    console.log('Тогда каждый запрос автоматически создает новый чат');
    console.log('Без необходимости передавать дополнительные параметры');

    const response4 = await openai.chat.completions.create({
        model: 'qwen-max-latest',
        messages: [
            { role: 'user', content: 'Этот запрос должен создать новый чат если FORCE_NEW_CHAT_PER_REQUEST=true' }
        ]
    });

    console.log('Internal chatId:', response4.chatId);
    console.log('Parent ID:', response4.parentId);
}

async function testConversationContinuation() {
    console.log('\n=== Тест: Продолжение существующего диалога ===\n');

    // Создаем уникальный ID для диалога
    const conversationId = `my-conversation-${Date.now()}`;

    // Первый запрос
    const response1 = await openai.chat.completions.create({
        model: 'qwen-max-latest',
        messages: [
            { role: 'user', content: 'Меня зовут Diana. Запомни это.' }
        ]
    }, {
        extraHeaders: {
            'x-chat-id': conversationId
        }
    });

    console.log('Первый ответ:', response1.choices[0].message.content);

    // Продолжаем тот же диалог (используем ТОТ ЖЕ x-chat-id)
    const response2 = await openai.chat.completions.create({
        model: 'qwen-max-latest',
        messages: [
            { role: 'user', content: 'Как меня зовут?' }
        ]
    }, {
        extraHeaders: {
            'x-chat-id': conversationId
        }
    });

    console.log('Второй ответ (должен помнить имя):', response2.choices[0].message.content);
}

// Запуск тестов
async function main() {
    try {
        await testNewChatCreation();
        await testConversationContinuation();
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

main();
