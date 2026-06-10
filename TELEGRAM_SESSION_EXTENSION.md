# Telegram Session Extension

> ⚠️ **TEMPORARILY DISABLED** (Technical Maintenance)
> 
> The `/extend` command is currently unavailable. Use `npm run create-session-archive` to create new sessions.

## 🎯 Overview

You can now **extend Qwen sessions directly from Telegram**! No need to access the server console.

## 📱 Telegram Command

### `/extend` - Extend All Sessions

**What it does:**
1. Opens browser in headless mode (invisible)
2. Loads saved cookies for each account
3. Visits Qwen to refresh sessions
4. Extracts and saves new tokens
5. Sends detailed report

**How to use:**
```
1. Open your Telegram bot
2. Send: /extend
3. Wait for the report
```

## 📊 Example Output

### Success
```
🔄 Продление сессий...

📊 Найдено аккаунтов: 3
⏳ Пожалуйста, подождите...

📋 Результат продления сессий

✅ Успешно: 3
❌ Ошибки: 0

Детали:
✅ acc_1718123456789 - продлен
✅ acc_1718234567890 - продлен
✅ acc_1718345678901 - продлен

🎉 Сессии продлены!
```

### Partial Success
```
📋 Результат продления сессий

✅ Успешно: 2
❌ Ошибки: 1

Детали:
✅ acc_1718123456789 - продлен
❌ acc_1718234567890 - нет cookies
✅ acc_1718345678901 - продлен

🎉 Сессии продлены!
```

### All Failed
```
📋 Результат продления сессий

✅ Успешно: 0
❌ Ошибки: 3

Детали:
❌ acc_1718123456789 - не удалось получить токен
❌ acc_1718234567890 - нет cookies
❌ acc_1718345678901 - недействителен

⚠️ Все сессии не удалось продлить.
Выполните: npm run create-session-archive
```

## 🔄 Complete Telegram Workflow

### Session Management via Telegram

```
1. Create initial session (on server)
   npm run create-session-archive

2. Upload to server (via Telegram)
   Send ZIP archive to bot

3. Extend sessions (via Telegram)
   Send: /extend

4. Check status (via Telegram)
   Send: /status

5. Repeat step 3-4 regularly
```

## 📱 All Telegram Commands

### Management Commands
- `/help` - Show help message
- `/status` - Show service status
- `/restart` - Restart service
- `/extend` - **Extend sessions automatically** ⭐ NEW

### LLM Chat Commands
- `/chat` - Show LLM chat status
- `/togglechat` - Enable/disable LLM chat
- `/clear` - Clear chat context
- `/model` - Show model info
- `/setmodel <name>` - Change model

### Image Generation
- `/image <description>` - Generate image
- `/imagine <description>` - Alternative command

### Information
- `/setup` - Session creation guide
- `/connect` - Connection instructions
- `/about` - Project information

### File Upload
- Send `.zip` or `.7z` archive - Upload sessions

## 💡 Use Cases

### 1. Regular Maintenance

**When:** Every 6-12 hours

**Steps:**
```
1. Open Telegram
2. Send: /extend
3. Wait for confirmation
4. Done! ✅
```

### 2. Before Token Expires

**When:** You see expiry warning in `/status`

**Steps:**
```
1. Check status: /status
2. See: ⚠️ Токен истекает через 45 мин
3. Extend: /extend
4. Verify: /status
```

### 3. Multiple Accounts

**When:** Managing multiple Qwen accounts

**Steps:**
```
1. Send: /extend
2. Bot extends all accounts
3. Shows report for each account
4. All sessions refreshed! ✅
```

## ⏰ Automation Options

### Option 1: Manual (On-Demand)

Just send `/extend` whenever you want!

### Option 2: Semi-Automatic (Reminder)

Set phone reminder to send `/extend` every 6-12 hours

### Option 3: Fully Automatic (Server Cron)

Keep cron job for full automation:
```bash
# Server-side cron (extends automatically)
0 */6 * * * cd /path/to/FreeQwenApi && npm run extend-session
```

**Telegram command becomes backup:**
- Use `/extend` if cron fails
- Use `/extend` for manual control
- Use `/extend` to verify cron worked

## 🔍 Monitoring

### Check Extension Status

After running `/extend`, check:

```
/send /status

Look for:
✅ acc_XXX активен
📅 Last extended: 2 hours ago
```

### Extension Timestamp

Each account shows when it was last extended:
```json
{
  "id": "acc_123",
  "token": "...",
  "lastExtended": "2026-06-09T14:30:00.000Z"
}
```

## ❗ Troubleshooting

### "Нет аккаунтов" (No Accounts)

**Problem:** No sessions exist

**Solution:**
```
1. Create session on server:
   npm run create-session-archive

2. Or send archive to bot
```

### "Нет cookies" (No Cookies)

**Problem:** Account doesn't have saved cookies

**Solution:**
```
1. Re-authenticate account
2. npm run create-session-archive
3. Upload new archive via bot
```

### "Не удалось получить токен" (Token Extraction Failed)

**Problem:** Session completely expired

**Solution:**
```
1. Manual re-authentication needed
2. npm run create-session-archive
3. Upload via bot
```

### Command Not Responding

**Problem:** Bot doesn't respond to `/extend`

**Check:**
1. Bot is running
2. You're authorized (TELEGRAM_USER_IDS)
3. Check server logs

## 📋 Command Comparison

| Method | Command | Location | Automation |
|--------|---------|----------|------------|
| **Telegram** | `/extend` | From phone | Manual |
| **Console** | `npm run extend-session` | On server | Cron |
| **Direct** | `node scripts/extendSession.js` | On server | Script |

### When to Use Each

**Telegram `/extend`:**
- ✅ When away from server
- ✅ Quick maintenance
- ✅ Mobile access
- ✅ No SSH needed

**Console `npm run extend-session`:**
- ✅ Full automation (cron)
- ✅ Detailed logs
- ✅ Debugging
- ✅ Server management

**Direct script:**
- ✅ Custom arguments
- ✅ Specific accounts
- ✅ Development
- ✅ Testing

## 🎯 Best Practices

### ✅ DO

- Use `/extend` every 6-12 hours
- Check `/status` after extending
- Use before tokens expire
- Keep sessions active with regular extension

### ❌ DON'T

- Wait until tokens expire completely
- Run `/extend` while creating archive
- Ignore failure messages
- Skip extension for more than 24 hours

## 🔐 Security

- ✅ Only authorized users (TELEGRAM_USER_IDS) can use `/extend`
- ✅ Headless mode - no visible browser
- ✅ Automatic cleanup - browser closes after
- ✅ Safe operation - won't break sessions

## 💡 Pro Tips

### 1. Combine with Status Check

```
1. Send: /status
2. Check token expiry times
3. Send: /extend (if needed)
4. Send: /status (verify)
```

### 2. Regular Schedule

Set phone reminder:
```
Title: Extend Qwen Sessions
Repeat: Every 8 hours
Action: Send /extend to bot
```

### 3. Multi-Account Management

All accounts extended at once:
```
/extend → extends all accounts
/status → shows all accounts
```

### 4. Error Recovery

If `/extend` fails:
```
1. Check error message
2. If "no cookies" → re-authenticate
3. If "token failed" → re-authenticate
4. Create archive: npm run create-session-archive
5. Upload via bot
```

## 📚 Related Documentation

- [Automatic Session Extension](./AUTOMATIC_SESSION_EXTENSION.md) - Console automation
- [Session Archive Creator](./SESSION_ARCHIVE_CREATOR.md) - Create sessions
- [Telegram Session Upload](./TELEGRAM_SESSION_UPLOAD_RU.md) - Upload via bot
- [Session Management QuickRef](./SESSION_MANAGEMENT_QUICKREF.md) - All commands

## ✨ Benefits

1. **Mobile access** - Extend from anywhere
2. **No SSH needed** - Just Telegram
3. **Quick & easy** - One command
4. **Detailed reports** - See results for each account
5. **Safe** - Headless operation
6. **Authorized** - Only you can use it

## 🎉 Done!

Now you can extend sessions directly from Telegram!

**Just send: `/extend`** 🚀
