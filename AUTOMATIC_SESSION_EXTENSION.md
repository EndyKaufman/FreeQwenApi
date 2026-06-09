# Automatic Session Extension

## 🎯 Overview

Automatically extend Qwen session tokens **without manual re-authentication**. This script:

1. Opens browser in **headless mode** (invisible)
2. Loads saved cookies
3. Visits Qwen to refresh the session
4. Extracts and saves the new token
5. Closes browser

**No user interaction required!**

## 🚀 Quick Start

### Extend All Sessions

```bash
npm run extend-session
```

### Extend Specific Account

```bash
node scripts/extendSession.js --account-id acc_1234567890
```

## 📋 How It Works

### Session Extension Process

```
┌─────────────────────────────────────────────────────────┐
│ 1. Load saved cookies from session/accounts/acc_XXX/    │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Open browser in headless mode (invisible)            │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Inject cookies into browser                          │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Navigate to chat.qwen.ai to refresh session          │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Wait for page to load (session refreshes)            │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 6. Extract new auth token from browser                  │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 7. Save new token and cookies                           │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 8. Close browser - Done! ✅                             │
└─────────────────────────────────────────────────────────┘
```

## 💡 Usage Examples

### Basic Usage

```bash
# Extend all accounts (default behavior)
npm run extend-session

# Output:
╔══════════════════════════════════════════════════════════╗
║           Automatic Session Extender                     ║
║                                                          ║
║  This script will:                                       ║
║  1. Open browser in headless mode                        ║
║  2. Load saved cookies                                   ║
║  3. Refresh session by visiting Qwen                     ║
║  4. Extract and save new token                           ║
╚══════════════════════════════════════════════════════════╝

🌐 Mode: Extend all accounts

📊 Found 3 account(s) to extend

🔄 Extending session for account: acc_1718123456789
🌐 Opening browser in headless mode...
🍪 Loading saved cookies...
📄 Navigating to Qwen to refresh session...
🔑 Extracting new auth token...
✅ Session extended successfully for acc_1718123456789

🔄 Extending session for account: acc_1718234567890
...

════════════════════════════════════════════════════════════
📋 EXTENSION SUMMARY
════════════════════════════════════════════════════════════
✅ acc_1718123456789 - Extended successfully
✅ acc_1718234567890 - Extended successfully
✅ acc_1718345678901 - Extended successfully

────────────────────────────────────────────────────────────
Total: 3 | Success: 3 | Failed: 0
════════════════════════════════════════════════════════════

🎉 All sessions extended successfully!
```

### Extend Specific Account

```bash
# Only extend one account
node scripts/extendSession.js --account-id acc_1718123456789
```

### Verbose Mode

```bash
# Show detailed logs
node scripts/extendSession.js --verbose
```

## ⏰ Automated Scheduling

### Option 1: Cron Job (Linux/macOS)

Edit crontab:
```bash
crontab -e
```

Add line to extend sessions every 6 hours:
```bash
# Extend Qwen sessions every 6 hours
0 */6 * * * cd /path/to/FreeQwenApi && npm run extend-session >> logs/session-extension.log 2>&1
```

Common schedules:
- **Every 6 hours**: `0 */6 * * *`
- **Every 12 hours**: `0 */12 * * *`
- **Once daily at 3 AM**: `0 3 * * *`
- **Every 2 hours**: `0 */2 * * *`

### Option 2: systemd Timer (Linux)

Create service file `/etc/systemd/system/qwen-session-extend.service`:
```ini
[Unit]
Description=Extend Qwen API Sessions
After=network.target

[Service]
Type=oneshot
WorkingDirectory=/path/to/FreeQwenApi
ExecStart=/usr/bin/npm run extend-session
User=your_username
```

Create timer file `/etc/systemd/system/qwen-session-extend.timer`:
```ini
[Unit]
Description=Run Qwen session extension every 6 hours

[Timer]
OnBootSec=5min
OnUnitActiveSec=6h

[Install]
WantedBy=timers.target
```

Enable and start:
```bash
sudo systemctl enable qwen-session-extend.timer
sudo systemctl start qwen-session-extend.timer
```

### Option 3: Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily, repeat every 6 hours
4. Action: Start a program
   - Program: `node`
   - Arguments: `scripts/extendSession.js`
   - Start in: `C:\path\to\FreeQwenApi`

## 🔧 Command Line Options

```
Usage: node scripts/extendSession.js [options]

Options:
  --account-id <id>  Extend specific account (e.g., acc_1234567890)
  --all              Extend all accounts
  --verbose, -v      Show detailed logs
  --help, -h         Show this help message

Examples:
  # Extend all accounts (default)
  npm run extend-session

  # Extend specific account
  node scripts/extendSession.js --account-id acc_1234567890

  # Extend all with verbose output
  node scripts/extendSession.js --all --verbose
```

## 📊 Session States

### ✅ Success
- Session extended successfully
- New token saved
- Cookies updated
- Rate limits cleared

### ⚠️ Common Failures

| Status | Reason | Solution |
|--------|--------|----------|
| `no_cookies` | No cookies.json found | Run `npm run create-session-archive` first |
| `token_extraction_failed` | Session expired completely | Re-authenticate manually |
| `invalid_token` | Token marked as invalid | Re-authenticate manually |

## 🔄 When to Extend

### Recommended Schedule

| Usage Pattern | Extension Frequency |
|---------------|---------------------|
| Heavy usage (100+ requests/day) | Every 4-6 hours |
| Medium usage (20-100 requests/day) | Every 8-12 hours |
| Light usage (<20 requests/day) | Once daily |

### Before Token Expires

The system warns when tokens expire within 1 hour. Extend **before** this happens:

```bash
# Check token status
npm start

# If you see warnings like:
# ⚠️ Токен acc_XXX истекает через 45 мин.
# Then run:
npm run extend-session
```

## 🛠️ Troubleshooting

### "No cookies found"

**Problem:** Session doesn't have saved cookies

**Solution:**
```bash
# Create fresh session with cookies
npm run create-session-archive
```

### "Token extraction failed"

**Problem:** Session completely expired, needs re-authentication

**Solution:**
```bash
# Manual re-authentication required
npm run create-session-archive
```

### Browser doesn't close

**Problem:** Script hangs

**Solution:**
```bash
# Force kill node processes
pkill -f node

# Or on Windows
taskkill /F /IM node.exe
```

### Extension works but token still expires

**Possible causes:**
1. **Wrong account** - Check which account is being used
2. **Rate limiting** - Qwen may have rate limits
3. **Session completely expired** - Needs manual re-auth

**Debug:**
```bash
# Check which accounts exist
ls session/accounts/

# Check token timestamps
cat session/tokens.json | jq '.[] | {id, lastExtended}'

# Extend specific account
node scripts/extendSession.js --account-id acc_XXXX
```

## 📁 Files Modified

The script updates these files:

```
session/
├── accounts/
│   └── acc_XXXX/
│       ├── token.txt          ← Updated with new token
│       └── cookies.json       ← Updated with new cookies
└── tokens.json                ← Updated with new token and timestamp
```

## 🔐 Security Notes

- ✅ **Headless mode** - No visible browser window
- ✅ **No credentials stored** - Uses existing cookies only
- ✅ **Automatic cleanup** - Browser closes after extension
- ✅ **Safe to automate** - No interactive prompts

## 💡 Pro Tips

### 1. Combine with Monitoring

Set up Telegram notifications to know when to extend:

```bash
# .env
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_USER_IDS=your_id
TOKEN_EXPIRY_WARNING_MS=7200000  # Warn 2 hours before expiry
```

### 2. Extension Log File

Keep a log of all extensions:
```bash
npm run extend-session >> logs/extension-history.log 2>&1
```

### 3. Pre-emptive Extension

Extend before important tasks:
```bash
# Extend, then run your script
npm run extend-session && node my-important-script.js
```

### 4. Multi-Account Rotation

Extend all accounts to keep them fresh:
```bash
# Run every 6 hours via cron
0 */6 * * * cd /path/to/FreeQwenApi && npm run extend-session
```

## 🎯 Comparison: Extension vs Re-authentication

| Feature | Extension | Re-authentication |
|---------|-----------|-------------------|
| **User interaction** | None required | Manual login required |
| **Speed** | ~10 seconds per account | ~1-2 minutes |
| **Browser visibility** | Headless (invisible) | Visible window |
| **When to use** | Regular maintenance | When session completely expires |
| **Automation** | Can be scheduled | Manual only |

## 📚 Related Commands

- **`npm run create-session-archive`** - Create new session with manual login
- **`npm run extend-session`** - Automatically extend existing sessions
- **`npm start`** - Start the API server

## ✨ Benefits

1. **Zero downtime** - Extend without stopping the server
2. **Fully automated** - Set and forget with cron
3. **Headless operation** - No visible browser
4. **Safe** - Won't break existing sessions
5. **Fast** - ~10 seconds per account
6. **Selective** - Extend specific or all accounts

## 🎉 Done!

Now you can automatically extend sessions without manual intervention!
