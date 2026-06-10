# `/archive` Command - Session Archive Creation Guide

## Overview

The `/archive` command provides cross-platform instructions for users to create a session archive with Qwen authentication that can be uploaded to the Docker Telegram bot.

## What It Does

When a user sends `/archive` to the Telegram bot, they receive comprehensive step-by-step instructions for:

1. **Installing Node.js** (Windows, macOS, Linux)
2. **Downloading the project** (git clone or ZIP)
3. **Creating a session archive** (automated via `npm run create-session-archive`)
4. **Uploading to Telegram bot** (proper file upload method)

## Command Usage

```
/archive
```

## Response Content

The bot sends a detailed message with:

### 🔹 Step 1: Node.js Installation
- **Windows**: Download from nodejs.org
- **macOS**: `brew install node`
- **Linux**: apt commands for Ubuntu/Debian

### 🔹 Step 2: Project Download
```bash
git clone https://github.com/EndyKaufman/FreeQwenApi
cd FreeQwenApi
npm install
```

### 🔹 Step 3: Create Session Archive
```bash
npm run create-session-archive
```

This will:
1. Open a browser
2. Wait for user to login to Qwen
3. Save session (token + cookies)
4. Create a ZIP archive

### 🔹 Step 4: Upload to Telegram Bot
1. Open the bot
2. Click 📎 (paperclip)
3. Select **"File"** (NOT "Photo"!)
4. Choose `session_backup_*.zip`
5. Send and wait for confirmation

## Archive Structure

The created archive contains:
```
session/
├── accounts/
│   ├── acc_123456/
│   │   ├── token.txt
│   │   └── cookies.json  ← Required!
│   └── acc_789012/
│       ├── token.txt
│       └── cookies.json  ← Required!
└── tokens.json
```

## Key Points

✅ **Cross-platform**: Works on Windows, macOS, and Linux  
✅ **User-friendly**: Step-by-step instructions with code examples  
✅ **HTML formatted**: Uses proper `<code>` and `<pre>` tags for Telegram  
✅ **Complete**: Includes alternative methods and troubleshooting  
✅ **Security aware**: Emphasizes cookies.json requirement  

## Related Commands

- `/setup` - Local session setup instructions
- `/connect` - How to connect to the project
- `/help` - Show all available commands
- `/status` - Check service status

## Implementation Details

**Location**: `src/utils/telegramBot.js`

**Function**: `sendArchiveInstructions(chatId)`

**Added to help**: Yes, in the "Загрузка сессий" section

## Why This Command?

Users running Docker instances need an easy way to:
1. Create authenticated sessions on their local machine
2. Upload them to the Docker bot
3. Start using the service without local Node.js setup

The `/archive` command bridges this gap by providing clear, platform-specific instructions.

## Example Bot Response

```
📦 Создание архива сессии для Docker

Эта инструкция поможет создать архив с авторизацией
для последующей загрузки в Telegram бота.

🔹 Шаг 1: Установка Node.js

Windows:
• Скачайте с nodejs.org
• Установите (галочка "Add to PATH")

macOS:
• brew install node
• Или скачайте с nodejs.org

... (full instructions continue)
```

## Maintenance Notes

- Keep Node.js installation instructions up-to-date
- Verify GitHub URLs are correct
- Ensure code examples use proper HTML tags
- Update if archive creation process changes
