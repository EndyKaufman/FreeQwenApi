# Session Archive Creator

## 🎯 Overview

A convenient console command that automates the entire process of:
1. Opening a browser for Qwen authentication
2. Waiting for you to log in
3. Saving the session automatically
4. Creating a ZIP archive ready for Telegram bot upload

## 🚀 Quick Start

### Using npm script (Recommended)

```bash
npm run create-session-archive
```

### Using node directly

```bash
npx qwen-api-proxy archive
```

## 📋 What It Does

### Step 1: Open Browser
- Launches Puppeteer browser with stealth mode
- Opens Qwen login page

### Step 2: Authentication
- You log in via GitHub or other methods
- Script waits for you to complete login
- Press ENTER in console when ready

### Step 3: Save Session
- Automatically extracts authentication token
- Saves cookies to `session/cookies.json`
- Saves token to `session/accounts/acc_TIMESTAMP/token.txt`
- Updates `session/tokens.json`

### Step 4: Create Archive
- Creates ZIP archive: `session_backup_YYYY-MM-DDTHH-MM-SS.zip`
- Includes entire `session/` folder
- Shows archive path and size

## 💡 Usage Example

```bash
$ npm run create-session-archive

╔══════════════════════════════════════════════════════════╗
║           Session Archive Creator                        ║
║                                                          ║
║  This script will:                                       ║
║  1. Open browser for authentication                      ║
║  2. Save session after login                             ║
║  3. Create ZIP archive of session folder                 ║
╚══════════════════════════════════════════════════════════╝

🌐 Шаг 1/4: Открытие браузера...
✅ Браузер открыт

🔐 Шаг 2/4: Авторизация...

────────────────────────────────────────────────────────────
📋 ИНСТРУКЦИЯ:
   1. Войдите в систему через GitHub или другой способ
   2. Дождитесь полной загрузки главной страницы
   3. Вернитесь в консоль и нажмите ENTER
────────────────────────────────────────────────────────────

👉 Нажмите ENTER после успешной авторизации... [press ENTER]

💾 Шаг 3/4: Сохранение сессии...
✅ Сессия сохранена: acc_1718123456789
✅ Браузер закрыт

📦 Шаг 4/4: Создание архива...

📦 Создание архива сессии...
  adding: session/ (stored 0%)
  adding: session/accounts/ (stored 0%)
  adding: session/accounts/acc_1718123456789/ (stored 0%)
  adding: session/accounts/acc_1718123456789/token.txt (deflated 15%)
  adding: session/cookies.json (deflated 72%)
  adding: session/tokens.json (deflated 25%)

✅ Архив успешно создан!
📍 Путь: /home/user/FreeQwenApi/session_backup_2026-06-09T14-30-45-123Z.zip
📏 Размер: 0.15 MB

════════════════════════════════════════════════════════════
🎉 ГОТОВО!
════════════════════════════════════════════════════════════

📄 Архив: /home/user/FreeQwenApi/session_backup_2026-06-09T14-30-45-123Z.zip

📱 Следующие шаги:
   1. Откройте Telegram бота
   2. Нажмите 📎 (скрепка)
   3. Выберите "Файл" (НЕ "Фото"!)
   4. Отправьте архив боту
   5. Дождитесь подтверждения

✨ Успехов!
```

## 📦 Archive Structure

The created archive has the correct structure for Telegram bot upload:

```
session_backup_TIMESTAMP.zip
└── session/
    ├── accounts/
    │   └── acc_TIMESTAMP/
    │       └── token.txt
    ├── cookies.json
    ├── tokens.json
    └── auth_token.txt
```

## 🔄 Workflow

### Local Session Creation
```bash
# 1. Create session archive
npm run create-session-archive

# 2. Archive is created in project root
ls -la session_backup_*.zip
```

### Upload to Server via Telegram
```bash
# 3. Send archive to your Telegram bot
#    (via mobile or desktop Telegram app)

# 4. Bot will:
#    - Download archive
#    - Extract to session/
#    - Restart service
#    - Load new sessions
```

## ⚙️ Requirements

- **Node.js**: v23.11.1 or higher
- **npm**: Package manager
- **zip**: Command-line zip utility
  ```bash
  # Ubuntu/Debian
  sudo apt-get install zip
  
  # macOS
  brew install zip
  
  # Windows (Git Bash)
  # Usually included with Git for Windows
  ```

## 🛠️ Troubleshooting

### "zip command not found"
Install zip utility:
```bash
sudo apt-get install zip  # Linux
brew install zip          # macOS
```

### Browser doesn't open
Check Puppeteer installation:
```bash
npm install
```

### Session folder is empty
Make sure you completed authentication in the browser before pressing ENTER.

### Archive creation fails
- Check write permissions in project directory
- Ensure session folder has content
- Verify zip is installed

## 📝 Notes

- **Timestamp in filename**: Each archive has a unique timestamp to prevent overwrites
- **Safe to run multiple times**: Each run creates a new archive
- **Browser closes automatically**: After session is saved
- **No manual file operations needed**: Everything is automated

## 🔗 Related Documentation

- [Telegram Session Upload (Russian)](../TELEGRAM_SESSION_UPLOAD_RU.md)
- [Telegram Bot Flow](../docs/TELEGRAM_BOT_FLOW.md)
- [Archive Processing Flow](../ARCHIVE_PROCESSING_FLOW.md)

## ✨ Benefits

1. **All-in-one command**: No need to run separate commands
2. **Guided process**: Clear instructions at each step
3. **Automatic archiving**: ZIP created immediately
4. **Correct structure**: Archive is always properly formatted
5. **Ready for upload**: Just send to Telegram bot

## 🎉 Done!

Now you can easily create session archives with a single command!
