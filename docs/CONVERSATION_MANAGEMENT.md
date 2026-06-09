# Управление диалогами через API

## Обзор

FreeQwenApi поддерживает несколько режимов управления диалогами:

1. **Автоматическое восстановление сессии** (по умолчанию) - продолжает предыдущий диалог
2. **Ручное управление через header `x-chat-id`** - полный контроль над диалогами (OpenAI-совместимый способ)
3. **Режим FORCE_NEW_CHAT_PER_REQUEST** - каждый запрос создает новый диалог (как стандартный OpenAI API)

---

## Способ 1: Header `x-chat-id` (Рекомендуется, OpenAI-совместимый)

### Принцип работы

Передавайте header `x-chat-id` для управления диалогами:
- **Одинаковый `x-chat-id`** = продолжение того же диалога
- **Уникальный `x-chat-id`** = создание нового диалога

### Пример с OpenAI SDK (JavaScript)

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
    baseURL: 'http://localhost:3264/api',
    apiKey: 'dummy-key',
});

// Новый диалог
const conversationId = 'my-unique-conversation-123';

const response = await openai.chat.completions.create({
    messages: [
        { role: 'user', content: 'Привет! Меня зовут Алексей.' }
    ],
    model: 'qwen-max-latest',
}, {
    headers: {
        'x-chat-id': conversationId  // <-- Управляем диалогом через header
    }
});

// Продолжение того же диалога (используем тот же x-chat-id)
const response2 = await openai.chat.completions.create({
    messages: [
        { role: 'user', content: 'Как меня зовут?' }
    ],
    model: 'qwen-max-latest',
}, {
    headers: {
        'x-chat-id': conversationId  // <-- Тот же ID = тот же диалог
    }
});
```

### Пример с fetch (JavaScript)

```javascript
// Новый диалог
const response = await fetch('http://localhost:3264/api/v1/chat/completions', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-chat-id': 'conversation-abc-123'  // <-- Уникальный ID для нового диалога
    },
    body: JSON.stringify({
        messages: [
            { role: 'user', content: 'Привет!' }
        ],
        model: 'qwen-max-latest'
    })
});

// Продолжение диалога
const response2 = await fetch('http://localhost:3264/api/v1/chat/completions', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-chat-id': 'conversation-abc-123'  // <-- Тот же ID = продолжение
    },
    body: JSON.stringify({
        messages: [
            { role: 'user', content: 'Как меня зовут?' }
        ],
        model: 'qwen-max-latest'
    })
});
```

### Пример с curl

```bash
# Новый диалог
curl -X POST http://localhost:3264/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-chat-id: my-conversation-001" \
  -d '{
    "messages": [{"role": "user", "content": "Привет!"}],
    "model": "qwen-max-latest"
  }'

# Продолжение диалога
curl -X POST http://localhost:3264/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-chat-id: my-conversation-001" \
  -d '{
    "messages": [{"role": "user", "content": "Как меня зовут?"}],
    "model": "qwen-max-latest"
  }'
```

### Пример с Python

```python
import openai

client = openai.OpenAI(
    base_url="http://localhost:3264/api",
    api_key="dummy-key"
)

# Новый диалог
conversation_id = "my-python-conversation-001"

response = client.chat.completions.create(
    messages=[{"role": "user", "content": "Привет! Меня зовут Мария."}],
    model="qwen-max-latest",
    extra_headers={"x-chat-id": conversation_id}
)

print(response.choices[0].message.content)

# Продолжение диалога
response2 = client.chat.completions.create(
    messages=[{"role": "user", "content": "Как меня зовут?"}],
    model="qwen-max-latest",
    extra_headers={"x-chat-id": conversation_id}
)

print(response2.choices[0].message.content)
```

---

## Способ 2: Режим FORCE_NEW_CHAT_PER_REQUEST

### Включение режима

Добавьте в `.env` файл:

```env
# Каждый запрос создает новый диалог (как стандартный OpenAI API)
FORCE_NEW_CHAT_PER_REQUEST=true
```

### Поведение

Когда `FORCE_NEW_CHAT_PER_REQUEST=true`:
- **Каждый запрос** к API создает **новый диалог**
- История **не сохраняется** между запросами
- Поведение идентично стандартному OpenAI API
- Header `x-chat-id` **игнорируется**

### Когда использовать

- Вы хотите поведение **точно как у OpenAI**
- Вам **не нужна** история диалогов
- Вы сами управляете контекстом через массив `messages`

---

## Способ 3: Принудительное создание нового диалога

Даже когда сессии включены, можно создать новый диалог одним из способов:

### Через header

```bash
curl -X POST http://localhost:3264/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-new-chat: true" \
  -d '{
    "messages": [{"role": "user", "content": "Новый диалог"}],
    "model": "qwen-max-latest"
  }'
```

### Через body параметр

```json
{
  "messages": [{"role": "user", "content": "Новый диалог"}],
  "model": "qwen-max-latest",
  "newChat": true
}
```

---

## Сравнение подходов

| Подход | Совместимость с OpenAI | Контроль над диалогами | Сохранение истории |
|--------|------------------------|------------------------|-------------------|
| Header `x-chat-id` | ✅ Полная | ✅ Полный | ✅ Да |
| `FORCE_NEW_CHAT_PER_REQUEST=true` | ✅ Полная | ❌ Всегда новый | ❌ Нет |
| Автоматические сессии (по умолчанию) | ❌ Частичная | ❌ Автоматический | ✅ Да |

---

## Рекомендации

### Для OpenAI-совместимых приложений

Используйте **header `x-chat-id`**:
- Полная совместимость с OpenAI SDK
- Полный контроль над диалогами
- Возможность иметь несколько параллельных диалогов

### Для stateless приложений

Включите **`FORCE_NEW_CHAT_PER_REQUEST=true`**:
- Простота (не нужно управлять ID)
- Поведение как у стандартного OpenAI API
- Каждый запрос независим

### Для простых чат-ботов

Оставьте **режим по умолчанию**:
- Автоматическое восстановление диалога
- Минимум настроек
- Хороший UX для последовательных запросов

---

## Поддерживаемые headers

| Header | Назначение |
|--------|-----------|
| `x-chat-id` | ID диалога (основной способ) |
| `x-conversation-id` | Альтернативное название для `x-chat-id` |
| `x-new-chat: true` | Принудительно создать новый диалог |
| `x-reset-chat: true` | Сбросить текущий диалог |
| `x-parent-id` | ID родительского сообщения (для ветвления) |

---

## Примеры использования

Смотрите примеры в папке `examples/openai-sdk/`:
- `conversation-header.js` - управление диалогами через header
- `conversation.py` - управление через Python SDK

---

## Интеграция с Telegram Bot

### Автоматическое управление диалогами

Telegram бот автоматически использует `x-chat-id` header для изоляции диалогов между пользователями:

```javascript
// В src/utils/telegramBot.js
const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-chat-id': `telegram-${chatId}`  // Уникальный ID для каждого чата
    },
    body: JSON.stringify(requestBody)
});
```

### Как это работает

1. **Каждый Telegram чат/пользователь** получает уникальный `x-chat-id` в формате `telegram-{chatId}`
2. **Диалоги изолированы**: пользователь A не видит историю пользователя B
3. **Контекст сохраняется**: бот помнит историю в пределах одного Telegram чата
4. **Автоматическое управление**: API сам управляет историей через Qwen сервер

### Формат ID

| Тип чата | Формат x-chat-id | Пример |
|----------|------------------|--------|
| Личный чат | `telegram-{userId}` | `telegram-123456789` |
| Групповой чат | `telegram-{groupId}` | `telegram-987654321` |
| Канал | `telegram-{channelId}` | `telegram-555666777` |

### Преимущества

✅ **Изоляция**: Каждый пользователь имеет свой диалог  
✅ **Масштабируемость**: API управляет контекстом, а не бот  
✅ **Сохранность**: История хранится на сервере Qwen  
✅ **Прозрачность**: Не нужно вручную управлять `messages` массивом  

### Отключение (для тестирования)

Если хотите отключить использование `x-chat-id` в Telegram боте:

1. Откройте `src/utils/telegramBot.js`
2. Найдите строку с `'x-chat-id': \`telegram-${chatId}\``
3. Удалите или закомментируйте эту строку
4. Перезапустите бота

⚠️ **Внимание**: Без `x-chat-id` все пользователи будут共享 один диалог!
