# FreeQwenApi

[![npm version](https://badge.fury.io/js/qwen-api-proxy.svg)](https://badge.fury.io/js/qwen-api-proxy)
[![npm downloads](https://img.shields.io/npm/dm/qwen-api-proxy.svg)](https://www.npmjs.com/package/qwen-api-proxy)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

> **📦 npm:** `npx qwen-api-proxy` или `npm install -g qwen-api-proxy`  
> **🐳 Docker Hub:** https://hub.docker.com/r/endykaufman/qwen-api-proxy  
> **🔧 Форк:** https://github.com/EndyKaufman/FreeQwenApi  
> **🌐 Оригинал:** https://github.com/y13sint/FreeQwenApi

## 🌟 О этом форке

Это **улучшенная версия** оригинального проекта FreeQwenApi со значительными улучшениями для production использования и лучшего пользовательского опыта.


<table>
  <tr>
    <td><img src="docs/images/stats.png" alt="информация о подсистемах" width="100%"/></td>
    <td><img src="docs/images/help.png" alt="справка" width="100%"/></td>
    <td><img src="docs/images/chat.png" alt="режим чата" width="100%"/></td>
  </tr>
</table>

### ⭐ Ключевые отличия от оригинала

| Функция | Оригинал | Этот форк |
|---------|----------|-----------|
| **Telegram бот** | ❌ Нет | ✅ Полная интеграция + генерация изображений |
| **LLM чат** | ❌ Нет | ✅ AI ассистент через Telegram |
| **Генерация изображений** | ❌ Нет | ✅ Text-to-image + image-to-image |
| **Проксирование LLM** | ❌ Нет | ✅ Qwen API через Telegram |
| **Управление сессиями** | Только вручную | ✅ Загрузка через Telegram (.zip/.7z) |
| **Прокси поддержка** | ❌ Нет для Telegram | ✅ HTTP/HTTPS/SOCKS |
| **Проверка здоровья** | ❌ Нет | ✅ При старте + каждые 4 часа |
| **Проверка прав доступа** | ❌ Нет | ✅ Автоматическая при старте |
| **Система логов** | Базовая консоль | ✅ Winston с ротацией |
| **Распаковка архивов** | Вручную | ✅ Автоматически с backup |
| **Обработка ошибок** | Базовая | ✅ Fault-tolerant extraction |
| **Работа без токенов** | ❌ Нет | ✅ Режим только бота |
| **Документация** | Базовая | ✅ ~2000 строк руководств |
| **Docker поддержка** | Базовая | ✅ Production-оптимизация |
| **Автоматическая .env** | ❌ Нет | ✅ dotenv integration |

### 🚀 Новые функции в этом форке

1. **Интеграция Telegram бота**
   - Загрузка архивов сессий напрямую через Telegram
   - Мониторинг статуса сервиса в реальном времени
   - Чат с AI ассистентом (LLM режим)
   - Генерация изображений через Telegram (photo-to-photo + текст)
   - Автоматический backup сессий перед обновлениями
   - Graceful перезапуски сервиса
   - Проксирование запросов к Qwen LLM через бота
   - Команды: `/help`, `/status`, `/chat`, `/model`, `/clear`, `/restart`

2. **Повышенная надёжность**
   - Автоматическая распаковка архивов при запуске
   - Fault-tolerant извлечение файлов (продолжает при ошибках)
   - Комплексные проверки здоровья при запуске
   - Периодические проверки каждые 4 часа
   - Отчёты о статусе системы в Telegram
   - Умная обработка rate limits (отдельно для чата и медиа)
   - **Автоматическая проверка прав доступа** при старте с командами для исправления

3. **Улучшенная безопасность**
   - Безопасная обработка credentials (никогда не логируются)
   - Прокси поддержка для Telegram API (HTTP/HTTPS/SOCKS)
   - Контроль доступа по whitelist
   - Безопасное управление правами файлов
   - Автоматическая загрузка .env
   - Multipart file upload с валидацией

4. **Гибкость работы**
   - Работает как Telegram бот даже без токенов Qwen
   - Добавление первого аккаунта через Telegram
   - Поддержка множества прокси протоколов
   - Конфигурация через .env файл
   - Динамический выбор модели без перезапуска

---

### 📚 Руководство

- **Бесплатный доступ**: Используйте модели Qwen без оплаты API-ключа
- **Полная совместимость**: Поддержка OpenAI-совместимого интерфейса для простой интеграции
- **Возможность загрузки файлов и получение ссылки прямо из прокси**
- **🆕 API v2**: Обновлено на новый Qwen API с улучшенной системой контекста
- **🔥 25+ моделей**: Поддержка всех современных моделей Qwen, включая Qwen 3.5
- **🎨 Генерация изображений**: Text-to-image + Image-to-image через Qwen + DashScope API
- **📸 Multipart Upload**: Загрузка файлов напрямую через API
- **💾 Автосохранение сессий**: Умное управление контекстом для OpenWebUI
- **🔄 Rate Limit Intelligence**: Отдельные лимиты для чата и генерации медиа

**Что можно делать:**

- Отправлять запросы к моделям Qwen (включая qwen3-max, qwen3-coder-plus, qwq-32b и др.)
- Использовать OpenAI SDK без изменений -- просто поменяйте `baseURL`
- Вести диалоги с сохранением контекста на серверах Qwen (API v2)
- Загружать файлы и изображения для анализа
- Получать ответы в потоковом режиме (SSE streaming)
- Подключать несколько аккаунтов с автоматической ротацией

```bash
# Всё, что нужно -- обычный OpenAI-совместимый запрос
# Модель будет взята из настроек бота (bot_settings.json)
curl http://localhost:3264/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Привет!"}]}'
```

---

## Содержание

1. [Быстрый старт](#быстрый-старт)
2. [CLI команды](#-cli-команды) 🆕
3. [Docker Hub](#docker-hub) 🆕
4. [Docker](#docker)
5. [Управление аккаунтами](#управление-аккаунтами)
6. [Авторизация API-ключами](#авторизация-api-ключами)
7. [API Reference](#api-reference)
   - [POST /api/chat](#post-apichat)
   - [POST /api/chat/completions](#post-apichatcompletions)
   - [GET /api/models](#get-apimodels)
   - [GET /api/status](#get-apistatus)
   - [POST /api/chats](#post-apichats)
   - [POST /api/files/upload](#post-apifilesupload)
   - [POST /api/files/getstsToken](#post-apifilesgetststoken)
   - [POST /api/images/generations](#post-apiimagesgenerations)
8. [Работа с контекстом (API v2)](#работа-с-контекстом-api-v2)
9. [Работа с изображениями](#работа-с-изображениями)
10. [Генерация изображений](#генерация-изображений) 🆕
11. [OpenAI SDK](#openai-sdk)
12. [Python](#python-альтернативная-реализация)
13. [Доступные модели](#доступные-модели)
14. [Переменные окружения](#переменные-окружения)
15. [Структура проекта](#структура-проекта)

---

## Быстрый старт

> 🆕 **Новые пользователи?** Начните с [QUICK_START.md](QUICK_START.md) - пошаговое руководство с устранением常见ных ошибок

### 🌍 Кросс-платформенная поддержка

Этот проект полностью поддерживает работу на:
- ✅ **Windows** (10/11, Server 2019+)
- ✅ **Linux** (Ubuntu 18.04+, Debian 10+, CentOS 8+)
- ✅ **macOS** (10.15+, включая Apple Silicon)

**Требования:**
- Node.js >= 18.0.0 (рекомендуется 20.x или 22.x LTS)
- Для команды `archive`: `zip` (Linux/macOS) или `zip`/`7-Zip`/PowerShell (Windows)

> 📖 **Полное руководство:** [CROSS_PLATFORM.md](CROSS_PLATFORM.md)

### 📦 Через npm (Рекомендуется)

**Без установки (npx):**
```bash
# Инициализация директории
npx qwen-api-proxy init

# Запуск сервера
npx qwen-api-proxy
```

**Глобальная установка:**
```bash
npm install -g qwen-api-proxy

# Инициализация
qwen-api-proxy init

# Запуск сервера
qwen-api-proxy
```

> 💡 **Подробнее:** [README_NPM.md](README_NPM.md) - полное руководство по npm пакету

### 💻 Ручная установка

```bash
# Node.js (Основной)
git clone https://github.com/y13sint/FreeQwenApi
cd FreeQwenApi
npm install
npm start

# Python (Альтернативный)
git clone https://github.com/y13sint/FreeQwenApi
cd FreeQwenApi
python -m venv venv
# Windows:
# venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
python main.py
```

При первом запуске появится интерактивное меню:

```
███████ ██████  ███████ ███████  ██████  ██     ██ ███████ ███    ██  █████  ██████  ██
██      ██   ██ ██      ██      ██    ██ ██     ██ ██      ████   ██ ██   ██ ██   ██ ██
█████   ██████  █████   █████   ██    ██ ██  █  ██ █████   ██ ██  ██ ███████ ██████  ██
██      ██   ██ ██      ██      ██ ▄▄ ██ ██ ███ ██ ██      ██  ██ ██ ██   ██ ██      ██
██      ██   ██ ███████ ███████  ██████   ███ ███  ███████ ██   ████ ██   ██ ██      ██

Список аккаунтов:
  (пусто)

=== Меню ===
1 - Добавить новый аккаунт
2 - Перелогинить аккаунт с истекшим токеном
3 - Запустить прокси (по умолчанию)
4 - Удалить аккаунт
Ваш выбор (Enter = 3):
```

**Порядок действий:**

1. Выберите `1` -- откроется браузер Chromium
2. Войдите в свой аккаунт Qwen на открывшейся странице
3. После входа токен извлечётся автоматически, браузер закроется
4. Выберите `3` (или нажмите Enter) -- сервер запустится

Сервер будет доступен по адресу `http://localhost:3264/api`.

---

## 🛠️ CLI команды

Все команды можно запускать через `npx` (без установки) или после глобальной установки:

```bash
# Без установки (рекомендуется для редкого использования)
npx qwen-api-proxy <command>

# После глобальной установки (для частого использования)
qwen-api-proxy <command>
```

### Основные команды

| Команда | Описание |
|---------|----------|
| `npx qwen-api-proxy` | Запуск сервера |
| `npx qwen-api-proxy init` | Инициализация директории (без запуска) |
| `npx qwen-api-proxy archive` | Создание архива сессии |
| `npx qwen-api-proxy extend` | Продление сессий |
| `npx qwen-api-proxy doctor` | Проверка здоровья системы |

### Примеры использования

```bash
# Инициализация проекта
npx qwen-api-proxy init

# Создание архива сессии для backup
npx qwen-api-proxy archive

# Продление всех сессий
npx qwen-api-proxy extend

# Продление конкретного аккаунта
npx qwen-api-proxy extend --account-id acc_1234567890

# Проверка здоровья системы
npx qwen-api-proxy doctor

# С пользовательской директорией
npx qwen-api-proxy archive --dir=/path/to/project
```

### 🔧 NPM Scripts (для разработчиков)

```bash
npm start                 # Запуск сервера
npm run archive           # Создание архива
npm run auth              # Добавить аккаунт
npm run rebuild-tokens    # Перестроить tokens.json
npm run check-sessions    # Проверить сессии
```

---

## Docker Hub

Готовый Docker образ доступен на Docker Hub:

**🐳 https://hub.docker.com/r/endykaufman/qwen-api-proxy**

### Быстрый запуск с Docker Hub

```bash
# 1. Создаём .env файл
cp .env.example .env
nano .env  # Настраиваем переменные

# 2. Запускаем контейнер
docker run -d \
  --name qwen-proxy \
  --env-file .env \
  -p 3264:3264 \
  -v $(pwd)/session:/app/session \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/temp:/app/temp \
  endykaufman/qwen-api-proxy:1.0.13

# 3. Смотрим логи
docker logs -f qwen-proxy
```

### Доступные теги

- `latest` - последняя стабильная версия
- `1.0.13` - текущая версия
- `1.0.x` - предыдущие версии

> **💡 Важно:** Перед первым запуском добавьте аккаунт через `npm run auth` или загрузите сессию через Telegram бота.

### 📖 Что такое Docker Compose?

**Docker Compose** - это инструмент для запуска многоконтейнерных приложений через файл `docker-compose.yml`.

**Установка:**
- **Windows/macOS**: Входит в Docker Desktop (установлен по умолчанию)
- **Linux**: `sudo apt install docker-compose-plugin`
- **Проверка**: `docker compose version`

> 💡 Если у вас установлен Docker Desktop - Compose уже есть!

### Docker Compose с готовым образом

```yaml
services:
  qwen-proxy:
    image: endykaufman/qwen-api-proxy:1.0.13
    container_name: qwen-proxy
    env_file:
      - .env
    ports:
      - "${PORT:-3264}:3264"
    volumes:
      - ./session:/app/session
      - ./logs:/app/logs
      - ./uploads:/app/uploads
      - ./temp:/app/temp
    restart: unless-stopped
```

---

## Docker

Перед сборкой Docker-образа нужно добавить хотя бы один аккаунт, поскольку внутри контейнера нет GUI для интерактивного входа:

```bash
# 1. Добавляем аккаунт(ы) локально
npm run auth

# 2. Создаём .env файл
cp .env.example .env
nano .env  # Редактируем переменные

# 3. Собираем и запускаем

# Вариант A: С Docker Compose
docker compose build --no-cache
docker compose up -d

# Вариант B: Без Docker Compose (обычный Docker)
docker build -t qwen-proxy .
docker run -d \
  --name qwen-proxy \
  --env-file .env \
  -p 3264:3264 \
  -v $(pwd)/session:/app/session \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/temp:/app/temp \
  qwen-proxy

# ИЛИ используем готовый образ с Docker Hub
docker run -d \
  --name qwen-proxy \
  --env-file .env \
  -p 3264:3264 \
  -v $(pwd)/session:/app/session \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/temp:/app/temp \
  endykaufman/qwen-api-proxy:1.0.13
```

Файл `docker-compose.yml`:

```yaml
services:
  qwen-proxy:
    build: .
    image: endykaufman/qwen-api-proxy:1.0.13
    container_name: qwen-proxy
    env_file:
      - .env  # Автоматическая загрузка переменных
    environment:
      - NODE_ENV=production
      - PORT=${PORT:-3264}
      - HOST=0.0.0.0
      - SKIP_ACCOUNT_MENU=true
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
      - TELEGRAM_USER_IDS=${TELEGRAM_USER_IDS:-}
      - TELEGRAM_PROXY=${TELEGRAM_PROXY:-}
      - TELEGRAM_PROXY_URL=${TELEGRAM_PROXY_URL:-}
      - TOKEN_EXPIRY_WARNING_MS=${TOKEN_EXPIRY_WARNING_MS:-3600000}
      - DEFAULT_MODEL=${DEFAULT_MODEL:-qwen3.5-plus}
    ports:
      - "${PORT:-3264}:3264"
    volumes:
      - ./session:/app/session
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    restart: unless-stopped
```

Переменная `SKIP_ACCOUNT_MENU=true` (или `NON_INTERACTIVE=true`) пропускает интерактивное меню и сразу запускает сервер, используя ранее сохранённые токены из `session/`.


### Тома Docker и структура директорий

Проект использует следующие тома для сохранения данных между перезапусками:

```yaml
volumes:
  - ./session_backup:/app/session_backup  # Backup сессий перед обновлениями
  - ./session:/app/session                # Токены и аккаунты Qwen
  - ./logs:/app/logs                      # Файлы логов (Winston)
  - ./uploads:/app/uploads                # Временные загруженные файлы
  - ./temp:/app/temp                      # Временная папка для распаковки архивов
```

#### Зачем нужны `.gitkeep` и `.gitignore`?

Каждая из этих директорий содержит `.gitkeep` файл по важным причинам:

**1. Сохранение пустых директорий в Git**
- Git не отслеживает пустые папки
- `.gitkeep` гарантирует, что директории существуют после клонирования репозитория
- Без этого Docker не сможет монтировать несуществующие тома

**2. Игнорирование содержимого в Git**
Каждая директория также имеет `.gitignore` для игнорирования содержимого:

```gitignore
# session/.gitignore
*
!.gitkeep
!.gitignore

# logs/.gitignore
*.log
!.gitkeep
!.gitignore

# uploads/.gitignore
*
!.gitkeep
!.gitignore

# temp/.gitignore
*
!.gitkeep
!.gitignore

# session_backup/.gitignore
*
!.gitkeep
!.gitignore
```

**Почему это важно:**
- ✅ Токены и сессии не попадают в репозиторий (безопасность!)
- ✅ Логи не раздувают размер репозитория
- ✅ Временные файлы не коммитятся
- ✅ Backup'ы остаются локальными
- ✅ При клонировании все папки создаются автоматически

**3. Автоматическое создание при первом запуске**

При первом запуске приложение создаёт необходимые структуры:

```bash
# Структура session/
session/
├── .gitkeep
├── .gitignore
├── accounts/           # Создаётся автоматически
│   ├── acc_123456/
│   │   └── token.txt
│   └── acc_789012/
│       └── token.txt
└── tokens.json         # Реестр всех аккаунтов

# Структура logs/
logs/
├── .gitkeep
├── .gitignore
├── combined.log        # Создаётся Winston
├── error.log
└── http.log
```

**4. Docker и права доступа**

При использовании Docker важно:
- Том создаётся на хост-машине (не в контейнере)
- Файлы сохраняются между перезапусками контейнера
- При удалении контейнера данные остаются на хосте
- Можно делать backup копированием папок

```bash
# Backup всех данных
cp -r session/ session_backup_$(date +%Y%m%d)/
cp -r logs/ logs_backup_$(date +%Y%m%d)/

# Восстановление
cp -r session_backup_20260510/ session/
```

**5. Автоматическая проверка прав доступа**

При запуске сервер автоматически проверяет права доступа ко всем директориям и файлам:

```bash
# При запуске
npm start

# Вывод:
# 🔍 Проверка прав доступа к директориям и файлам...
# ✅ Все директории и файлы доступны для записи
```

Если обнаружены проблемы:

```bash
# ❌ Обнаружены проблемы с правами доступа (3):
# 📁 session/accounts (directory)
#    Ошибка: EACCES: permission denied
#    Решение:
#    sudo chown -R $USER:$USER /path/to/session/accounts
#    sudo chmod -R 755 /path/to/session/accounts
#
# 🔧 Быстрое решение:
# sudo chown -R $USER:$USER session uploads logs temp session_backup
# sudo chmod -R 755 session uploads logs temp session_backup
```

**Ручная проверка и исправление:**

```bash
# Проверить права
npm run check-permissions

# Автоматически исправить все проблемы
npm run fix-permissions

# Или вручную
bash fix-permissions.sh
```

📖 **Полная документация:** [PERMISSION_CHECKING.md](PERMISSION_CHECKING.md)

---

## Управление аккаунтами

### Интерактивное меню

При запуске `npm start` без флага `SKIP_ACCOUNT_MENU` отображается меню с 4 пунктами:

| Пункт | Действие |
|-------|----------|
| 1 | Добавить новый аккаунт -- откроется браузер для входа |
| 2 | Перелогинить аккаунт -- обновить токен для аккаунта с истёкшей сессией |
| 3 | Запустить прокси -- стандартный запуск (по умолчанию) |
| 4 | Удалить аккаунт -- удалить сохранённый аккаунт |

### Статусы аккаунтов

| Статус | Значение |
|--------|----------|
| OK | Аккаунт активен, токен валиден |
| WAIT | Rate limit -- ожидание сброса (автоматический таймер на 24ч) |
| INVALID | Токен истёк или отозван -- требуется перелогин |

### Ротация аккаунтов

Если подключено несколько аккаунтов, сервер автоматически:
- Выбирает следующий активный аккаунт (round-robin)
- При получении HTTP 429 (rate limit) помечает аккаунт как WAIT и переключается на следующий
- При получении HTTP 401 (unauthorized) помечает аккаунт как INVALID и переключается на следующий

### Отдельный CLI для авторизации

```bash
npm run auth
```

Запускает скрипт авторизации без запуска сервера -- удобно для Docker-окружения, когда нужно добавить аккаунты перед сборкой.

### Файлы аккаунтов

```
session/
├── tokens.json          # Реестр всех аккаунтов и их статусов
└── accounts/
    ├── acc_1234567890/
    │   └── token.txt    # Токен аккаунта
    └── acc_9876543210/
        └── token.txt
```

---

## Авторизация API-ключами

По умолчанию авторизация отключена -- API доступен всем. Для включения добавьте ключи в файл `src/Authorization.txt`:

```
# Один ключ на строку
d35ab3e1-a6f9-4d00-b1c2-example-key1
f2b1cd9c-1b2e-4a99-8c3d-example-key2
```

После этого каждый запрос к API должен содержать заголовок:

```
Authorization: Bearer d35ab3e1-a6f9-4d00-b1c2-example-key1
```

Пустые строки и строки, начинающиеся с `#`, игнорируются. Если файл пуст или содержит только комментарии -- авторизация отключена.

---

## Доступные модели

Прокси поддерживает **25+ моделей Qwen** через систему маппинга:

### Стандартные модели
- `qwen-max` / `qwen-max-latest` — наиболее мощная модель
- `qwen-plus` / `qwen-plus-latest` — сбалансированная модель
- `qwen-turbo` / `qwen-turbo-latest` — быстрая и лёгкая модель

### Модели Qwen 3.5 ✨
- `qwen3.5-plus` / `qwen3.5-plus-latest` — улучшенная версия Plus
- `qwen3.5-flash` / `qwen3.5-flash-latest` — быстрая модель Qwen 3.5
- `qwen3.5-397b-a17b` — сверхбольшая модель (397B параметров)
- `qwen3.5-122b-a10b` — большая модель (122B параметров)
- `qwen3.5-27b` — средняя модель (27B параметров)
- `qwen3.5-35b-a3b` — компактная модель (35B параметров)

### Модели Qwen 3
- `qwen3` — базовая модель Qwen 3
- `qwen3-max` — максимальная модель Qwen 3
- `qwen3-plus` — сбалансированная модель Qwen 3
- `qwen3-omni-flash` — быстрая мультимодальная модель

### Модели для кодинга
- `qwen3-coder-plus` — модель для программирования
- `qwen2.5-coder-32b-instruct` — кодирование (32B)
- `qwen2.5-coder-7b-instruct` — кодирование (7B)
- `qwen2.5-coder-3b-instruct` — кодирование (3B)
- `qwen2.5-coder-1.5b-instruct` — кодирование (1.5B)
- `qwen2.5-coder-0.5b-instruct` — кодирование (0.5B)

### Визуальные модели
- `qwen-vl-max` / `qwen-vl-max-latest` — максимальная визуальная модель
- `qwen-vl-plus` / `qwen-vl-plus-latest` — сбалансированная визуальная модель
- `qwen2.5-vl-32b-instruct` — визуальная модель (32B)
- `qwen2.5-vl-7b-instruct` — визуальная модель (7B)

### Другие модели
- `qvq-72b-preview-0310` — предпросмотр QVQ (72B)
- `qwen2.5-14b-instruct-1m` — контекст 1M токенов
- `qwen2.5-72b-instruct` — большая языковая модель (72B)

> **Система маппинга:** Прокси автоматически распознаёт алиасы моделей (например, `Qwen3.5-Plus`, `qwen3.5-flash-latest` → соответствующие канонические модели).

### Система алиасов

Запрашивать модели можно по любому из поддерживаемых имён -- сервер автоматически подставит каноническое:

| Вы запрашиваете | Используется |
|-----------------|-------------|
| `qwen-max` | `qwen3-max` |
| `qwen-vl-plus` | `qwen3-vl-plus` |
| `qwen3-coder` | `qwen3-coder-plus` |
| `qwq` | `qwq-32b` |
| `qwen-turbo` | `qwen-turbo-2025-02-11` |
| `qwen2.5-max` | `qwen-max-latest` |
| `qwen2.5-plus` | `qwen-plus-2025-01-25` |
| `qvq` | `qvq-72b-preview-0310` |
| `qwen3` | `qwen3-235b-a22b` |
| `qwen-plus` | `qwen-plus-2025-09-11` |

> Если запрошенная модель не найдена ни в списке, ни среди алиасов -- используется активная модель из настроек бота (приоритет: `bot_settings.json` → `.env` → первая модель из `AvailableModels.txt`).

### 🎯 Система выбора модели

Проект использует **динамическую систему выбора модели** с централизованным управлением через настройки бота.

#### Приоритет выбора модели

```
1. Запрошенная модель в запросе (параметр `model`)  ← ВЫСШИЙ ПРИОРИТЕТ
   ↓ (если не указана)
2. bot_settings.json (activeModel)  ← Устанавливается через /model в Telegram
   ↓ (если не задана)
3. .env файл (DEFAULT_MODEL)
   ↓ (если не задана)
4. AvailableModels.txt (первая модель) = "qwen3.5-plus"
   ↓ (если файл недоступен)
5. Fallback = "qwen3.5-plus"  ← НИЗШИЙ ПРИОРИТЕТ
```

#### Управление моделью

**Через Telegram бота:**
```bash
# Установить модель
/model qwen3.5-plus

# Показать текущую модель
/model

# Сбросить на настройки по умолчанию
/clear
```

**Через .env файл:**
```bash
# В файле .env
DEFAULT_MODEL=qwen3.5-flash
```

**Программно:**
```javascript
// Модель берётся из настроек автоматически
const response = await fetch('http://localhost:3264/api/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    // model можно не указывать - будет использована активная модель
    messages: [{ role: 'user', content: 'Привет!' }]
  })
});
```

#### Файл настроек

Настройки хранятся в `session/bot_settings.json`:
```json
{
  "activeModel": "qwen3.5-plus",
  "llmChatEnabled": true,
  "lastUpdated": "2026-05-31T18:59:48.000Z"
}
```

> **💡 Преимущество:** Изменение модели через Telegram бота применяется **мгновенно** без перезапуска сервиса!

---

---


## API Reference

### Основные эндпоинты

| Эндпоинт | Метод | Описание |
|----------|-------|----------|
| `/api/chat` | POST | Отправка сообщения с поддержкой `chatId` и `parentId` |
| `/api/chat/completions` | POST | OpenAI-совместимый эндпоинт, возвращает `chatId`/`parentId` |
| `/api/models` | GET | Получение списка доступных моделей |
| `/api/status` | GET | Проверка статуса авторизации и аккаунтов |
| `/api/chats` | POST | Создание нового чата на серверах Qwen |
| `/api/files/upload` | POST | Загрузка файла через multipart/form-data |
| `/api/files/getstsToken` | POST | Получение STS-токена для прямой загрузки |
| `/api/images/generations` | POST | Генерация изображений (DALL-E-совместимый) 🆕 |

**⚠️ Удалённые эндпоинты (v2):**
- `GET /api/chats` - список чатов
- `GET /api/chats/:chatId` - история чата
- `DELETE /api/chats/:chatId` - удаление чата
- `PUT /api/chats/:chatId/rename` - переименование
- `POST /api/chats/cleanup` - автоудаление

*Причина: чаты теперь управляются на серверах Qwen*

### Выбор эндпоинтов

| Эндпоинт | Использование контекста | Формат запроса | Совместимость |
|----------|--------------------------|----------------|---------------|
| `/api/chat` | Контекст управляется через `chatId` + `parentId`. История хранится на серверах Qwen. | Упрощённый `message` + `chatId` + `parentId` | Нативный для прокси |
| `/api/chat/completions` | Поддерживает `chatId` + `parentId` в запросе. Возвращает их в ответе для продолжения. | Массив `messages` (OpenAI format) + опционально `chatId`/`parentId` | OpenAI SDK |


### POST /api/chat

Нативный формат запроса. Поддерживает текст, составные сообщения с изображениями и system message.


### Форматы запросов

#### 1. Упрощенный формат с параметром `message`

```json
{
  "message": "Текст сообщения",
  "model": "qwen3.5-plus",  // Optional - uses active model from settings
  "chatId": "идентификатор_чата",
  "parentId": "response_id_из_предыдущего_ответа"
}
```

#### 2. Формат, совместимый с OpenAI API

```json
{
  "messages": [
    {"role": "user", "content": "Привет, как дела?"}
  ],
  "model": "qwen3.5-plus",  // Optional - uses active model from settings
  "chatId": "идентификатор_чата",
  "parentId": "response_id_из_предыдущего_ответа"
}
```

### Работа с контекстом (API v2)

**Новая система:**
- История хранится на серверах Qwen, не локально
- Контекст управляется через `chatId` + `parentId`
- `parentId` - это `response_id` из предыдущего ответа

**Пример диалога:**

```javascript
// 1. Первое сообщение
const res1 = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ message: "Сколько будет 2+2?" })
});
const data1 = await res1.json();
// Ответ: { chatId: "abc-123", parentId: "xyz-789", ... }

// 2. Второе сообщение (с контекстом)
const res2 = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ 
    message: "А результат плюс 3?",
    chatId: data1.chatId,      // Тот же чат
    parentId: data1.parentId    // Из предыдущего ответа!
  })
});
// Модель помнит контекст и ответит "7"
```

### Системные инструкции (System Messages)

**Новое в v2:** Поддержка системных сообщений для настройки поведения модели!

Системные инструкции передаются через поле `role: "system"` в массиве `messages`. Это позволяет задать модели контекст, стиль общения, правила поведения и т.д.

**Пример:**

```javascript
// Запрос с системной инструкцией
const response = await fetch('/api/chat/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      {
        role: "system",
        content: "Ты - опытный программист на Python. Отвечай кратко и предоставляй примеры кода."
      },
      {
        role: "user",
        content: "Как отсортировать список в Python?"
      }
    ],
    model: "qwen3.5-plus"  // Optional - uses active model from settings
  })
});
```

**Как работает:**
- `system` message извлекается из массива и передаётся отдельным параметром в Qwen API v2
- Может использоваться в обоих эндпоинтах: `/api/chat` и `/api/chat/completions`
- System message применяется ко всему чату и влияет на все последующие ответы

**Примеры использования:**

```json
// 1. Ролевая инструкция
{
  "messages": [
    {"role": "system", "content": "Ты - эксперт по машинному обучению"},
    {"role": "user", "content": "Объясни, что такое градиентный спуск"}
  ]
}

// 2. Стиль ответов
{
  "messages": [
    {"role": "system", "content": "Отвечай как пират"},
    {"role": "user", "content": "Как дела?"}
  ]
}

// 3. Формат вывода
{
  "messages": [
    {"role": "system", "content": "Всегда отвечай в формате JSON"},
    {"role": "user", "content": "Дай информацию о Python"}
  ]
}
```

### Работа с изображениями

Прокси поддерживает отправку сообщений с изображениями:

#### Формат `message` с изображением

```json
{
  "message": [
    {
      "type": "text",
      "text": "Опишите объекты на этом изображении"
    },
    {
      "type": "image",
      "image": "URL_ИЗОБРАЖЕНИЯ"
    }
  ],
  "model": "qwen-vl-max",
  "chatId": "идентификатор_чата",
  "parentId": "response_id"
}
```

### Загрузка файлов

#### Загрузка изображения

```
POST http://localhost:3264/api/files/upload
```

**Формат запроса:** `multipart/form-data`

**Параметры:**

- `file` - файл изображения (поддерживаются форматы: jpg, jpeg, png, gif, webp)

**Пример использования с curl:**

```bash
curl -X POST http://localhost:3264/api/files/upload \
  -F "file=@/путь/к/изображению.jpg"
```

**Пример ответа:**

```json
{
  "imageUrl": "https://cdn.qwenlm.ai/user-id/file-id_filename.jpg?key=..."
}
```

#### Получение URL изображения

Для отправки изображений через API прокси необходимо сначала получить URL изображения. Это можно сделать двумя способами:

##### Способ 1: Загрузка через API прокси

Отправьте POST запрос на эндпоинт `/api/files/upload` для загрузки изображения, как описано выше.

##### Способ 2: Получение URL через веб-интерфейс Qwen

1. Загрузите изображение в официальном веб-интерфейсе Qwen (<https://chat.qwen.ai/>)
2. Откройте инструменты разработчика в браузере (F12 или Ctrl+Shift+I)
3. Перейдите на вкладку "Network" (Сеть)
4. Найдите запрос к API Qwen, содержащий ваше изображение (обычно это запрос GetsToken)
5. В теле запроса найдите URL изображения, который выглядит примерно так: `https://cdn.qwenlm.ai/user-id/file-id_filename.jpg?key=...`
6. Скопируйте этот URL для использования в вашем API-запросе

### Управление диалогами

#### Создание нового диалога

```
POST http://localhost:3264/api/chats
```

**Тело запроса:**

```json
{
  "name": "Название диалога"
}
```

**Ответ:**

```json
{
  "id": "chatcmpl-1739012345678",
  "object": "chat.completion",
  "created": 1739012345,
  "model": "qwen3.5-plus",  // Or whatever model was used
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Квантовые вычисления — это тип вычислений, основанный на принципах квантовой механики..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 156,
    "total_tokens": 168
  },
  "chatId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "parentId": "f9e8d7c6-b5a4-3210-fedc-ba0987654321"
}
```

#### Продолжение диалога (с контекстом)

Используйте `chatId` и `parentId` из предыдущего ответа:

```bash
curl -X POST http://localhost:3264/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Приведи практические примеры",
    "model": "qwen3.5-plus",  // Or whatever model was used
    "chatId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "parentId": "f9e8d7c6-b5a4-3210-fedc-ba0987654321"
  }'
```

#### С system message через массив messages

```bash
curl -X POST http://localhost:3264/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "system", "content": "Ты -- опытный Python-разработчик. Отвечай кратко, с примерами кода."},
      {"role": "user", "content": "Как отсортировать словарь по значениям?"}
    ],
    "model": "qwen-max-latest"
  }'
```

#### С изображением

```bash
curl -X POST http://localhost:3264/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": [
      {"type": "text", "text": "Что изображено на этой картинке?"},
      {"type": "image", "image": "https://example-oss-url.com/uploaded-image.png"}
    ],
    "model": "qwen3-vl-plus"
  }'
```

---

### POST /api/chat/completions

OpenAI-совместимый формат. Используйте этот эндпоинт, если работаете с OpenAI SDK или любым инструментом, поддерживающим OpenAI API.

#### Обычный запрос (без streaming)

**Запрос:**

```bash
curl -X POST http://localhost:3264/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-plus",  // Or whatever model was used
    "messages": [
      {"role": "system", "content": "Отвечай кратко и по существу."},
      {"role": "user", "content": "Столица Японии?"}
    ]
  }'
```

**Ответ:**

```json
{
  "id": "chatcmpl-1739012345678",
  "object": "chat.completion",
  "created": 1739012345,
  "model": "qwen3.5-plus",  // Or whatever model was used
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Токио."
      },
      "finish_reason": "stop"
    }
  ],
  "chatId": "abcd-1234-5678",
  "parentId": "efgh-5678-9012"
}
```

**Последующие запросы** (с указанием полученного `chatId`):

```json
{
  "model": "qwen3.5-plus",  // Or whatever model was used
  "messages": [
    {"role": "user", "content": "Сколько будет 2+2?"}
  ],
  "chatId": "abcd-1234-5678",
  "parentId": "efgh-5678-9012"
}
```

---

## 🔌 Совместимость с OpenAI API

Прокси поддерживает эндпоинт, совместимый с OpenAI API для подключения клиентов, которые работают с OpenAI API:

```
POST /api/chat/completions
```

### Behavior

1. **Isolated by default:** if `chatId` is omitted and `conversation_id` is not provided, the proxy does not restore global session context (IP + User-Agent), so chats do not leak into each other.

2. **Conversation-aware routing:** if `conversation_id`/`chat_id` is provided, the proxy keeps context inside that scoped conversation.

3. **Legacy global restore is optional:** set `ALLOW_UNSCOPED_SESSION_CHAT_RESTORE=true` to return to old behavior (restore by IP + User-Agent when ids are omitted).

4. **Both id formats are supported:** `chatId`/`parentId` and `chat_id`/`parent_id`.

5. **Force a fresh chat:** send `newChat: true` or `new_chat: true`.

6. **System messages are supported:** `role: "system"` is passed through to the upstream model.

7. **Strict JSON parsing:** invalid JSON (for example, single quotes instead of double quotes) returns `400 Invalid JSON`.

8. **Method check:** `GET /api/chat/completions` returns `405`; use `POST`.

**System message request example:**

```json
{
  "messages": [
    {"role": "system", "content": "Ты эксперт по JavaScript. Отвечай только на вопросы о JavaScript."},
    {"role": "user", "content": "Как создать класс в JavaScript?"}
  ],
  "model": "qwen-max-latest"
}
```

### Поддержка streaming режима

Прокси поддерживает режим потоковой передачи ответов (streaming), что позволяет получать ответы по частям в режиме реального времени. Стриминг доступен в обоих эндпоинтах:

#### Эндпоинт `/api/chat/completions` (OpenAI-совместимый)

```json
{
  "messages": [
    {"role": "user", "content": "Напиши длинный рассказ о космосе"}
  ],
  "model": "qwen3.5-plus",  // Or whatever model was used
  "stream": true
}
```

#### Эндпоинт `/api/chat` (нативный)

```json
{
  "message": "Напиши длинный рассказ о космосе",
  "model": "qwen3.5-plus",  // Or whatever model was used
  "stream": true
}
```

При использовании streaming режима, ответ будет возвращаться постепенно в формате Server-Sent Events (SSE), совместимом с OpenAI API.

### 🔥 Поддержка OpenWebUI

Прокси полностью поддерживает работу с **OpenWebUI** через streaming режим:

1. **Настройка подключения в OpenWebUI:**
   - Base URL: `http://localhost:3264/api`
   - API Key: любой (или оставьте пустым, если файл `Authorization.txt` пустой)

2. **Формат запроса для OpenWebUI:**

```json
{
  "messages": [
    {"role": "user", "content": "Привет!"}
  ],
  "model": "qwen3.5-plus",  // Or whatever model was used
  "stream": true
}
```

3. **Изоляция чатов по умолчанию:** без `conversation_id`/`chatId` прокси не восстанавливает общий контекст по IP + User-Agent, чтобы исключить «память» между разными чатами.

4. **Scoped-контекст для OpenWebUI:** если OpenWebUI передаёт `conversation_id` (или `chat_id`), контекст продолжается внутри этого конкретного диалога.

5. **Legacy fallback при необходимости:** можно вернуть старое поведение через `ALLOW_UNSCOPED_SESSION_CHAT_RESTORE=true`.

6. **Поддержка всех эндпоинтов:**
   - `/api/chat/completions` — OpenAI-совместимый эндпоинт
   - `/api/v1/chat/completions` — альтернативный OpenAI-совместимый эндпоинт
   - `/api/chat` — нативный эндпоинт прокси

7. **Генерация изображений:** Через OpenWebUI можно использовать генерацию изображений через эндпоинт `/api/images/generations` (DALL-E-совместимый API).

---

### 🎨 Генерация изображений

Прокси поддерживает генерацию изображений через Qwen Image API:

**Эндпоинт:** `POST /api/images/generations`

```json
{
  "prompt": "Космический корабль на фоне туманности",
  "model": "qwen-image-plus",
  "n": 1,
  "size": "1024x1024"
}
```

**Ответ:**

```json
{
  "created": 1234567890,
  "data": [
    {
      "url": "https://example.com/generated-image.png",
      "revised_prompt": "Космический корабль на фоне туманности"
    }
  ]
}
```

**Параметры:**
- `prompt` (обязательный) — текстовое описание изображения
- `model` — модель генерации (`qwen-image-plus`, `qwen-image-turbo`)
- `n` — количество изображений (по умолчанию 1)
- `size` — размер (`1024x1024`, `1024x1792`, `1792x1024`, `512x512`, `768x768`, `960x960`)

> **Требуется API-ключ:** Для генерации изображений необходимо установить переменную окружения `DASHSCOPE_API_KEY`.

### Примеры использования с OpenAI SDK

```bash
curl -X POST http://localhost:3264/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-plus",  // Or whatever model was used
    "messages": [
      {"role": "user", "content": "Напиши хайку о программировании"}
    ],
    "stream": true
  }'
```

**Ответ (SSE):**

```
data: {"id":"chatcmpl-stream","object":"chat.completion.chunk","created":1739012345,"model":"qwen-max-latest","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-stream","object":"chat.completion.chunk","created":1739012345,"model":"qwen-max-latest","choices":[{"index":0,"delta":{"content":"Строки кода бегут"},"finish_reason":null}]}

data: {"id":"chatcmpl-stream","object":"chat.completion.chunk","created":1739012345,"model":"qwen-max-latest","choices":[{"index":0,"delta":{"content":" —\nБаг затаился в ветвях"},"finish_reason":null}]}

data: {"id":"chatcmpl-stream","object":"chat.completion.chunk","created":1739012345,"model":"qwen-max-latest","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

#### С продолжением диалога

```bash
curl -X POST http://localhost:3264/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-plus",  // Or whatever model was used
    "messages": [
      {"role": "user", "content": "Теперь на тему космоса"}
    ],
    "chatId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "parentId": "f9e8d7c6-b5a4-3210-fedc-ba0987654321"
  }'
```

---

### GET /api/models

Возвращает список доступных моделей в формате OpenAI.

**Запрос:**

```bash
curl http://localhost:3264/api/models
```

**Ответ:**

```json
{
  "object": "list",
  "data": [
    {"id": "qwen3-max", "object": "model", "created": 0, "owned_by": "qwen", "permission": []},
    {"id": "qwen3-vl-plus", "object": "model", "created": 0, "owned_by": "qwen", "permission": []},
    {"id": "qwen3-coder-plus", "object": "model", "created": 0, "owned_by": "qwen", "permission": []},
    {"id": "qwq-32b", "object": "model", "created": 0, "owned_by": "qwen", "permission": []},
    {"id": "qwen-max-latest", "object": "model", "created": 0, "owned_by": "qwen", "permission": []}
  ]
}
```

> Полный список поддерживаемых моделей -- см. раздел [Доступные модели](#доступные-модели).

---

### GET /api/status

Проверяет статус авторизации и состояние всех аккаунтов. Для каждого аккаунта выполняется тестовый запрос к Qwen API.

**Запрос:**

```bash
curl http://localhost:3264/api/status
```

**Ответ:**

```json
{
  "authenticated": true,
  "message": "Авторизация активна",
  "accounts": [
    {"id": "acc_1739012345678", "status": "OK", "resetAt": null},
    {"id": "acc_1739098765432", "status": "WAIT", "resetAt": "2026-02-17T12:00:00.000Z"},
    {"id": "acc_1739055555555", "status": "INVALID", "resetAt": null}
  ]
}
```

| Поле | Описание |
|------|----------|
| `authenticated` | `true`, если хотя бы один аккаунт активен |
| `accounts[].status` | `OK` -- активен, `WAIT` -- rate limit, `INVALID` -- токен недействителен |
| `accounts[].resetAt` | Время, после которого аккаунт станет доступен (для WAIT) |

---

### POST /api/chats

Создаёт новый чат на серверах Qwen. Возвращает `chatId`, который можно использовать для ведения диалога с сохранением истории.

**Запрос:**

```bash
curl -X POST http://localhost:3264/api/chats \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Обсуждение архитектуры",
    "model": "qwen-max-latest"
  }'
```

**Ответ:**

```json
{
  "chatId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "success": true
}
```

---

### POST /api/files/upload

Загружает файл через сервер в Qwen OSS. Поддерживаемые типы: изображения (jpg, png, gif, webp, bmp), документы (pdf, doc, docx, txt) и прочие файлы. Максимальный размер -- 10 МБ (настраивается через `MAX_FILE_SIZE`).

**Запрос:**

```bash
curl -X POST http://localhost:3264/api/files/upload \
  -F "file=@/path/to/image.png"
```

**Ответ:**

```json
{
  "success": true,
  "file": {
    "name": "image.png",
    "url": "https://oss-bucket.aliyuncs.com/path/to/uploaded-image.png",
    "size": 245760,
    "type": "image/png"
  }
}
```

Полученный `url` можно использовать в запросе к `/api/chat` с составным сообщением (см. [Работа с изображениями](#работа-с-изображениями)).

---

### POST /api/files/getstsToken

Возвращает STS-токен для прямой загрузки файла в Qwen OSS из клиентского кода. Для большинства случаев удобнее использовать `/api/files/upload`.

**Запрос:**

```bash
curl -X POST http://localhost:3264/api/files/getstsToken \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "document.pdf",
    "filesize": 102400,
    "filetype": "document"
  }'
```

**Ответ:**

```json
{
  "access_key_id": "STS.xxxxx",
  "access_key_secret": "xxxxx",
  "security_token": "CAISxxxxx...",
  "region": "oss-cn-beijing",
  "bucketname": "qwen-upload-bucket",
  "file_path": "uploads/2026/02/16/document.pdf",
  "file_url": "https://qwen-upload-bucket.oss-cn-beijing.aliyuncs.com/uploads/...",
  "file_id": "file-abc123"
}
```

| Поле | Описание |
|------|----------|
| `filetype` | Тип файла: `image` (jpg, png, gif, webp, bmp), `document` (pdf, doc, docx, txt) или `file` |

---

### POST /api/images/generations 🆕

Генерация изображений через Qwen Image API + DashScope API. DALL-E-совместимый интерфейс.

**Поддерживаемые режимы:**
- **Text-to-Image**: Генерация изображения из текстового описания
- **Image-to-Image**: Трансформация загруженного изображения по описанию

#### Text-to-Image

**Запрос:**

```bash
curl -X POST http://localhost:3264/api/images/generations \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Космический корабль на фоне туманности, цифровое искусство",
    "model": "qwen-image-plus",
    "n": 1,
    "size": "1024x1024"
  }'
```

**Ответ:**

```json
{
  "created": 1234567890,
  "data": [
    {
      "url": "https://example.com/generated-image.png",
      "revised_prompt": "Космический корабль на фоне туманности, цифровое искусство"
    }
  ]
}
```

#### Image-to-Image

**Запрос:**

```bash
# Сначала загружаем изображение
curl -X POST http://localhost:3264/api/files/upload \
  -F "file=@photo.jpg"

# Получаем URL и используем для генерации
curl -X POST http://localhost:3264/api/images/generations \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Сделай изображение в стиле импрессионизма",
    "image_url": "https://oss-bucket.aliyuncs.com/uploads/photo.jpg",
    "model": "qwen-image-plus",
    "n": 1,
    "size": "1024x1024"
  }'
```

**Параметры:**

| Параметр | Тип | Обязательный | Описание |
|----------|------|-------------|----------|
| `prompt` | string | ✅ | Текстовое описание желаемого изображения |
| `model` | string | ❌ | Модель генерации (`qwen-image-plus`, `qwen-image-turbo`) |
| `n` | integer | ❌ | Количество изображений (по умолчанию 1) |
| `size` | string | ❌ | Размер: `1024x1024`, `1024x1792`, `1792x1024`, `512x512`, `768x768`, `960x960` |
| `image_url` | string | ❌ | URL исходного изображения для image-to-image |

> **⚠️ Требуется API-ключ:** Для генерации изображений необходимо установить переменную окружения `DASHSCOPE_API_KEY`.

#### Генерация через Telegram бота

**Text-to-Image:**
```
/imagens Космический корабль на фоне туманности
```

**Image-to-Image:**
1. Отправьте фото боту
2. Добавьте подпись с описанием желаемого результата
3. Бот автоматически сгенерирует новое изображение

> 📖 **Подробная документация:** [docs/IMAGE_GENERATION.md](docs/IMAGE_GENERATION.md), [docs/IMAGE_GENERATION_MODES.md](docs/IMAGE_GENERATION_MODES.md)

---

## Работа с контекстом (API v2)

API использует серверную историю чатов Qwen. Каждый ответ содержит `chatId` и `parentId`, которые нужно передать в следующий запрос для продолжения диалога.

### Как это работает

```
1-й запрос (без chatId) ──> Ответ с chatId="abc", parentId="def"
                                    │
2-й запрос (chatId="abc", parentId="def") ──> Ответ с parentId="ghi"
                                                      │
3-й запрос (chatId="abc", parentId="ghi") ──> Ответ с parentId="jkl"
```

### Полный пример диалога

**Шаг 1 -- первое сообщение:**

```bash
curl -X POST http://localhost:3264/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-plus",  // Or whatever model was used
    "messages": [{"role": "user", "content": "Что такое Docker?"}]
  }'
```

```json
{
  "id": "chatcmpl-1739012345678",
  "choices": [{"index": 0, "message": {"role": "assistant", "content": "Docker — это платформа для контейнеризации приложений..."}, "finish_reason": "stop"}],
  "chatId": "abc-123",
  "parentId": "def-456"
}
```

**Шаг 2 -- продолжение (модель помнит контекст):**

```bash
curl -X POST http://localhost:3264/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-plus",  // Or whatever model was used
    "messages": [{"role": "user", "content": "Чем он отличается от виртуальных машин?"}],
    "chatId": "abc-123",
    "parentId": "def-456"
  }'
```

```json
{
  "id": "chatcmpl-1739012345679",
  "choices": [{"index": 0, "message": {"role": "assistant", "content": "Основные отличия Docker от виртуальных машин:\n1. Docker использует ядро хост-системы, а ВМ — полное гостевое ядро..."}, "finish_reason": "stop"}],
  "chatId": "abc-123",
  "parentId": "ghi-789"
}
```

**Шаг 3 -- ещё одно сообщение в том же диалоге:**

```bash
curl -X POST http://localhost:3264/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-plus",  // Or whatever model was used
    "messages": [{"role": "user", "content": "Покажи пример Dockerfile для Node.js"}],
    "chatId": "abc-123",
    "parentId": "ghi-789"
  }'
```

> Обратите внимание: `parentId` каждый раз берётся из **предыдущего** ответа, а `chatId` остаётся одним и тем же на протяжении всего диалога.

### Предварительное создание чата

Можно создать чат заранее через `POST /api/chats` и использовать полученный `chatId` с первого сообщения. Это удобно, если вы хотите задать имя чату.

---

## Работа с изображениями

Для анализа изображений используйте модели с поддержкой vision: `qwen3-vl-plus`, `qwen2.5-vl-32b-instruct`, `qvq-72b-preview-0310`, `qwen2.5-omni-7b`.

### Полный flow: загрузка + анализ

**Шаг 1 -- загрузить изображение:**

```bash
curl -X POST http://localhost:3264/api/files/upload \
  -F "file=@photo.jpg"
```

```json
{
  "success": true,
  "file": {
    "name": "photo.jpg",
    "url": "https://oss-bucket.aliyuncs.com/uploads/photo.jpg",
    "size": 184320,
    "type": "image/jpeg"
  }
}
```

**Шаг 2 -- отправить запрос с изображением:**

```bash
curl -X POST http://localhost:3264/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": [
      {"type": "text", "text": "Опиши, что изображено на фото. Какие объекты ты видишь?"},
      {"type": "image", "image": "https://oss-bucket.aliyuncs.com/uploads/photo.jpg"}
    ],
    "model": "qwen3-vl-plus"
  }'
```

### Формат составного сообщения

Поле `message` принимает массив объектов:

```json
[
  {"type": "text", "text": "Ваш вопрос к изображению"},
  {"type": "image", "image": "https://url-to-uploaded-image.com/image.png"}
]
```

---

## Генерация изображений 🆕

Проект поддерживает генерацию изображений через **двойной бэкенд**: Qwen Image API + DashScope API.

### 🎯 Режимы генерации

#### 1. Text-to-Image (Текст → Изображение)

Генерация изображения из текстового описания:

**Через API:**
```bash
curl -X POST http://localhost:3264/api/images/generations \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Красивый закат над океаном, фотореалистично",
    "model": "qwen-image-plus",
    "n": 1,
    "size": "1024x1024"
  }'
```

**Через Telegram бота:**
```
/imagens Красивый закат над океаном, фотореалистично
```

#### 2. Image-to-Image (Изображение → Изображение)

Трансформация загруженного изображения по описанию:

**Через API:**
```bash
# 1. Загружаем изображение
curl -X POST http://localhost:3264/api/files/upload \
  -F "file=@photo.jpg"

# 2. Генерируем на основе загруженного
curl -X POST http://localhost:3264/api/images/generations \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Сделай в стиле аниме",
    "image_url": "https://oss-bucket.aliyuncs.com/uploads/photo.jpg",
    "model": "qwen-image-plus",
    "n": 1
  }'
```

**Через Telegram бота:**
1. Отправьте фото боту
2. Добавьте подпись: "Сделай в стиле аниме"
3. Бот автоматически сгенерирует новое изображение

### 🛠 Доступные модели

| Модель | Описание | Скорость | Качество |
|--------|----------|----------|----------|
| `qwen-image-plus` | Высокое качество | Средняя | Отличное |
| `qwen-image-turbo` | Быстрая генерация | Быстрая | Хорошее |

### 📐 Поддерживаемые размеры

- `1024x1024` — квадрат (по умолчанию)
- `1024x1792` — портретный
- `1792x1024` — ландшафтный
- `512x512` — маленький квадрат
- `768x768` — средний квадрат
- `960x960` — большой квадрат

### 🔧 Настройка

**Требуется API-ключ:**
```bash
# В файле .env
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
```

**Лимиты:**
- Отдельный rate limit для генерации медиа (не влияет на чат)
- Автоматическая ротация аккаунтов при превышении лимитов
- Максимум 5 изображений за один запрос

### 📝 Примеры использования

**OpenAI SDK:**
```javascript
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'http://localhost:3264/api',
    apiKey: 'any-string',
});

const response = await client.images.generate({
    model: 'qwen-image-plus',
    prompt: 'Футуристический город в неоновых огнях',
    n: 1,
    size: '1024x1024',
});

console.log(response.data[0].url);
```

**Python:**
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3264/api",
    api_key="any-string"
)

response = client.images.generate(
    model="qwen-image-plus",
    prompt="Космический корабль над планетой",
    n=1,
    size="1024x1024"
)

print(response.data[0].url)
```

### 🆚 Сравнение режимов

| Функция | Text-to-Image | Image-to-Image |
|---------|---------------|----------------|
| **Вход** | Текстовый промпт | Изображение + промпт |
| **API параметр** | `prompt` | `prompt` + `image_url` |
| **Telegram** | `/imagens промпт` | Фото + подпись |
| **Использование** | Создание с нуля | Стилизация/трансформация |

> 📖 **Подробная документация:**
> - [docs/IMAGE_GENERATION.md](docs/IMAGE_GENERATION.md) - полное руководство
> - [docs/IMAGE_GENERATION_MODES.md](docs/IMAGE_GENERATION_MODES.md) - режимы генерации
> - [docs/TELEGRAM_IMAGE_GENERATION.md](docs/TELEGRAM_IMAGE_GENERATION.md) - генерация в Telegram

---

## OpenAI SDK

Прокси полностью совместим с официальным OpenAI SDK для JavaScript/TypeScript. Достаточно указать `baseURL` и любой непустой `apiKey`.

### Простой запрос

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'http://localhost:3264/api',
    apiKey: 'any-string',  // обязательно для SDK, но не проверяется (если Authorization.txt пуст)
});

const response = await client.chat.completions.create({
    model: 'qwen-max-latest',
    messages: [
        { role: 'user', content: 'Напиши 5 интересных фактов о космосе' }
    ],
});

console.log(response.choices[0].message.content);
```

### Потоковый режим

```javascript
const stream = await client.chat.completions.create({
    model: 'qwen-max-latest',
    messages: [
        { role: 'user', content: 'Напиши короткую историю о роботе' }
    ],
    stream: true,
});

for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || '';
    process.stdout.write(text);
}
```

### С system message

```javascript
const response = await client.chat.completions.create({
    model: 'qwen-max-latest',
    messages: [
        { role: 'system', content: 'Ты -- опытный DevOps-инженер. Отвечай с примерами команд.' },
        { role: 'user', content: 'Как настроить CI/CD для Node.js проекта?' }
    ],
});
```

---

## Python (Альтернативная реализация)

Проект также включает полную реализацию на Python, которая работает независимо от Node.js.

### Установка и запуск
```bash
python -m venv venv
# Windows:
# venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
python main.py
```

### Возможности Python-версии
*   **main.py**: Полноценный прокси-сервер на FastAPI и менеджер аккаунтов.
*   **Интерактивное меню**: Тот же интерфейс, что и в Node.js версии.
*   **Playwright**: Автоматизация браузера для входа и получения токенов.
*   **OpenAI Compatibility**: Полная поддержка OpenAI SDK (`baseURL: http://localhost:3264/api`).

### Python примеры (как в Node.js)

В проект добавлены отдельные Python-примеры, аналогичные Node.js примерам:

- OpenAI SDK: `examples/python-sdk/`
- Прямые HTTP запросы: `examples/python-direct/`

Установка зависимостей для примеров:

```bash
python -m venv venv
# Windows:
# venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate
pip install -r requirements.txt
```

OpenAI SDK примеры:

```bash
python examples/python-sdk/simple.py
python examples/python-sdk/streaming.py
python examples/python-sdk/system_message.py
python examples/python-sdk/image_analysis.py
python examples/python-sdk/conversation.py
python examples/python-sdk/openai_compatibility.py
```

Direct API примеры:

```bash
python examples/python-direct/httpx_example.py
python examples/python-direct/httpx_streaming.py
```

> Перед запуском примеров убедитесь, что сервер уже запущен на `http://localhost:3264`.

---

## Переменные окружения

Все настройки читаются из переменных окружения с фоллбэками на значения по умолчанию. Полный список задаётся в `src/config.js`.

> **💡 Совет:** Создайте `.env` файл на основе `.env.example` для удобной настройки.
> Файл `.env` загружается автоматически при старте.

### Сервер

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `PORT` | `3264` | Порт HTTP-сервера |
| `HOST` | `0.0.0.0` | Адрес привязки |
| `DEFAULT_MODEL` | `qwen3.5-plus` | Модель по умолчанию (если не задана в `bot_settings.json`) |
| `ALLOW_UNSCOPED_SESSION_CHAT_RESTORE` | `false` | Разрешить legacy-восстановление контекста по IP + User-Agent, даже без `conversation_id`/`chatId` |
| `FORCE_NEW_CHAT_PER_REQUEST` | `false` | Создавать новый диалог для каждого запроса (как OpenAI API). `true` = всегда новый чат, `false` = восстанавливать предыдущий |

### Telegram бот 🤖

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | *(нет)* | Токен бота от @BotFather |
| `TELEGRAM_USER_IDS` | *(нет)* | ID авторизованных пользователей (через запятую) |
| `TELEGRAM_PROXY` | *(нет)* | Прокси для Telegram API (HTTP/SOCKS) |
| `TELEGRAM_PROXY_URL` | *(нет)* | Альтернативная переменная для прокси |

**Пример:**
```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_USER_IDS=102375526,123456789
TELEGRAM_PROXY=http://user:pass@proxy.example.com:8080
```

📖 **Документация:** [docs/TELEGRAM_PROXY.md](docs/TELEGRAM_PROXY.md)

### Токены и уведомления

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `TOKEN_EXPIRY_WARNING_MS` | `3600000` (1 час) | Время предупреждения об истечении токена |

**Пример:**
```bash
# Предупреждать за 2 часа до истечения
TOKEN_EXPIRY_WARNING_MS=7200000
```

### Прокси

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `QWEN_PROXY` | *(нет)* | Прокси для Qwen API (HTTP/HTTPS/SOCKS) |
| `FILE_DOWNLOAD_PROXY` | *(нет)* | Прокси для скачивания файлов по HTTP/HTTPS |

**Пример:**
```bash
QWEN_PROXY=http://user:pass@proxy.example.com:8080
FILE_DOWNLOAD_PROXY=socks5://proxy.example.com:1080
```

### Режимы запуска

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `SKIP_ACCOUNT_MENU` | `false` | Пропустить интерактивное меню аккаунтов |
| `NON_INTERACTIVE` | `false` | Аналог `SKIP_ACCOUNT_MENU` |
| `CHROME_PATH` | *(авто)* | Путь к исполняемому файлу Chromium/Chrome |

### Таймауты

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `PAGE_TIMEOUT` | `120000` (2 мин) | Таймаут загрузки страниц |
| `AUTH_TIMEOUT` | `120000` (2 мин) | Таймаут ожидания авторизации |
| `NAVIGATION_TIMEOUT` | `60000` (1 мин) | Таймаут навигации браузера |
| `RETRY_DELAY` | `2000` (2 сек) | Задержка между повторными попытками |
| `STREAMING_CHUNK_DELAY` | `20` (20 мс) | Задержка между SSE-чанками при streaming |

### Лимиты

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `PAGE_POOL_SIZE` | `3` | Размер пула страниц браузера |
| `MAX_FILE_SIZE` | `10485760` (10 МБ) | Максимальный размер загружаемого файла |
| `MAX_HISTORY_LENGTH` | `100` | Максимальное число записей в локальной истории |
| `MAX_RETRY_COUNT` | `3` | Максимальное число повторных попыток при ошибках |

### Логирование

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `LOG_LEVEL` | `info` | Уровень логирования (error, warn, info, debug) |
| `LOG_MAX_SIZE` | `5242880` (5 МБ) | Максимальный размер файла лога |
| `LOG_MAX_FILES` | `5` | Количество ротируемых файлов логов |

### Браузер

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `VIEWPORT_WIDTH` | `1920` | Ширина viewport браузера |
| `VIEWPORT_HEIGHT` | `1080` | Высота viewport браузера |
| `USER_AGENT` | Chrome 131 | User-Agent строка |

### Пути

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `SESSION_DIR` | `session` | Директория для хранения сессий и токенов |
| `UPLOADS_DIR` | `uploads` | Директория для временных файлов загрузки |
| `LOGS_DIR` | `logs` | Директория для файлов логов |

### API URLs (для продвинутых)

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `QWEN_BASE_URL` | `https://chat.qwen.ai` | Базовый URL Qwen |
| `CHAT_API_URL` | `{base}/api/v2/chat/completions` | URL API чата |
| `CREATE_CHAT_URL` | `{base}/api/v2/chats/new` | URL создания чата |
| `CHAT_PAGE_URL` | `{base}/` | URL главной страницы чата |
| `TASK_STATUS_URL` | `{base}/api/v1/tasks/status` | URL статуса задач |
| `STS_TOKEN_API_URL` | `{base}/api/v1/files/getstsToken` | URL получения STS-токена |
| `AUTH_SIGNIN_URL` | `{base}/auth?action=signin` | URL страницы авторизации |
| `OSS_SDK_URL` | `https://gosspublic.alicdn.com/aliyun-oss-sdk-6.20.0.min.js` | URL Aliyun OSS SDK |
| `MODELS_API_URL` | `{base}/api/v2/models` | URL API моделей |

### Генерация изображений 🎨

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `IMAGE_GENERATION_MODE` | `dashscope` | Режим генерации: `dashscope` (через API ключ) или `browser` (через браузер) |
| `DASHSCOPE_API_KEY` | *(нет)* | API ключ DashScope (требуется при `IMAGE_GENERATION_MODE=dashscope`) |

**Пример:**
```bash
# Режим браузера (не требует API ключа)
IMAGE_GENERATION_MODE=browser

# Или режим DashScope (требует API ключ)
IMAGE_GENERATION_MODE=dashscope
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
```

📖 **Документация:** [docs/IMAGE_GENERATION.md](docs/IMAGE_GENERATION.md), [docs/IMAGE_GENERATION_MODES.md](docs/IMAGE_GENERATION_MODES.md)

---

## Структура проекта

```
├── main.py                     # Python FastAPI реализация прокси + интерактивное меню
├── requirements.txt            # Python зависимости
├── index.js                    # Точка входа: Express-сервер, меню аккаунтов
├── package.json
├── Dockerfile
├── docker-compose.yml
│
├── src/
│   ├── config.js               # Центральный модуль конфигурации (env-переменные)
│   ├── AvailableModels.txt     # Список доступных моделей
│   ├── Authorization.txt       # API-ключи для авторизации запросов
│   │
│   ├── api/
│   │   ├── routes.js           # Определение REST-эндпоинтов
│   │   ├── chat.js             # Отправка сообщений к Qwen API, извлечение токенов
│   │   ├── chatHistory.js      # Локальная история чатов
│   │   ├── fileUpload.js       # Загрузка файлов в Qwen OSS
│   │   ├── modelMapping.js     # Маппинг алиасов моделей
│   │   └── tokenManager.js     # Управление токенами, ротация аккаунтов
│   │
│   ├── browser/
│   │   ├── browser.js          # Инициализация Puppeteer, управление контекстом
│   │   ├── auth.js             # Проверка авторизации в браузере
│   │   └── session.js          # Сохранение/загрузка сессий
│   │
│   ├── logger/
│   │   └── index.js            # Winston-логгер с ротацией файлов
│   │
│   └── utils/
│       ├── accountSetup.js     # Интерактивное управление аккаунтами
│       └── prompt.js           # Утилита для интерактивного ввода
│
├── scripts/
│   └── auth.js                 # CLI-скрипт авторизации (npm run auth)
│
├── examples/                   # Примеры использования API
│   ├── openai-sdk/             # Примеры с OpenAI SDK
│   ├── direct-api/             # Примеры с fetch/axios
│   ├── file-upload/            # Пример загрузки файлов
│   ├── python-sdk/             # Python примеры с OpenAI SDK
│   └── python-direct/          # Python примеры с httpx
│
├── session/                    # Данные сессий и аккаунтов (создаётся автоматически)
├── logs/                       # Файлы логов (создаётся автоматически)
└── uploads/                    # Временные файлы загрузки (создаётся автоматически)
```
