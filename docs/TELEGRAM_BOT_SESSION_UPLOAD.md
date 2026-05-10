# Telegram Bot - Session Upload & Management

## 🤖 Overview

The Telegram bot now supports:
- **Receive session archives** (ZIP/7z) and extract them
- **Automatic service restart** after session update
- **Status monitoring** and management commands
- **Token expiry notifications** (previously implemented)

## 📋 Features

### 1. Session Archive Upload
Send a ZIP or 7z archive containing a `session` folder to update all session data.

### 2. Management Commands
- `/start` or `/help` - Show available commands
- `/status` - Show current service status
- `/restart` - Restart the service

### 3. Automatic Restart
After extracting a session archive, the service automatically restarts to load the new sessions.

## 🔧 Setup

### 1. Configure Environment Variables

Add to your `.env` file:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_USER_IDS=your_user_id_from_userinfobot

# Optional: Token expiry warning (default: 1 hour)
TOKEN_EXPIRY_WARNING_MS=3600000
```

### 2. Build and Start

```bash
# Build with new dependencies (adm-zip, p7zip)
docker-compose build

# Start the service
docker-compose up -d
```

## 📦 Creating Session Archive

### Option 1: ZIP Archive

```bash
# Create a ZIP with session folder
zip -r session_backup.zip session/
```

**Structure should be:**
```
session_backup.zip
└── session/
    ├── accounts/
    │   ├── acc_1234567890/
    │   │   ├── cookies.json
    │   │   └── token.txt
    │   └── acc_0987654321/
    │       └── ...
    ├── tokens.json
    └── auth_token.txt
```

### Option 2: 7z Archive

```bash
# Create a 7z archive with session folder
7z a session_backup.7z session/
```

## 📱 How to Upload

### Step-by-Step:

1. **Open Telegram** and find your bot
2. **Send the archive** (ZIP or 7z) as a document
3. **Bot will respond:**
   - ✅ "File uploaded. Extracting..."
   - ✅ "Archive successfully extracted!"
   - 🔄 "Service will restart..."
4. **Service restarts automatically** (takes ~3-5 seconds)
5. **New sessions are loaded** and ready to use

### File Limits:
- **Maximum size:** 50MB
- **Supported formats:** `.zip`, `.7z`
- **Required structure:** Must contain `session/` folder

## 💬 Bot Commands

### /help or /start
Shows help message with all available commands.

```
🤖 FreeQwenApi Bot - Management

📋 Available commands:
/help - Show this message
/status - Show service status
/restart - Restart service

📦 Session upload:
Send a ZIP or 7z archive with "session" folder inside.
Bot will extract it and restart the service.

📏 Limits:
• Maximum file size: 50MB
• Supported formats: .zip, .7z
```

### /status
Shows current service status:

```
📊 FreeQwenApi Status

👥 Accounts: 3
🎫 Tokens: 3
📂 Session folder: ✅

🟢 Service is running
```

### /restart
Manually restart the service:

```
🔄 Restarting service...
⏱️ Service will restart within 5 seconds
```

## 🔄 Restart Mechanism

### How It Works:

1. **Archive received** → Extracted to `session/` folder
2. **Restart flag created** → `.restart_flag` file
3. **Process exits** with code 42
4. **Startup script catches** exit code 42
5. **Service restarts** automatically (3 second delay)
6. **Flag file removed** → New sessions loaded

### Exit Codes:
- `0` - Normal shutdown
- `42` - Session update restart
- `130` - SIGINT (Ctrl+C)
- `143` - SIGTERM
- Other - Error (auto-restart after 5s)

## 📊 Monitoring

### Check Logs:

```bash
# View bot logs
docker-compose logs -f | grep -i telegram

# View restart events
docker-compose logs -f | grep -i restart

# View session extraction
docker-compose logs -f | grep -i "архив\|archive\|extract"
```

### Log Messages:

```
🤖 Запуск Telegram бота...
✅ Telegram бот запущен: @your_bot_name
📦 Получен файл: session_backup.zip (1234567 bytes)
✅ Файл сохранен: /app/temp/session_backup.zip
✅ ZIP архив успешно распакован
🔄 Запуск корректного перезапуска сервиса...
🛑 Завершение работы для перезапуска Docker Compose...
🔄 Обнаружен флаг перезапуска: telegram_session_update
```

## 🛡️ Security

### Access Control:
- Only users in `TELEGRAM_USER_IDS` can interact with the bot
- Unauthorized users receive: "❌ You don't have access to this bot"

### File Validation:
- File extension check (only `.zip`, `.7z`)
- File size limit (50MB max)
- Structure validation (must contain `session/` folder)

### Safe Extraction:
- Only extracts files from `session/` folder
- Creates directories as needed
- Overwrites existing session data

## 🐛 Troubleshooting

### Bot Not Starting?

**Check:**
```bash
# Verify environment variables
docker-compose config | grep TELEGRAM

# Check logs
docker-compose logs | grep -i telegram
```

**Solutions:**
1. Ensure `TELEGRAM_BOT_TOKEN` is correct
2. Verify bot is not blocked
3. Check network connectivity to Telegram API

### Archive Extraction Failed?

**Common errors:**

1. **"Archive doesn't contain session folder"**
   - Solution: Ensure ZIP/7z has `session/` as root folder
   - Correct: `session_backup.zip/session/accounts/...`
   - Wrong: `session_backup.zip/accounts/...`

2. **"p7zip not installed"** (for .7z files)
   - Solution: Already included in Dockerfile
   - Rebuild: `docker-compose build`

3. **"File too large"**
   - Solution: Compress more or split archive
   - Limit: 50MB

### Service Not Restarting?

**Check:**
```bash
# Check if restart flag exists
docker-compose exec qwen-proxy ls -la /app/.restart_flag

# Manual restart
docker-compose restart
```

**Solutions:**
1. Check startup script is running: `docker-compose exec qwen-proxy ps aux`
2. Verify exit code in logs
3. Manual restart if needed

### Sessions Not Loading?

**Check:**
```bash
# Verify session structure
docker-compose exec qwen-proxy ls -la /app/session/
docker-compose exec qwen-proxy ls -la /app/session/accounts/

# Check tokens
docker-compose exec qwen-proxy cat /app/session/tokens.json
```

## 📝 Example Workflow

### Updating Sessions:

1. **Backup current sessions:**
   ```bash
   zip -r session_backup_$(date +%Y%m%d).zip session/
   ```

2. **Prepare new sessions:**
   - Copy new session data to `session/` folder
   - Or use existing backup

3. **Send to bot:**
   - Open Telegram
   - Select bot
   - Attach file (as document)
   - Send

4. **Wait for restart:**
   - Bot confirms extraction
   - Service restarts (~5 seconds)
   - New sessions active

5. **Verify:**
   ```bash
   # Check status
   curl http://localhost:3264/api/status
   
   # Or use /status command in Telegram
   ```

## 🔐 Best Practices

1. **Always backup** before uploading new sessions
2. **Test with small archives** first
3. **Monitor logs** during first few uploads
4. **Keep archives under 30MB** for faster processing
5. **Use ZIP format** (more universal than 7z)

## 📚 Architecture

### Components:

```
Telegram User
    ↓ (sends ZIP/7z)
Telegram Bot (polling)
    ↓ (downloads file)
Archive Extractor
    ↓ (extracts to session/)
Restart Manager
    ↓ (creates flag + exit 42)
Startup Script
    ↓ (catches exit code)
Service Restart
    ↓ (loads new sessions)
Ready ✅
```

### Files Involved:

- `src/utils/telegramBot.js` - Bot implementation
- `start-with-restart.sh` - Restart loop script
- `Dockerfile` - Includes p7zip, uses startup script
- `docker-compose.yml` - Environment variables

## 🎯 Summary

The Telegram bot now provides:
- ✅ **Remote session management** via archive upload
- ✅ **Automatic service restart** after updates
- ✅ **Status monitoring** and commands
- ✅ **Token expiry notifications**
- ✅ **Secure access control**
- ✅ **Safe file extraction**

All configured and ready to use! 🚀
