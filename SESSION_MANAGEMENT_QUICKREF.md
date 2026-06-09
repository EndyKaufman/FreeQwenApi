# Session Management Quick Reference

## 📋 All Session Commands

### 📱 Telegram Commands (From Phone!)

```bash
# Extend all sessions (from Telegram bot)
# ⚠️ ВРЕМЕННО ОТКЛЮЧЕНО - используйте create-session-archive
# /extend

# Check status
/status

# Upload archive (send file to bot)
# Attach session_backup_XXXX.zip as file
```

**When to use:**
- When away from server
- Quick maintenance from phone
- No SSH access needed

---

### 🔐 Create New Session (Manual Login Required)

```bash
# Opens browser, you login, creates archive
npm run create-session-archive
```

**When to use:**
- First time setup
- When session completely expires
- When extension fails

---

### 🔄 Extend Existing Session (Automatic)

```bash
# Extend all sessions (headless, no interaction)
npm run extend-session

# Extend specific account
node scripts/extendSession.js --account-id acc_1234567890
```

**When to use:**
- Regular maintenance (every 6-12 hours)
- Before token expires
- Automated via cron

---

### 📦 Upload Session to Server (via Telegram)

```bash
# 1. Create archive
npm run create-session-archive

# 2. Send archive to your Telegram bot
#    (via Telegram app, attach as file)
```

**When to use:**
- Update remote server sessions
- Share sessions between machines
- Backup sessions

---

### 🚀 Start Server

```bash
# Start API server
npm start

# Non-interactive mode (no account menu)
SKIP_ACCOUNT_MENU=true npm start
```

---

## ⏰ Automation Examples

### Cron Jobs (Linux/macOS)

```bash
# Edit crontab
crontab -e

# Extend sessions every 6 hours
0 */6 * * * cd /path/to/FreeQwenApi && npm run extend-session >> logs/extension.log 2>&1

# Extend sessions daily at 3 AM
0 3 * * * cd /path/to/FreeQwenApi && npm run extend-session

# Create archive weekly (manual login needed)
# Note: This requires manual interaction, so NOT recommended for cron
```

### systemd Timer (Linux)

```ini
# /etc/systemd/system/qwen-extend.service
[Unit]
Description=Extend Qwen Sessions

[Service]
Type=oneshot
WorkingDirectory=/path/to/FreeQwenApi
ExecStart=/usr/bin/npm run extend-session

# /etc/systemd/system/qwen-extend.timer
[Unit]
Description=Run every 6 hours

[Timer]
OnBootSec=5min
OnUnitActiveSec=6h

[Install]
WantedBy=timers.target
```

Enable:
```bash
sudo systemctl enable qwen-extend.timer
sudo systemctl start qwen-extend.timer
```

---

## 🔍 Diagnostic Commands

### Check Token Status

```bash
# Start server and check logs
npm start

# Look for messages like:
# ✅ Аккаунт acc_XXX активен
# ⚠️ Токен acc_XXX истекает через 45 мин
# ❌ Токен acc_XXX истек
```

### View Session Files

```bash
# List accounts
ls -la session/accounts/

# Check token file
cat session/accounts/acc_XXXX/token.txt

# View tokens.json
cat session/tokens.json | jq

# Check cookies
cat session/accounts/acc_XXXX/cookies.json | jq
```

### Check Extension History

```bash
# If logging to file
tail -f logs/extension.log

# Check last extension time
cat session/tokens.json | jq '.[] | {id, lastExtended}'
```

---

## 🎯 Decision Tree

### "Which command should I use?"

```
Do you have existing sessions?
├─ NO  → npm run create-session-archive
│         (Login manually, create archive)
│
└─ YES → Are sessions still working?
         ├─ YES → Where are you?
         │        ├─ On phone → ⚠️ /extend временно отключен
         │        │             Используйте: npm run create-session-archive
         │        └─ On server → npm run extend-session
         │
         └─ NO  → npm run create-session-archive
                   (Session expired, re-authenticate)
```

---

## 📊 Session Lifecycle

```
1. Create Session
   npm run create-session-archive
   ↓
2. Use Session (days/weeks)
   npm start
   ↓
3. Extend Session (before expiry)
   npm run extend-session
   ↓
4. Repeat step 2-3
   
When extension fails:
   Back to step 1
```

---

## 💡 Best Practices

### ✅ DO

- Extend sessions every 6-12 hours
- Use cron for automation
- Monitor token expiry warnings
- Keep backups of session folder
- Extend BEFORE tokens expire

### ❌ DON'T

- Wait until tokens expire completely
- Run extension while creating archive
- Delete session files while server is running
- Share session archives publicly
- Skip extension for more than 24 hours

---

## 🛠️ Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| No accounts found | `npm run create-session-archive` |
| Token expired | `npm run extend-session` |
| Extension failed | `npm run create-session-archive` |
| Browser won't open | Check if another instance is running |
| 401 errors | Re-authenticate with `create-session-archive` |

---

## 📚 Documentation Links

- [Session Archive Creator](./SESSION_ARCHIVE_CREATOR.md)
- [Automatic Session Extension](./AUTOMATIC_SESSION_EXTENSION.md)
- [Telegram Session Upload](./TELEGRAM_SESSION_UPLOAD_RU.md)
- [Token Expiry Checking](./docs/TOKEN_EXPIRY_CHECKING.md)

---

## 🎉 Quick Start

### First Time Setup

```bash
# 1. Create initial session
npm run create-session-archive

# 2. Start server
npm start

# 3. Set up automatic extension
crontab -e
# Add: 0 */6 * * * cd /path/to/FreeQwenApi && npm run extend-session
```

### Daily Maintenance

```bash
# Nothing! It's automated with cron.
# Or manually if needed:
npm run extend-session
```

### When Things Break

```bash
# Re-authenticate
npm run create-session-archive

# Upload to server
# Send archive via Telegram bot
```
