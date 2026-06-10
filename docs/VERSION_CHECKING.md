# Автоматическая проверка обновлений

## Обзор

Приложение может автоматически проверять наличие новых версий и уведомлять вас через Telegram и в консоли.

## Как это работает

### Режимы проверки

Приложение определяет режим запуска и проверяет соответствующий источник:

| Режим | Источник проверки | Описание |
|-------|------------------|----------|
| **Docker** | Docker Hub | Проверяет теги образа `endykaufman/qwen-api-proxy` |
| **npm** | npm registry | Проверяет пакет `qwen-api-proxy` |
| **Git** | GitHub Releases | Проверяет репозиторий `EndyKaufman/FreeQwenApi` |

### Автоматическое определение режима

- **Docker**: Если существует файл `/.dockerenv`
- **npm**: Если установлена переменная окружения `QWEN_API_PROXY_GLOBAL=true`
- **Git**: Во всех остальных случаях (запуск из исходного кода)

## Настройка

### Включение проверки

Проверка обновлений **включена по умолчанию**. 

Чтобы отключить, добавьте в `.env` файл:

```env
ENABLE_VERSION_CHECK=false
```

### Настройка прокси (опционально)

Если для доступа к Docker Hub, npm registry или GitHub требуется прокси:

```env
VERSION_CHECK_PROXY=http://proxy.example.com:8080
# или с авторизацией
VERSION_CHECK_PROXY=http://username:password@proxy.example.com:8080
# или SOCKS
VERSION_CHECK_PROXY=socks5://proxy.example.com:1080
```

Поддерживаемые протоколы: HTTP, HTTPS, SOCKS4, SOCKS5

### Частота проверки

- **Проверка**: Каждый час (60 минут)
- **Telegram уведомления**: Раз в сутки в дневное время (10:00 - 18:00)
- **Консоль**: При каждом обнаружении обновления

## Что проверяется

### Docker Hub

```
https://hub.docker.com/v2/repositories/endykaufman/qwen-api-proxy/tags/
```

- Ищет последний стабильный тег (исключая `latest`)
- Сортирует по дате обновления

### npm Registry

```
https://registry.npmjs.org/qwen-api-proxy/latest
```

- Получает информацию о последней опубликованной версии

### GitHub Releases

```
https://raw.githubusercontent.com/EndyKaufman/FreeQwenApi/main/package.json
https://api.github.com/repos/EndyKaufman/FreeQwenApi/commits/main
```

- Читает версию из `package.json` в ветке `main`
- Получает дату последнего коммита для информации

## Уведомления

### Консоль

При обнаружении обновления:

```
🔍 Проверка обновлений (режим: docker, текущая версия: 1.0.18)...
📦 Доступна новая версия: 1.0.18 (текущая: 1.0.18)
📅 Опубликована: 10.06.2026, 14:30 (2 ч. назад)
🔗 Режим: docker
```

### Telegram

Пример уведомления:

```
📦 Доступно обновление!

🔹 Текущая версия: 1.0.18
🔹 Новая версия: 1.0.18
📅 Опубликована: 10.06.2026, 14:30
🕐 2 ч. назад

🔗 Режим запуска: docker
```

### Заголовок при запуске

При включенной проверке обновлений, в заголовке отображается версия:

```
🚀 Сервис запущен! v1.0.18
```

Если доступно обновление:

```
🚀 Сервис запущен! v1.0.18 (доступна v1.0.18)
```

### Статус в Telegram

Команда `/status` также показывает информацию о версии:

```
🚀 Сервис запущен! v1.0.18

🔑 Основные компоненты:
...

📦 Версия:
Текущая: v1.0.18
Режим: docker
Доступна: v1.0.18 (опубликована: 10.06.2026, 14:30)
```

## Обработка ошибок

**Важно**: Ошибки при проверке версий **НЕ** приводят к падению приложения и **НЕ** отправляются в Telegram.

Ошибки только логируются в консоль с уровнем `error`:

```
Ошибка проверки версии Docker Hub
Ошибка при проверке обновлений
```

Это гарантирует стабильность работы даже при проблемах с сетью или доступностью внешних сервисов.

## Примеры использования

### Docker Compose

```yaml
version: '3.8'

services:
  qwen-api-proxy:
    image: endykaufman/qwen-api-proxy:latest
    environment:
      - ENABLE_VERSION_CHECK=true
      - TELEGRAM_BOT_TOKEN=your_token
      - TELEGRAM_USER_IDS=your_user_id
    volumes:
      - ./session:/app/session
      - ./logs:/app/logs
    ports:
      - "3264:3264"
```

### npm (global installation)

```bash
# Установка
npm install -g qwen-api-proxy

# Запуск с проверкой обновлений
ENABLE_VERSION_CHECK=true qwen-api-proxy
```

### Запуск из исходного кода

```bash
# Клонируем репозиторий
git clone https://github.com/EndyKaufman/FreeQwenApi.git
cd FreeQwenApi

# Создаем .env файл
cat > .env << EOF
ENABLE_VERSION_CHECK=true
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_USER_IDS=your_user_id
EOF

# Запускаем
npm start
```

## Отключение проверки

Чтобы отключить проверку обновлений:

1. Добавьте строку в `.env`:
   ```env
   ENABLE_VERSION_CHECK=false
   ```

2. Перезапустите приложение

## Технические детали

### Файлы

- `src/utils/versionChecker.js` - Основная логика проверки версий
- `src/config.js` - Конфигурация `ENABLE_VERSION_CHECK`
- `index.js` - Интеграция проверки при запуске

### API Endpoint'ы

| Сервис | URL | Метод |
|--------|-----|-------|
| Docker Hub | `https://hub.docker.com/v2/repositories/endykaufman/qwen-api-proxy/tags/` | GET |
| npm Registry | `https://registry.npmjs.org/qwen-api-proxy/latest` | GET |
| GitHub | `https://raw.githubusercontent.com/EndyKaufman/FreeQwenApi/main/package.json` | GET |
| GitHub Commits | `https://api.github.com/repos/EndyKaufman/FreeQwenApi/commits/main` | GET |

### Ограничения

- **Rate limiting**: GitHub API имеет ограничение 60 запросов в час для неаутентифицированных запросов
- **Сеть**: Требуется доступ к интернету для проверки версий
- **Время уведомления**: Telegram уведомления отправляются только с 10:00 до 18:00

## Устранение проблем

### Проверка не работает

1. Проверьте что `ENABLE_VERSION_CHECK` не установлен в `false` в `.env`
2. Проверьте доступность интернета из контейнера/сервера
3. Проверьте логи на наличие ошибок:
   ```bash
   docker compose logs | grep -i version
   ```

### Telegram уведомления не приходят

1. Убедитесь что настроены `TELEGRAM_BOT_TOKEN` и `TELEGRAM_USER_IDS`
2. Проверьте что прошло 24 часа с последнего уведомления
3. Проверьте что сейчас дневное время (10:00 - 18:00)

### Ошибки в логах

Ошибки проверки версий безопасны и не влияют на работу приложения:

```
Ошибка проверки версии Docker Hub
Ошибка при проверке обновлений
```

Если видите эти ошибки часто, проверьте:
- Доступность Docker Hub/npm/GitHub
- Настройки прокси (если используете)
- DNS разрешение

## Дополнительные возможности

### Ручная проверка

В будущих версиях планируется команда `/checkupdates` для ручной проверки обновлений через Telegram.

### Автоматическое обновление

Автоматическое обновление **не** реализовано и не планируется по причинам безопасности. Обновление должно выполняться вручную администратором.

## Безопасность

- Проверка версий только **читает** информацию из внешних источников
- **Не** выполняется автоматическая загрузка или установка обновлений
- **Не** передаются никакие данные о вашей системе
- Все запросы используют HTTPS

## См. также

- [TELEGRAM_BOT_FLOW.md](./TELEGRAM_BOT_FLOW.md) - Описание работы Telegram бота
- [ENV_SETUP.md](./ENV_SETUP.md) - Настройка переменных окружения
- [README.md](../README.md) - Основная документация
