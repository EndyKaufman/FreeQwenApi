# Telegram Bot - Complete Feature Set

## ✅ Implemented Features

### 1. Telegram Bot with File Upload Support
- **Receive ZIP/7z archives** containing session data
- **Automatic extraction** to the `session/` directory
- **Service restart** after session update
- **Access control** - only authorized users can interact

### 2. LLM Chat & AI Assistant
- **Direct AI conversation** through Telegram
- **Context management** (up to 20 messages)
- **Dynamic model selection** without restart
- **System message support** for custom behavior

### 3. Image Generation
- **Text-to-Image**: Generate images from text prompts
- **Image-to-Image**: Send photo with caption to transform
- **Dual-mode backend**: Qwen Image API + DashScope API
- **Progress notifications** during generation

### 4. Qwen LLM Proxy
- **Proxy API requests** through Telegram bot
- **Model routing** to available Qwen models
- **Rate limit handling** with smart fallback

### 5. Management Commands
- `/help` - Show available commands
- `/status` - Display comprehensive service status
- `/chat` - Show LLM chat status
- `/togglechat` - Enable/disable LLM chat mode
- `/model` - Show/set active model
- `/clear` - Clear conversation context
- `/restart` - Manually restart the service

### 6. Health Monitoring & Automation
- **Startup health check** with AI ping-pong test
- **Periodic checks** every 4 hours
- **Token expiry warnings** with countdown
- **Rate limit intelligence** (separate for chat vs media)
- **Automatic account rotation** on errors

## 📁 Files Created

### New Files:
1. **`src/utils/telegramBot.js`** (497 lines)
   - Full Telegram bot implementation
   - File download and extraction
   - Command handling
   - Restart mechanism

2. **`start-with-restart.sh`** (47 lines)
   - Startup wrapper script
   - Exit code monitoring
   - Automatic restart on code 42

3. **`docs/TELEGRAM_BOT_SESSION_UPLOAD.md`** (343 lines)
   - Complete English documentation
   - Setup guide
   - Troubleshooting

4. **`TELEGRAM_SESSION_UPLOAD_RU.md`** (256 lines)
   - Russian quick start guide
   - Usage examples

### Modified Files:
1. **`package.json`**
   - Added `adm-zip` dependency for ZIP extraction

2. **`Dockerfile`**
   - Added `p7zip` package for .7z support
   - Changed CMD to use startup script

3. **`index.js`**
   - Added Telegram bot startup
   - Added restart flag detection
   - Added bot shutdown handling

4. **`docker-compose.yml`**
   - Added Telegram environment variables
   - Configured restart policy

5. **`.dockerignore`**
   - Excluded startup script from ignore list

6. **`.env.example`**
   - Updated with Telegram bot configuration

## 🔧 Technical Implementation

### Archive Processing Flow:

```
User sends ZIP/7z to Telegram bot
         ↓
Bot receives update with document
         ↓
Validates file (extension, size)
         ↓
Downloads file from Telegram servers
         ↓
Saves to /app/temp/
         ↓
Extracts archive:
  - ZIP: Uses adm-zip library
  - 7z: Uses p7zip command-line
         ↓
Verifies session/ folder exists
         ↓
Extracts to /app/session/
         ↓
Creates .restart_flag file
         ↓
Sends confirmation to user
         ↓
Exits with code 42
         ↓
start-with-restart.sh catches code 42
         ↓
Waits 3 seconds
         ↓
Restarts node index.js
         ↓
New sessions loaded ✅
```

### Exit Code Handling:

```bash
0    - Normal shutdown
42   - Session update restart (triggered by bot)
130  - SIGINT (Ctrl+C)
143  - SIGTERM
Other - Error (restart after 5s)
```

## 📦 Dependencies Added

### npm packages:
- **adm-zip** (v0.5.10) - ZIP archive extraction

### System packages (Alpine):
- **p7zip** - 7z archive extraction

## 🔐 Security Features

1. **User Authorization**
   - Only `TELEGRAM_USER_IDS` can interact
   - Unauthorized users blocked

2. **File Validation**
   - Extension check (.zip, .7z only)
   - Size limit (50MB max)
   - Structure validation (session/ required)

3. **Safe Extraction**
   - Only extracts from session/ folder
   - Creates directories safely
   - No path traversal vulnerabilities

## 📊 Configuration

### Environment Variables:

```bash
# Required for bot functionality
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_USER_IDS=user_id_1,user_id_2

# Optional
TOKEN_EXPIRY_WARNING_MS=3600000  # 1 hour default
```

### Docker Compose:

```yaml
environment:
  - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
  - TELEGRAM_USER_IDS=${TELEGRAM_USER_IDS:-}
  - TOKEN_EXPIRY_WARNING_MS=${TOKEN_EXPIRY_WARNING_MS:-3600000}
```

## 🎯 Usage Examples

### Creating Session Archive:

```bash
# ZIP format
zip -r session_backup.zip session/

# 7z format
7z a session_backup.7z session/
```

### Uploading to Bot:

1. Open Telegram bot
2. Click 📎 (attach)
3. Select **File** (not photo)
4. Choose archive
5. Send

### Bot Response:

```
⏳ Loading file session_backup.zip...
✅ File uploaded. Extracting...
✅ Archive successfully extracted!

📂 Session folder updated
🔄 Service will restart...
```

### Checking Status:

```bash
# Via API
curl http://localhost:3264/api/status

# Via Telegram
/send /status command
```

## 📝 Logging

### Key Log Messages:

```
🤖 Запуск Telegram бота...
✅ Telegram бот запущен: @bot_username
📦 Получен файл: session.zip (123456 bytes)
✅ Файл сохранен: /app/temp/session.zip
✅ ZIP архив успешно распакован
🔄 Запуск корректного перезапуска сервиса...
🛑 Завершение работы для перезапуска Docker Compose...
🔄 Обнаружен флаг перезапуска: telegram_session_update
🤖 Telegram бот запущен и готов принимать команды
```

### Monitoring Commands:

```bash
# Watch bot activity
docker-compose logs -f | grep -i telegram

# Watch restarts
docker-compose logs -f | grep -i restart

# Watch extraction
docker-compose logs -f | grep -i "архив\|extract"
```

## 🐛 Troubleshooting

### Bot Not Starting:

**Check:**
```bash
docker-compose config | grep TELEGRAM
docker-compose logs | grep telegram
```

**Fix:**
- Verify `TELEGRAM_BOT_TOKEN` is correct
- Ensure network access to Telegram API

### Archive Extraction Fails:

**Error: "Archive doesn't contain session folder"**

**Fix:**
```bash
# Correct structure:
zip -r backup.zip session/  # ✅

# Wrong structure:
cd session && zip -r ../backup.zip *  # ❌
```

### Service Not Restarting:

**Manual restart:**
```bash
docker-compose restart
```

**Check startup script:**
```bash
docker-compose exec qwen-proxy ps aux
```

## 🔄 Complete Workflow

### Scenario: Remote Session Update

1. **Prepare sessions on local machine:**
   ```bash
   zip -r new_sessions.zip session/
   ```

2. **Send to Telegram bot:**
   - Open bot chat
   - Attach file
   - Send

3. **Bot processes:**
   - Downloads archive
   - Validates structure
   - Extracts to session/
   - Triggers restart

4. **Service restarts:**
   - Exits with code 42
   - Startup script catches it
   - Restarts after 3 seconds
   - Loads new sessions

5. **Verify:**
   ```bash
   curl http://server:3264/api/status
   ```

6. **Done!** ✅

## 📚 Documentation Files

1. **`docs/TELEGRAM_BOT_SESSION_UPLOAD.md`** - Full English guide
2. **`TELEGRAM_SESSION_UPLOAD_RU.md`** - Russian quick start
3. **`docs/TOKEN_EXPIRY_CHECKING.md`** - Token expiry feature
4. **`TELEGRAM_SETUP_RU.md`** - Telegram setup (Russian)
5. **`TOKEN_EXPIRY_FEATURE.md`** - Token expiry overview

## 🎉 Features Summary

### Telegram Bot Capabilities:

✅ **File Upload**
- Receive ZIP/7z archives
- Automatic extraction
- Safe session update

✅ **Management Commands**
- /help - Show commands
- /status - Service status
- /restart - Manual restart

✅ **Automatic Restart**
- Graceful shutdown
- Exit code 42 handling
- Clean restart cycle

✅ **Security**
- User authorization
- File validation
- Safe extraction

✅ **Notifications**
- Token expiry alerts
- Status updates
- Error reporting

## 🚀 Deployment

### Build and Start:

```bash
# Build with new dependencies
docker-compose build

# Start service
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Verify Bot:

```bash
# Send /status command in Telegram
# Should respond with service stats
```

## 📊 Architecture

```
┌─────────────────┐
│  Telegram User  │
└────────┬────────┘
         │ sends ZIP/7z
         ↓
┌─────────────────┐
│  Telegram Bot   │ ← Polling loop
│  (telegramBot.js)│
└────────┬────────┘
         │ downloads & extracts
         ↓
┌─────────────────┐
│   /app/session/ │ ← Updated
└────────┬────────┘
         │ creates flag + exit 42
         ↓
┌─────────────────┐
│ startup script  │ ← Catches code 42
│ (restart loop)  │
└────────┬────────┘
         │ restarts after 3s
         ↓
┌─────────────────┐
│  node index.js  │ ← Loads new sessions
└─────────────────┘
```

## ✨ Benefits

1. **Remote Management** - Update sessions from anywhere via Telegram
2. **Zero Downtime** - Automatic restart with minimal interruption
3. **Safe Updates** - Validated extraction, no manual SSH needed
4. **User Friendly** - Simple drag-and-drop in Telegram
5. **Secure** - Access control and file validation
6. **Reliable** - Automatic restart on failures

## 🎯 Next Steps

1. **Configure Telegram:**
   - Create bot via @BotFather
   - Get User ID from @userinfobot
   - Add to `.env`

2. **Build & Start:**
   ```bash
   docker-compose build
   docker-compose up -d
   ```

3. **Test:**
   - Send `/status` command
   - Upload small test archive
   - Verify restart works

4. **Monitor:**
   - Watch logs during first upload
   - Check session structure after extraction

## 📝 Notes

- **Archive Structure:** Must have `session/` as root folder
- **File Size:** Keep under 30MB for faster uploads
- **Format:** ZIP is more universal than 7z
- **Restart Time:** ~5 seconds total downtime
- **Bot Polling:** 30-second timeout for updates

## ✅ Complete!

The Telegram bot session upload feature is fully implemented and ready to use!

All components integrated:
- ✅ Bot with file handling
- ✅ Archive extraction (ZIP + 7z)
- ✅ Automatic restart mechanism
- ✅ Security & validation
- ✅ Comprehensive documentation
- ✅ Docker integration

**Ready for deployment! 🚀**
