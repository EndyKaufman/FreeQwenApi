# 🚀 Quick Start Guide for New Users

## Common Mistake: Running `archive` Before Adding Account

❌ **OLD BEHAVIOR** (This would create an empty 0 MB archive):
```bash
npx qwen-api-proxy archive  # ERROR: No session data yet!
```

✅ **NEW BEHAVIOR** (Smart - will offer to add account automatically!):
```bash
npx qwen-api-proxy archive  # Smart: detects no account, offers to add one!
```

When you run `archive` without an account, it will:
1. ✅ Detect that no accounts exist
2. ✅ Offer to add an account now (opens browser)
3. ✅ Or use Telegram bot
4. ✅ Or exit gracefully
5. ✅ After adding account → automatically creates archive!

---

## Step-by-Step Guide for First-Time Users

### Option A: Smart Archive Command (Recommended for Beginners)

**Just run one command:**
```bash
npx qwen-api-proxy archive
```

**What happens:**
1. ✅ Detects no accounts exist
2. ✅ Asks: "Add account now? (1/2/3)"
3. ✅ You press Enter (default = 1)
4. ✅ Browser opens → Login to Qwen → Press ENTER
5. ✅ Account saved automatically
6. ✅ Archive created automatically with your session data!

**That's it! One command does everything!** 🎉

---

### Option B: Manual Step-by-Step (Traditional Way)

### Step 1: Initialize Working Directory

```bash
# Using npx (no installation required)
npx qwen-api-proxy init

# OR using global installation
npm install -g qwen-api-proxy
qwen-api-proxy init
```

This creates the necessary directory structure:
```
your-directory/
├── session/
│   ├── accounts/
│   └── history/
├── logs/
├── uploads/
├── temp/
├── .env
└── .gitignore
```

### Step 2: Add Your First Account (This Opens Browser)

```bash
# Start the server - this will open Chrome for authentication
npx qwen-api-proxy
```

You will see a menu:

```
Список аккаунтов:
  (пусто)

=== Меню ===
1 - Добавить новый аккаунт
2 - Перелогинить аккаунт с истекшим токеном
3 - Запустить прокси (по умолчанию)
4 - Удалить аккаунт

Ваш выбор (Enter = 3): 
```

**Type `1` and press Enter**

#### What Happens Next:

1. ✅ **Chrome browser opens** (Puppeteer downloads Chromium automatically on first run)
2. ✅ **Qwen login page appears** - login with your credentials
3. ✅ **Wait for page to fully load** after login
4. ✅ **Move mouse naturally** (anti-bot detection)
5. ✅ **Return to console and press ENTER**

```
------------------------------------------------------
               НЕОБХОДИМА АВТОРИЗАЦИЯ
------------------------------------------------------
Пожалуйста, выполните следующие действия:
1. Войдите в систему в открытом браузере
2. ВАЖНО: Двигайте мышью естественно, не спешите
3. Если появится слайдер капчи - решите её медленно
4. Дождитесь полной загрузки главной страницы
5. После успешной авторизации нажмите ENTER в консоли
------------------------------------------------------
```

After pressing ENTER, the session will be saved automatically.

### Step 3: Create Archive (Now It Will Have Data!)

```bash
# Now you can create an archive with actual session data
npx qwen-api-proxy archive
```

**Success output:**
```
📦 Создание архива сессии...
📊 Найденные данные:
   ✓ Аккаунты: 1 (acc_1234567890)
   ✓ Токены: 1 записей

✅ Архив успешно создан!
📍 Путь: /path/to/session_backup_2026-06-10T05-32-26-259Z.zip
📏 Размер: 0.15 MB  ← Now it has data!
```

### Step 4: Upload to Telegram Bot (Optional)

1. Open your Telegram bot
2. Click 📎 (paperclip)
3. Select "File" (NOT "Photo"!)
4. Send the archive file
5. Wait for confirmation

---

## Alternative: Using Telegram Bot from the Start

If you already have a session archive from another source:

### Option 1: Configure Telegram Bot First

1. Edit `.env` file:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_USER_IDS=your_telegram_user_id
SKIP_ACCOUNT_MENU=true
```

2. Start the server:
```bash
npx qwen-api-proxy
```

3. Send session archive to the bot via Telegram

### Option 2: Manual Upload

1. Copy session files manually to `session/accounts/`
2. Start the server

---

## Troubleshooting

### Issue: Chrome Doesn't Open

**Linux:**
```bash
# Install dependencies for Chromium
sudo apt-get update
sudo apt-get install -y \
    gconf-service libxext6 libxfixes3 libxi6 libxrandr2 \
    libxrender1 libcairo2 libcups2 libdbus-1-3 libexpat1 \
    libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 \
    libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 \
    libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 \
    libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxss1 \
    libxtst6 ca-certificates fonts-liberation libappindicator1 \
    libnss3 lsb-release xdg-utils wget

# Or use system Chrome
export CHROME_PATH=$(which google-chrome)
npx qwen-api-proxy
```

**Windows:**
```powershell
# Puppeteer should auto-download Chromium
# If it fails, install manually:
npm install puppeteer

# Or use system Chrome:
$env:CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
npx qwen-api-proxy
```

**macOS:**
```bash
# Should work automatically
# If not, install Chromium:
brew install --cask chromium
export CHROME_PATH=$(which chromium)
npx qwen-api-proxy
```

### Issue: Archive is 0 MB

**Cause:** You ran `archive` before adding an account.

**Solution:** Follow Step 2 above to add an account first.

### Issue: "zip command not found"

**Linux:**
```bash
sudo apt install zip
```

**macOS:**
```bash
brew install zip
```

**Windows:**
- Option 1: `choco install zip`
- Option 2: `choco install 7zip`
- Option 3: Use built-in PowerShell (works automatically)

### Issue: Permission Errors

**Linux/macOS:**
```bash
chmod -R 755 session logs uploads temp
chown -R $USER:$USER session logs uploads temp
```

**Windows:**
- Run Command Prompt/PowerShell as Administrator
- Or ensure you have write permissions to the directory

---

## Quick Reference Commands

```bash
# Initialize directory
npx qwen-api-proxy init

# Add account (opens browser)
npx qwen-api-proxy

# Create archive
npx qwen-api-proxy archive

# System health check
npx qwen-api-proxy doctor

# Run without interactive menu
NON_INTERACTIVE=1 npx qwen-api-proxy

# Run with custom directory
npx qwen-api-proxy --dir=/path/to/directory
```

---

## Verification Checklist

After adding an account, verify everything works:

```bash
# Check session directory has data
ls -la session/accounts/
# Should show: acc_XXXXXXXXXXX/

# Check tokens.json exists
cat session/tokens.json
# Should show: [{"id":"acc_...","token":"..."}]

# Create archive
npx qwen-api-proxy archive
# Should show: Size > 0 MB

# Start server in non-interactive mode
NON_INTERACTIVE=1 npx qwen-api-proxy
# Should show: Server running on http://0.0.0.0:3264
```

---

## Understanding the Workflow

### Smart Workflow (v1.0.20+)

```
┌─────────────────────────────────────────────────────────┐
│  1. Run Archive Command                                 │
│     npx qwen-api-proxy archive                          │
│     ↓                                                    │
│  2. Smart Detection:                                    │
│     ├─ Has accounts? → Create archive immediately      │
│     └─ No accounts? → Offer to add one:                │
│        ├─ Option 1: Add now (opens browser)            │
│        ├─ Option 2: Use Telegram bot                   │
│        └─ Option 3: Exit gracefully                    │
│     ↓                                                    │
│  3. If Option 1 selected:                               │
│     ├─ Browser opens → Login → Press ENTER             │
│     ├─ Account saved to session/accounts/acc_XXX/      │
│     └─ Archive created automatically!                   │
│     ↓                                                    │
│  4. Upload to Telegram Bot (optional)                    │
│     ↓                                                    │
│  5. Start Server (NON_INTERACTIVE=1 npx qwen-api-proxy) │
│     ↓                                                    │
│  6. Use API at http://localhost:3264/api                │
└─────────────────────────────────────────────────────────┘
```

### Manual Workflow (Traditional)

```
┌─────────────────────────────────────────────────────────┐
│  1. Initialize Directory (npx qwen-api-proxy init)      │
│     ↓                                                    │
│  2. Add Account (npx qwen-api-proxy → option 1)         │
│     ↓                                                    │
│  3. Browser Opens → Login to Qwen → Press ENTER         │
│     ↓                                                    │
│  4. Session Saved to session/accounts/acc_XXX/          │
│     ↓                                                    │
│  5. Create Archive (npx qwen-api-proxy archive)         │
│     ↓                                                    │
│  6. Upload to Telegram Bot (optional)                    │
│     ↓                                                    │
│  7. Start Server (NON_INTERACTIVE=1 npx qwen-api-proxy) │
│     ↓                                                    │
│  8. Use API at http://localhost:3264/api                │
└─────────────────────────────────────────────────────────┘
```

---

## Environment Variables

Essential variables in `.env`:

```env
# Server Configuration
PORT=3264
HOST=0.0.0.0

# Skip Interactive Menu (for production)
SKIP_ACCOUNT_MENU=true
# or
NON_INTERACTIVE=true

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_USER_IDS=your_user_id_1,your_user_id_2

# Chrome Path (if not using bundled Chromium)
CHROME_PATH=/usr/bin/google-chrome  # Linux
# CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe  # Windows
```

---

## Next Steps

After successful setup:

1. 📖 **Read full documentation**: [README.md](README.md)
2. 🔧 **Configuration guide**: [ENV_SETUP.md](docs/ENV_SETUP.md)
3. 📱 **Telegram bot setup**: [TELEGRAM_SETUP_RU.md](TELEGRAM_SETUP_RU.md)
4. 🐳 **Docker deployment**: [README_DOCKER.md](README_DOCKER.md)
5. 💻 **npm package guide**: [README_NPM.md](README_NPM.md)

---

## Getting Help

If you encounter issues:

1. **Run diagnostics**:
   ```bash
   npx qwen-api-proxy doctor
   ```

2. **Check logs**:
   ```bash
   cat logs/error.log
   cat logs/combined.log
   ```

3. **Report issues**:
   - GitHub: https://github.com/EndyKaufman/FreeQwenApi/issues
   - Include: OS, Node.js version, error message, steps to reproduce

---

## Version

This guide applies to: **qwen-api-proxy v1.0.20+**
