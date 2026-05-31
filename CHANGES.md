# Что нового - FreeQwenApi v1.0.3

## 🎉 Версия 1.0.3 - Major Update

Дата: Май 2026

---

## ✨ Новые функции

### 1. 🤖 Telegram Bot - Полная интеграция

#### LLM Chat (AI Ассистент)
- **Команда `/chat`** - Включить/выключить режим AI ассистента
- **Контекст диалога** - Помнит последние 20 сообщений
- **Многоязычность** - Отвечает на языке пользователя
- **Модели** - Использует все доступные Qwen модели

**Пример использования:**
```
User: /chat
Bot: ✅ LLM чат включен!

User: Привет! Как дела?
Bot: Привет! У меня всё отлично, спасибо! 😊
     Я готов помочь вам с вопросами.
```

**Команды LLM чата:**
| Команда | Описание |
|---------|----------|
| `/chat` | Включить/выключить LLM чат |
| `/clear` | Очистить контекст диалога |
| `/model` | Информация о текущей модели |

📖 **Документация:** [docs/TELEGRAM_LLM_CHAT.md](docs/TELEGRAM_LLM_CHAT.md)

---

### 2. 🔐 Прокси для Telegram API

Поддержка HTTP/HTTPS/SOCKS прокси для работы с Telegram в регионах с блокировками.

**Настройка:**
```bash
# .env файл
TELEGRAM_PROXY=http://user:pass@proxy.example.com:8080
# или
TELEGRAM_PROXY=socks5://user:pass@proxy.example.com:1080
```

**Поддерживаемые протоколы:**
- ✅ HTTP
- ✅ HTTPS  
- ✅ SOCKS4
- ✅ SOCKS5
- ✅ С аутентификацией

**Важно:** Прокси URL не логируется в целях безопасности!

📖 **Документация:** [docs/TELEGRAM_PROXY.md](docs/TELEGRAM_PROXY.md)

---

### 3. 📦 Автоматическая распаковка архивов при старте

При запуске сервис автоматически проверяет наличие ожидающих архивов сессий и распаковывает их.

**Как это работает:**
1. Пользователь отправляет ZIP/7z архив через Telegram бота
2. Архив сохраняется в `session/pending_archive`
3. При следующем запуске архив автоматически распаковывается
4. Сервис перезапускается с новыми сессиями

**Преимущества:**
- ✅ Не нужно ждать пока бот обработает архив
- ✅ Мгновенное применение новых сессий при перезапуске
- ✅ Безопасный backup старых сессий

---

### 4. 🔍 Система проверки здоровья

#### Проверка при запуске
Автоматическая проверка всех подсистем:
- ✅ Telegram бот
- ✅ Qwen API доступность
- ✅ Токены и сессии
- ✅ Браузер

#### Периодические проверки (каждые 4 часа)
- Автоматическая отправка статуса в Telegram
- Проверка работоспособности всех аккаунтов
- Предупреждения об истекающих токенах

**Пример отчёта:**
```
📊 Статус системы
━━━━━━━━━━━━━━━━━━━━
🤖 Telegram: ✅ Работает
🌐 Qwen API: ✅ Доступен
👥 Аккаунты: 3 активных
⏰ Токены: В норме
📝 Модель: qwen-max-latest
━━━━━━━━━━━━━━━━━━━━
✅ Все системы работают нормально
```

---

### 5. 🔄 Graceful режим без токенов

Теперь сервис может работать **только как Telegram бот** даже без сессий Qwen.

**Раньше:**
```
❌ Не найдено ни одного аккаунта.
   Завершение работы.
```

**Теперь:**
```
⚠️ Не найдено ни одного аккаунта.
   Сервер работает в режиме Telegram бота.
📦 Отправьте архив с сессиями через Telegram бота.
```

**Преимущества:**
- ✅ Можно добавить первый аккаунт через Telegram
- ✅ Сервис не падает без токенов
- ✅ Удобно для первоначальной настройки

---

### 6. 🔒 Улучшенная безопасность логов

**Изменения:**
- ❌ Больше не логируются URL прокси (могут содержать credentials)
- ❌ Не логируются токены и пароли
- ✅ Логируются только безопасные ID
- ✅ Ошибки без чувствительных данных

**Примеры безопасных логов:**
```
✅ Было: 🔧 Прокси настроен: http://user:pass@proxy:8080
✅ Стало: 🔧 Прокси настроен

✅ Было: Использован токен: eyJhbGciOiJIUz...
✅ Стало: Использован токен: acc_1234567890
```

📖 **Аудит безопасности:** [docs/SECURITY_AUDIT_LOGS.md](docs/SECURITY_AUDIT_LOGS.md)

---

### 7. 📁 Автоматическая загрузка .env

**Для локальной разработки:**
```bash
node index.js
# ✅ .env файл загружен
```

**Как работает:**
- Используется пакет `dotenv`
- Загружается перед всеми другими импортами
- Показывает подтверждение при старте
- Fallback на переменные окружения если .env нет

**Docker Compose:**
- Работает через `env_file` directive
- Без изменений (уже работало)

📖 **Руководство:** [docs/ENV_SETUP.md](docs/ENV_SETUP.md)

---

## 🐛 Исправления ошибок

### 1. Бесконечный цикл перезапусков
**Проблема:** При ошибке распаковки архива сервис перезапускался бесконечно

**Решение:**
- ✅ Graceful обработка ошибок
- ✅ Backup перед изменениями
- ✅ Abort при критических ошибках

### 2. Ошибка прав доступа к скрипту запуска
**Проблема:** `[dumb-init] ./start-with-restart.sh: Permission denied`

**Решение:**
- ✅ Добавлен `chmod +x` в Dockerfile
- ✅ Исправлен `.dockerignore`
- ✅ Используется `dos2unix` для CRLF

### 3. Ошибка сети "fetch failed"
**Проблема:** Неинформативные ошибки подключения к Telegram

**Решение:**
- ✅ Детекция типа ошибки (DNS, timeout, connection refused)
- ✅ Понятные сообщения с рекомендациями
- ✅ Проверка доступности прокси

📖 **Troubleshooting:** [docs/TELEGRAM_TROUBLESHOOTING.md](docs/TELEGRAM_TROUBLESHOOTING.md)

---

## 🔧 Технические улучшения

### 1. Зависимости
**Добавлено:**
- `dotenv` ^16.6.1 - Загрузка .env файлов
- `proxy-agent` ^6.5.0 - Прокси для fetch
- `undici` ^8.2.0 - Modern HTTP client

**Обновлено:**
- Все зависимости до последних версий

### 2. Docker оптимизация
- Alpine Linux base (уменьшение размера на 60-70%)
- Multi-stage build cleanup
- p7zip для .7z архивов
- dos2unix для кроссплатформенности

### 3. Код
- Улучшена обработка ошибок
- Better error messages
- Fail-safe extraction logic
- Proxy support для всех Telegram API calls

---

## 📚 Новая документация

| Файл | Описание | Строк |
|------|----------|-------|
| [docs/TELEGRAM_LLM_CHAT.md](docs/TELEGRAM_LLM_CHAT.md) | LLM чат через Telegram | 441 |
| [docs/TELEGRAM_PROXY.md](docs/TELEGRAM_PROXY.md) | Настройка прокси | 245 |
| [docs/TELEGRAM_TROUBLESHOOTING.md](docs/TELEGRAM_TROUBLESHOOTING.md) | Решение проблем | 328 |
| [docs/SECURITY_AUDIT_LOGS.md](docs/SECURITY_AUDIT_LOGS.md) | Аудит безопасности | 256 |
| [docs/ENV_SETUP.md](docs/ENV_SETUP.md) | Настройка окружения | 328 |
| [TELEGRAM_LLM_CHAT_RU.md](TELEGRAM_LLM_CHAT_RU.md) | LLM чат (русский) | 343 |

**Всего новой документации:** ~2000 строк!

---

## 📊 Сравнение версий

| Функция | v1.0.0 | v1.0.3 |
|---------|--------|--------|
| Telegram бот | ❌ | ✅ Полная интеграция |
| LLM чат | ❌ | ✅ AI ассистент |
| Прокси | ❌ | ✅ HTTP/HTTPS/SOCKS |
| Автозагрузка .env | ❌ | ✅ dotenv |
| Проверка здоровья | ❌ | ✅ При старте + каждые 4ч |
| Безопасность логов | Базовая | ✅ Полный аудит |
| Работа без токенов | ❌ | ✅ Режим бота |
| Авто-распаковка | ❌ | ✅ При старте |
| Документация | Базовая | ✅ ~2000 строк |

---

## 🚀 Миграция с v1.0.0

### 1. Обновите код
```bash
git pull
npm install
```

### 2. Добавьте новые переменные в .env
```bash
# Обязательные
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_USER_IDS=your_user_id

# Опциональные
TELEGRAM_PROXY=http://proxy:port
DEFAULT_MODEL=qwen-max-latest
```

### 3. Пересоберите Docker
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

### 4. Проверьте работу
```bash
# Логи
docker-compose logs -f

# Проверьте Telegram бота
# Отправьте /help в Telegram
```

---

## 🎯 Что дальше?

### Planned for v1.0.4:
- [ ] Генерация изображений через Telegram
- [ ] Голосовые сообщения
- [ ] Streaming ответов в Telegram
- [ ] Веб-интерфейс управления
- [ ] База данных для статистики

---

## 📝 Полный changelog

### v1.0.3 (Май 2026)
- ✅ Telegram LLM Chat integration
- ✅ Proxy support для Telegram API
- ✅ Automatic .env loading
- ✅ Health check system
- ✅ Graceful tokenless mode
- ✅ Secure logging (no credentials)
- ✅ Auto-extraction on startup
- ✅ Periodic health reports (4h)
- ✅ Better error handling
- ✅ ~2000 lines of documentation
- ✅ Docker optimization (60-70% smaller)
- ✅ Fixed restart loop bug
- ✅ Fixed script permissions
- ✅ Network error diagnostics

### v1.0.0 (Initial Release)
- ✅ Basic Qwen API proxy
- ✅ OpenAI compatibility
- ✅ Multiple account support
- ✅ File upload
- ✅ Image analysis
- ✅ Streaming support
- ✅ Docker support

---

## 🙏 Благодарности

- **Оригинальный проект:** https://github.com/y13sint/FreeQwenApi
- **Qwen API:** https://chat.qwen.ai
- **Сообщество:** Все кто тестировал и предлагал улучшения

---

## 📞 Поддержка

- **Issues:** https://github.com/EndyKaufman/FreeQwenApi/issues
- **Documentation:** docs/ folder
- **Examples:** examples/ folder

---

**Happy coding! 🎉**
