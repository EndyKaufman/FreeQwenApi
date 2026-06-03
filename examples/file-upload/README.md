# File Upload Examples

Примеры использования API для работы с файлами и мультимодальными сообщениями.

## Поддерживаемые форматы

### 1. Multipart Form Data (Рекомендуемый)

**Endpoint:** `POST /api/chat/multipart`

Лучший вариант для загрузки реальных файлов с диска.

```javascript
import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';

const formData = new FormData();
formData.append('message', 'Проанализируй эти изображения');
formData.append('model', 'qwen-vl-max');
formData.append('files', fs.createReadStream('image1.jpg'));
formData.append('files', fs.createReadStream('image2.jpg'));

const response = await axios.post('http://localhost:3264/api/chat/multipart', formData, {
    headers: formData.getHeaders()
});

console.log(response.data.choices[0].message.content);
```

**cURL:**
```bash
curl -X POST http://localhost:3264/api/chat/multipart \
  -F "message=Опиши изображения" \
  -F "model=qwen-vl-max" \
  -F "files=@image1.jpg" \
  -F "files=@image2.jpg"
```

**Streaming:**
```javascript
formData.append('stream', 'true');

const response = await axios.post(
    'http://localhost:3264/api/chat/multipart',
    formData,
    { responseType: 'stream' }
);

response.data.on('data', (chunk) => {
    // Process SSE chunks
});
```

### 2. OpenAI-Compatible с Base64

**Endpoint:** `POST /api/chat/completions` или `POST /api/v1/chat/completions`

Идеально для OpenAI SDK совместимости.

```javascript
import fs from 'fs';

const imageBuffer = fs.readFileSync('image.jpg');
const base64Image = imageBuffer.toString('base64');
const dataUrl = `data:image/jpeg;base64,${base64Image}`;

const payload = {
    model: 'qwen-vl-max',
    messages: [
        {
            role: 'user',
            content: [
                { type: 'text', text: 'Что на этом фото?' },
                {
                    type: 'image_url',
                    image_url: { url: dataUrl }
                }
            ]
        }
    ]
};

const response = await axios.post(
    'http://localhost:3264/api/chat/completions',
    payload
);
```

**OpenAI Node.js SDK:**
```javascript
import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({
    baseURL: 'http://localhost:3264/api/v1',
    apiKey: 'your-api-key'
});

const imageBuffer = fs.readFileSync('image.jpg');
const base64Image = imageBuffer.toString('base64');

const response = await openai.chat.completions.create({
    model: 'qwen-vl-max',
    messages: [
        {
            role: 'user',
            content: [
                { type: 'text', text: 'Опиши изображение' },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:image/jpeg;base64,${base64Image}`
                    }
                }
            ]
        }
    ]
});
```

### 3. Custom Files Array

**Endpoint:** `POST /api/chat/completions`

Для передачи URL файлов (уже загруженных в интернет).

```javascript
const payload = {
    model: 'qwen-vl-max',
    messages: [
        {
            role: 'user',
            content: 'Сравни эти изображения',
            files: [
                { url: 'https://example.com/image1.jpg' },
                { url: 'https://example.com/image2.jpg' }
            ]
        }
    ]
};

const response = await axios.post(
    'http://localhost:3264/api/chat/completions',
    payload
);
```

## Как это работает

### Процесс обработки файлов

1. **Клиент отправляет файлы** (multipart, base64, или URLs)
2. **Сервер обрабатывает каждый файл:**
   - Base64 → Сохраняет во временный файл → Загружает в Qwen OSS
   - Локальный файл → Загружает в Qwen OSS
   - HTTP URL → Передает напрямую
3. **Все файлы конвертируются** в формат `{url: 'https://...'}`
4. **Файлы передаются в браузер** через Qwen Chat API
5. **Временные файлы удаляются** автоматически

### Лимиты

- **Максимум файлов:** 5 за запрос
- **Максимальный размер:** 10MB на файл (настраивается в `MAX_FILE_SIZE`)
- **Поддерживаемые форматы:** JPG, PNG, GIF, WebP, BMP, PDF, DOC, DOCX, TXT

## Примеры

### Тестирование всех форматов

```bash
node examples/file-upload/multi-file-example.js
```

### Загрузка одного файла

```bash
node examples/file-upload/upload-example.js
```

## Python пример

```python
import requests
import base64

# Формат 1: Multipart
with open('image.jpg', 'rb') as f:
    files = {'files': f}
    data = {
        'message': 'Опиши изображение',
        'model': 'qwen-vl-max'
    }
    response = requests.post(
        'http://localhost:3264/api/chat/multipart',
        files=files,
        data=data
    )
    print(response.json()['choices'][0]['message']['content'])

# Формат 2: Base64
with open('image.jpg', 'rb') as f:
    base64_image = base64.b64encode(f.read()).decode('utf-8')
    
payload = {
    'model': 'qwen-vl-max',
    'messages': [{
        'role': 'user',
        'content': [
            {'type': 'text', 'text': 'Что на фото?'},
            {
                'type': 'image_url',
                'image_url': {
                    'url': f'data:image/jpeg;base64,{base64_image}'
                }
            }
        ]
    }]
}

response = requests.post(
    'http://localhost:3264/api/chat/completions',
    json=payload
)
print(response.json()['choices'][0]['message']['content'])
```

## Troubleshooting

### Ошибка "Файл не был загружен"
- Проверьте что поле называется `files` (для multipart)
- Убедитесь что файл существует и доступен для чтения

### Ошибка "Некорректные данные о файле"
- Файл слишком большой (>10MB по умолчанию)
- Неподдерживаемый формат файла

### Файлы не появляются в браузере
- Проверьте логи на предмет ошибок загрузки в OSS
- Убедитесь что Qwen API доступен и авторизация работает

## API Reference

### POST /api/chat/multipart

**Content-Type:** `multipart/form-data`

**Fields:**
- `message` (required): Текст сообщения
- `model` (optional): Модель для использования
- `stream` (optional): Включить streaming (`true`/`false`)
- `files[]` (optional): Массив файлов (до 5 штук)

**Response:** OpenAI-compatible format

### POST /api/chat/completions

**Content-Type:** `application/json`

**Body:**
```json
{
  "model": "qwen-vl-max",
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "..."},
        {"type": "image_url", "image_url": {"url": "data:image/... or http://..."}}
      ]
    }
  ]
}
```

**Response:** OpenAI-compatible format
