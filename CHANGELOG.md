# Changelog - FreeQwenApi Updates

## 🐳 Docker Image

Official Docker image available on Docker Hub:

**https://hub.docker.com/r/endykaufman/qwen-api-proxy**

### Quick Start:

```bash
# Pull image
docker pull endykaufman/qwen-api-proxy:latest

# Run
docker run -d \
  --name qwen-api-proxy \
  -p 3264:3264 \
  -v $(pwd)/session:/app/session \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/uploads:/app/uploads \
  --env-file .env \
  endykaufman/qwen-api-proxy:latest
```

### Features:
- ✅ Multi-platform (linux/amd64, linux/arm64)
- ✅ Auto-updates via GitHub Actions
- ✅ Built-in documentation and metadata
- ✅ Optimized size
- ✅ All dependencies included

---

## [2026-05-31] - Major Telegram Bot Updates

### 🎯 Breaking Changes
- **Removed** per-chat model selection (`session/chat_models.json`)
- **Changed** `/chat` command behavior (now shows status, doesn't toggle)
- **Added** new `/togglechat` command for enabling/disabling LLM

### ✨ New Features

#### 1. LLM Chat Status Command
- `/chat` now displays current LLM chat status
- Shows: enabled/disabled, active model, context message count
- Provides hint to use `/togglechat` for toggling

**Example:**
```
📊 Состояние LLM чата

🔧 Статус: ❌ Выключен
🤖 Модель: qwen3.5-plus
💬 Сообщений в контексте: 0

💡 Используйте /togglechat чтобы включить LLM чат
```

#### 2. Global Model Selection
- Single `activeModel` for all chats
- Stored in `session/bot_settings.json`
- Simplified model management
- Changed via `/setmodel <name>` command

**Settings Structure:**
```json
{
  "activeModel": "qwen3.5-plus",
  "llmChatEnabled": false,
  "lastUpdated": "2026-05-31T12:32:16.526Z"
}
```

#### 3. Improved Model List Display
- All models shown in comma-separated format
- Each model wrapped in individual `<code>` block
- Easy to copy with double-click
- No truncation - shows all available models

**Before:**
```
Доступные модели:
• qwen3.5-plus
• qwen3-max
... и еще 24
```

**After:**
```
Доступные модели:
qwen3.5-plus, qwen3.5-397b-a17b, qwen3-max, qwen3-vl-plus, ...
```

#### 4. AI Health Check on Startup
- Automatic ping-pong test to Qwen API
- Measures response time
- Validates tokens and browser session
- Displays results in startup message

**Example:**
```
🧠 AI Нейросеть: ✅ Работает (модель: qwen3.5-plus, время: 2.34с)
   📝 Ответ: 💬 "pong! How can I assist you today?"
```

#### 5. Repository Info in Status Messages
- Added GitHub links to startup and `/status` messages
- Quick help commands reference
- Direct links to original and forked repositories

**Added to status:**
```
📚 Репозиторий:
🔗 GitHub: https://github.com/EndyKaufman/FreeQwenApi
⭐ Оригинал: https://github.com/y1n7sint/FreeQwenApi

💡 Справка:
📝 Используйте /help для списка команд
🔍 Используйте /status для проверки состояния
🤖 Используйте /chat для включения LLM режима
```

### 🐛 Bug Fixes

1. **Fixed duplicate status messages**
   - `/status` command was sending message twice
   - Now sends only once
   - Added `autoSend` parameter to `checkAllSubsystems()`

2. **Fixed Telegram HTML parsing errors**
   - Escaped all angle brackets `< >` as `&lt; &gt;`
   - Changed error JSON display from `<code>` to `<pre>`
   - Fixed `<name>` and `<название_модели>` tag errors
   - Proper HTML entity escaping for all user-facing messages

3. **Fixed AI health check proxy issue**
   - Changed from localhost self-request to direct Qwen API call
   - Now tests full chain: code → browser → Qwen API → response
   - Uses actual `sendMessage()` function for testing

### 📝 Documentation Updates

- Updated `TELEGRAM_LLM_CHAT_RU.md` with new commands
- Updated `docs/TELEGRAM_LLM_CHAT.md` (English version)
- Created `TELEGRAM_UPDATES.md` - comprehensive update guide
- Created `CHANGELOG.md` - this file

### 🔧 Technical Changes

#### Files Modified:
- `src/utils/telegramBot.js` - Main bot logic
- `src/utils/botSettings.js` - Settings management
- `session/bot_settings.json` - Settings structure changed
- `session/.gitignore` - Removed chat_models.json reference

#### Files Removed:
- `session/chat_models.json` - No longer needed

#### New Functions:
- `showLLMChatStatus()` - Display LLM chat status
- `checkAllSubsystems(autoSend)` - Added autoSend parameter

#### Changed Functions:
- `toggleLLMChat()` - Now only toggles (not bound to `/chat`)
- `handleSetModel()` - Sets global activeModel
- `getModelForChat()` - Returns activeModel or default
- `showModelInfo()` - Shows all models in comma-separated format

### 📊 Command Summary

| Command | Before | After |
|---------|--------|-------|
| `/chat` | Toggle LLM | Show LLM status |
| `/togglechat` | ❌ N/A | Toggle LLM (NEW) |
| `/model` | Show current model | Show all models (enhanced) |
| `/setmodel` | Set per-chat model | Set global model (changed) |
| `/status` | Send twice ✅ | Send once ✅ (fixed) |

### 🎯 Migration Guide

**For existing users:**

1. **Settings migration** - Automatic
   - Old `chat_models.json` data is ignored
   - New `bot_settings.json` structure is used
   - `activeModel` takes precedence

2. **Command changes**:
   - Use `/togglechat` instead of `/chat` to enable/disable LLM
   - Use `/chat` to check current status
   - `/setmodel` now affects all chats globally

3. **Model selection**:
   - Previous per-chat models are no longer used
   - Set global model with `/setmodel <name>`
   - All chats will use the same model

### ✅ Benefits

1. **Simplified management** - One model for all chats
2. **Better visibility** - `/chat` shows current status
3. **Easier copying** - Each model in separate code block
4. **Faster diagnostics** - AI check on startup
5. **Complete docs** - Repository links in status
6. **More reliable** - No duplicate messages
7. **More secure** - Proper HTML escaping

### 📚 Related Documentation

- [TELEGRAM_UPDATES.md](./TELEGRAM_UPDATES.md) - Detailed update guide (Russian)
- [TELEGRAM_LLM_CHAT_RU.md](./TELEGRAM_LLM_CHAT_RU.md) - LLM chat guide (Russian)
- [docs/TELEGRAM_LLM_CHAT.md](./docs/TELEGRAM_LLM_CHAT.md) - LLM chat guide (English)
- [README.md](./README.md) - Main documentation
