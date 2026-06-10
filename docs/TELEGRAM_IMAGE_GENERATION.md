# Telegram Bot Image Generation

## Команды для генерации изображений

Бот поддерживает генерацию изображений через Qwen Image API.

### Доступные команды

| Команда | Описание |
|---------|----------|
| `/image <описание>` | Сгенерировать изображение |
| `/imagine <описание>` | Альтернативная команда |
| 📸 **Фото с подписью** | Image-to-Image генерация |

### Примеры использования

#### Text-to-Image (текст в изображение)
```
/image A beautiful sunset over the ocean
/imagine A cute cat sitting on a windowsill
```

#### Image-to-Image (изображение в изображение)
```
1. Отправьте фото в чат
2. Добавьте подпись (caption): "Улучши это" или "Сделай в стиле аниме"
3. Бот обработает фото и создаст новое на основе вашего запроса
```

### Режимы работы

1. **Text-to-Image (T2I)**
   - Отправьте команду `/image <описание>`
   - Бот создаст изображение по текстовому описанию

2. **Image-to-Image (I2I)**
   - Отправьте фото с подписью (caption)
   - Или отправьте фото вместе с командой `/image <описание>`
   - Бот использует ваше фото как основу для генерации

## Как это работает

### Text-to-Image (T2I)

1. **Пользователь отправляет команду:**
   ```
   /image A beautiful sunset
   ```

2. **Бот отправляет подтверждение:**
   ```
   🎨 Генерация изображения...
   
   📝 Запрос: A beautiful sunset
   ⏳ Пожалуйста, подождите...
   ```

3. **Генерация изображения:**
   - Используется текущий режим генерации (`IMAGE_GENERATION_MODE`)
   - DashScope mode: прямой вызов API
   - Browser mode: через Qwen Chat API

4. **Результат:**
   - Изображение отправляется как фото
   - Добавляется информация о модели и времени генерации

### Image-to-Image (I2I)

1. **Пользователь отправляет фото с подписью:**
   ```
   [Фото] + "Сделай в стиле аниме"
   ```

2. **Бот обрабатывает фото:**
   - Скачивает фото из Telegram
   - Конвертирует в формат base64 data URL
   - Передает в API вместе с текстом

3. **Бот отправляет подтверждение:**
   ```
   🎨 Обработка изображения...
   
   📝 Запрос: Сделай в стиле аниме
   📸 Режим: Image-to-Image
   ⏳ Пожалуйста, подождите...
   ```

4. **Генерация изображения:**
   - API использует исходное фото как основу
   - Применяет изменения согласно тексту
   - Создает новое изображение

5. **Результат:**
   - Новое изображение отправляется как фото
   - Добавляется информация о режиме и времени генерации

## Настройка

### 1. Убедитесь, что генерация изображений настроена

Проверьте `.env` файл:

```env
# Для DashScope API mode
IMAGE_GENERATION_MODE=dashscope
DASHSCOPE_API_KEY=your-api-key

# ИЛИ для Browser mode
IMAGE_GENERATION_MODE=browser
```

### 2. Проверьте статус

```
/status
```

Убедитесь, что все системы работают.

## Поддерживаемые модели

Бот использует `qwen-image-plus` по умолчанию.

Доступные модели (в зависимости от режима):
- `qwen-image-max` - максимальное качество
- `qwen-image-plus` - высокое качество (по умолчанию)
- `qwen-image` - стандартное качество
- `wan2.6-t2i` - Wan модель
- `wan2.5-t2i-preview` - Wan preview
- `wan2.2-t2i-flash` - Wan fast

## Ограничения

- **Размер изображения:** 1024x1024 (по умолчанию)
- **Время генерации:** 5-30 секунд (зависит от режима)
- **Длина описания:** до 1000 символов
- **Подпись к фото:** до 1024 символов (ограничение Telegram)

## Troubleshooting

### "Ошибка генерации изображения"

**Причина:** API недоступен или неверная конфигурация

**Решение:**
1. Проверьте `/status`
2. Убедитесь, что `IMAGE_GENERATION_MODE` установлен
3. Для DashScope mode: проверьте `DASHSCOPE_API_KEY`
4. Для Browser mode: убедитесь, что браузер авторизован

### "Не удалось отправить изображение как фото"

**Причина:** URL изображения недоступен для Telegram

**Решение:**
- Бот автоматически отправит ссылку на изображение
- Проверьте интернет-соединение
- Попробуйте другой запрос

### Долгая генерация

**Причина:** Browser mode медленнее или высокая нагрузка

**Решение:**
1. Переключитесь на DashScope mode (быстрее)
2. Подождите 30-60 секунд
3. Попробуйте более простой запрос

## Советы для лучших результатов

### 1. Будьте конкретны

❌ `image cat`  
✅ `/image A fluffy orange cat sitting on a sunny windowsill`

### 2. Используйте английский язык

❌ `/image красивый закат`  
✅ `/image A beautiful dramatic sunset over the ocean`

### 3. Добавляйте детали

```
/image A majestic eagle soaring over snow-capped mountains at golden hour, 
photorealistic, dramatic lighting, 4K quality
```

### 4. Указывайте стиль

```
/image A cyberpunk city at night, neon lights, futuristic buildings, 
digital art, cinematic composition
```

```
/image A watercolor painting of a peaceful Japanese garden with cherry blossoms
```

## Интеграция с другими командами

### Проверка статуса генерации

```
/status
```

Показывает текущий режим генерации изображений.

### Помощь

```
/help
```

Показывает все доступные команды, включая генерацию изображений.

## Примеры промптов

### Пейзажи
```
/image A breathtaking aerial view of a tropical island with crystal clear turquoise waters
```

### Портреты
```
/image A portrait of a wise old wizard with a long white beard, fantasy art style
```

### Архитектура
```
/image A futuristic skyscraper made of glass and steel, flying cars around it
```

### Животные
```
/image A red panda playing in autumn leaves, photorealistic, shallow depth of field
```

### Абстрактное искусство
```
/image An abstract composition of flowing geometric shapes in vibrant colors
```

### Фэнтези
```
/image A magical forest with glowing mushrooms and fireflies at twilight
```

## API Endpoint

Команда использует тот же endpoint, что и OpenAI SDK:

```
POST /v1/images/generations
```

Это означает, что генерация через Telegram полностью совместима с другими способами использования API.
