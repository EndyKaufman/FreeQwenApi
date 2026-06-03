# Image Generation Mode Configuration

## Обзор

FreeQwenApi поддерживает два режима генерации изображений:

1. **DashScope API Mode** (по умолчанию) - прямой вызов API
2. **Browser Mode** - генерация через браузер (как текстовые сообщения)

## Переключение режимов

### Через переменную окружения

В файле `.env`:

```env
# Режим генерации изображений
# Варианты: 'dashscope' или 'browser'
IMAGE_GENERATION_MODE=dashscope
```

### DashScope API Mode

**Когда использовать:**
- ✅ Есть API ключ DashScope
- ✅ Нужна быстрая генерация
- ✅ Не хочется запускать браузер

**Настройка:**

```env
IMAGE_GENERATION_MODE=dashscope
DASHSCOPE_API_KEY=sk-your-api-key-here
```

**Получить API ключ:**
1. Зарегистрируйтесь на https://dashscope.console.aliyun.com/
2. Создайте API ключ в разделе API Keys
3. Добавьте в `.env` файл

**Поддерживаемые модели:**
- `qwen-image-max` (высшее качество)
- `qwen-image-plus` (высокое качество)
- `qwen-image` (стандартное)
- `wan2.6-t2i`, `wan2.5-t2i-preview`, `wan2.2-t2i-flash`

### Browser Mode

**Когда использовать:**
- ✅ Нет API ключа DashScope
- ✅ Уже настроена авторизация в браузере
- ✅ Хотите использовать тот же аккаунт, что и для чата

**Настройка:**

```env
IMAGE_GENERATION_MODE=browser
# DASHSCOPE_API_KEY не требуется!
```

**Как это работает:**
1. Использует тот же браузер, что и генерация текста
2. Отправляет запрос через Qwen Chat API
3. `chatType='t2i'` (text-to-image)
4. Автоматически извлекает URL изображения из ответа

**Преимущества:**
- Не требует дополнительного API ключа
- Использует существующую авторизацию
- Работает через официальный интерфейс Qwen

## Сравнение режимов

| Параметр | DashScope | Browser |
|----------|-----------|---------|
| Скорость | ⚡ Быстрее | 🐌 Медленнее |
| API ключ | ✅ Требуется | ❌ Не нужен |
| Браузер | ❌ Не нужен | ✅ Требуется |
| Качество | 🔥 Максимальное | 🔥 Такое же |
| Стоимость | 💰 Платный | 💰 Зависит от аккаунта |
| Стабильность | ✅ Высокая | ⚠️ Зависит от браузера |

## Проверка текущего режима

```bash
curl http://localhost:3000/api/images/status
```

Ответ:
```json
{
  "available": true,
  "mode": "browser",
  "apiKeyConfigured": false,
  "message": "Browser mode активен"
}
```

Или:

```json
{
  "available": true,
  "mode": "dashscope",
  "apiKeyConfigured": true,
  "message": "DashScope API доступен"
}
```

## Примеры использования

### Node.js (OpenAI SDK)

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
    baseURL: 'http://localhost:3000/v1',
    apiKey: 'your-api-key'
});

// Работает в обоих режимах!
const image = await openai.images.generate({
    prompt: 'A beautiful sunset',
    model: 'dall-e-3',
    size: '1024x1024'
});

console.log(image.data[0].url);
```

### Python

```python
from openai import OpenAI

client = OpenAI(
    base_url='http://localhost:3000/v1',
    api_key='your-api-key'
)

# Работает в обоих режимах!
response = client.images.generate(
    prompt='A beautiful sunset',
    model='dall-e-3',
    size='1024x1024'
)

print(response.data[0].url)
```

### curl

```bash
curl -X POST http://localhost:3000/v1/images/generations \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful sunset",
    "model": "dall-e-3",
    "size": "1024x1024"
  }'
```

## Тестирование

```bash
# Запустить тест генерации
node examples/image-generation/test-generation.js

# Тест с OpenAI SDK (Node.js)
node examples/image-generation/openai-sdk-example.js

# Тест с OpenAI SDK (Python)
python examples/image-generation/openai_sdk_example.py
```

## Troubleshooting

### "API генерации изображений не настроен"

**DashScope mode:**
```env
IMAGE_GENERATION_MODE=dashscope
DASHSCOPE_API_KEY=your-key-here
```

**Browser mode:**
```env
IMAGE_GENERATION_MODE=browser
# Убедитесь, что браузер запущен и авторизован
```

### Browser mode не работает

1. Проверьте, что браузер запущен
2. Проверьте авторизацию: `curl http://localhost:3000/api/status`
3. Убедитесь, что `IMAGE_GENERATION_MODE=browser`

### DashScope API не работает

1. Проверьте API ключ на https://dashscope.console.aliyun.com/
2. Убедитесь, что `DASHSCOPE_API_KEY` установлен в `.env`
3. Проверьте баланс аккаунта

## Переключение на лету

Можно изменить режим без перезапуска сервера (если сервер поддерживает hot-reload):

```bash
# В одном терминале
export IMAGE_GENERATION_MODE=browser
node index.js

# В другом терминале - тест
curl http://localhost:3000/api/images/status
```

Или измените `.env` и перезапустите сервер.
