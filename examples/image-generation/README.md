# Image Generation Examples

Примеры использования генерации изображений через OpenAI-compatible API.

## Режимы генерации

### DashScope API (по умолчанию)

Прямой вызов DashScope API через API ключ.

**Настройка:**
```env
IMAGE_GENERATION_MODE=dashscope
DASHSCOPE_API_KEY=your-api-key
```

**Плюсы:**
- Быстрая генерация
- Не требует браузера
- Прямой доступ к Qwen Image моделям

### Browser Mode

Генерация через браузер (аналогично генерации текста).

**Настройка:**
```env
IMAGE_GENERATION_MODE=browser
```

**Плюсы:**
- Не требует отдельного API ключа
- Использует ту же авторизацию, что и чат
- Работает через Qwen Chat интерфейс

## Доступные endpoints

### OpenAI v1 Compatible (рекомендуется)

```bash
# Генерация изображения
POST /v1/images/generations

# Список моделей
GET /v1/models
```

### Legacy API

```bash
# Генерация изображения
POST /api/images/generations

# Список моделей
GET /api/images/models

# Статус API
GET /api/images/status
```

## Использование с OpenAI SDK

### Node.js / JavaScript

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
    baseURL: 'http://localhost:3000/v1',
    apiKey: 'your-api-key'
});

const image = await openai.images.generate({
    prompt: 'A beautiful sunset over the ocean',
    model: 'dall-e-3',
    size: '1024x1024',
    n: 1
});

console.log(image.data[0].url);
```

**Запуск примера:**
```bash
node examples/image-generation/openai-sdk-example.js
```

### Python

```python
from openai import OpenAI

client = OpenAI(
    base_url='http://localhost:3000/v1',
    api_key='your-api-key'
)

response = client.images.generate(
    prompt='A beautiful sunset over the ocean',
    model='dall-e-3',
    size='1024x1024',
    n=1
)

print(response.data[0].url)
```

**Запуск примера:**
```bash
python examples/image-generation/openai_sdk_example.py
```

## Использование через curl

```bash
curl -X POST http://localhost:3000/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "prompt": "A beautiful sunset over the ocean",
    "model": "dall-e-3",
    "size": "1024x1024",
    "n": 1
  }'
```

## Доступные модели

| OpenAI Model | Qwen Model | Description |
|--------------|------------|-------------|
| `dall-e-3` | `qwen-image-max` | Максимальное качество |
| `dall-e-2` | `qwen-image-plus` | Высокое качество |
| - | `qwen-image` | Стандартное качество |
| - | `wan2.6-t2i` | Wan модель |
| - | `wan2.5-t2i-preview` | Wan preview |
| - | `wan2.2-t2i-flash` | Wan fast |

## Параметры запроса

| Параметр | Тип | Описание |
|----------|-----|----------|
| `prompt` | string | Описание изображения (обязательно) |
| `model` | string | Модель генерации |
| `n` | integer | Количество изображений (по умолчанию: 1) |
| `size` | string | Размер: `1024x1024`, `1024x1792`, `1792x1024` |
| `response_format` | string | Формат ответа: `url` или `b64_json` |
| `quality` | string | Качество: `standard` или `hd` |
| `style` | string | Стиль: `vivid` или `natural` |

## Ответ API

```json
{
  "created": 1234567890,
  "data": [
    {
      "url": "https://example.com/image.png",
      "revised_prompt": "Detailed prompt used for generation"
    }
  ]
}
```

## Настройка

Убедитесь, что в `.env` файле установлены нужные переменные:

### Для DashScope API mode:
```env
IMAGE_GENERATION_MODE=dashscope
DASHSCOPE_API_KEY=your-dashscope-api-key
```

Получить API ключ: https://dashscope.console.aliyun.com/

### Для Browser mode:
```env
IMAGE_GENERATION_MODE=browser
```

Не требует дополнительных настроек - используется та же авторизация, что и для чата.
