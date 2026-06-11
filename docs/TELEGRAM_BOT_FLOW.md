# Telegram Bot - Session Upload Flow

## 📋 Quick Reference Card

### User Actions:
```
1. Check permissions:  npm run check-permissions
2. Fix if needed:      npm run fix-permissions
3. Create archive:     zip -r session.zip session/
4. Open Telegram bot
5. Send archive file
6. Wait 5 seconds
7. Done! ✅
```

### Bot Responses:
```
⏳ Загрузка файла...
✅ Файл загружен. Распаковка...
✅ Архив успешно распакован!
🔄 Сервис будет перезапущен...
```

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER PREPARES ARCHIVE                    │
│                                                             │
│  session/                                                   │
│  ├── accounts/                                              │
│  │   ├── acc_123/                                           │
│  │   │   ├── cookies.json                                   │
│  │   │   └── token.txt                                      │
│  │   └── acc_456/                                           │
│  ├── tokens.json                                            │
│  └── auth_token.txt                                         │
│                                                             │
│  Command: zip -r session.zip session/                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ User sends file via Telegram
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  TELEGRAM BOT RECEIVES                      │
│                                                             │
│  1. Receive update from Telegram API                        │
│  2. Check user authorization (TELEGRAM_USER_IDS)           │
│  3. Validate file:                                          │
│     ├─ Extension: .zip or .7z? ✅                          │
│     ├─ Size: < 50MB? ✅                                    │
│     └─ Continue...                                         │
│                                                             │
│  Response: "⏳ Загрузка файла session.zip..."               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Download file from Telegram
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    FILE DOWNLOAD                            │
│                                                             │
│  1. Get file_id from update                                 │
│  2. Call: bot.getFile(file_id)                              │
│  3. Download from: https://api.telegram.org/file/...       │
│  4. Save to: /app/temp/session.zip                          │
│                                                             │
│  Response: "✅ Файл загружен. Распаковка..."               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Extract archive
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  ARCHIVE EXTRACTION                         │
│                                                             │
│  For ZIP files:                                             │
│  ├─ Use: adm-zip library                                    │
│  ├─ Check: Contains session/ folder? ✅                    │
│  └─ Extract: session/* → /app/session/                      │
│                                                             │
│  For 7z files:                                              │
│  ├─ Use: 7z command (p7zip)                                 │
│  ├─ Check: Contains session/ folder? ✅                    │
│  └─ Extract: session/* → /app/session/                      │
│                                                             │
│  Response: "✅ Архив успешно распакован!"                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Trigger restart
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  RESTART PREPARATION                        │
│                                                             │
│  1. Create .restart_flag file:                              │
│     {                                                       │
│       "reason": "telegram_session_update",                  │
│       "timestamp": "2026-05-09T...",                        │
│       "chatId": "123456789"                                 │
│     }                                                       │
│                                                             │
│  2. Response: "🔄 Сервис будет перезапущен..."             │
│                                                             │
│  3. Wait 2 seconds (ensure message sent)                    │
│                                                             │
│  4. Exit process with code 42                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ process.exit(42)
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              STARTUP SCRIPT DETECTS EXIT                    │
│                                                             │
│  start-with-restart.sh:                                     │
│                                                             │
│  while true; do                                             │
│      node index.js                                          │
│      EXIT_CODE=$?                                           │
│                                                             │
│      if [ $EXIT_CODE -eq 42 ]; then                        │
│          echo "🔄 Перезапуск после обновления сессии..."   │
│          sleep 3                                            │
│          continue  # Restart loop                           │
│      fi                                                     │
│  done                                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ After 3 seconds
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  SERVICE RESTART                            │
│                                                             │
│  1. New node index.js process starts                        │
│  2. Check for .restart_flag file ✅                         │
│  3. Log: "🔄 Обнаружен флаг перезапуска"                   │
│  4. Delete .restart_flag                                    │
│  5. Initialize browser                                      │
│  6. Start Telegram bot                                      │
│  7. Load sessions from /app/session/                        │
│  8. Start Express server                                    │
│                                                             │
│  Log: "🤖 Telegram бот запущен и готов принимать команды"  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Service ready
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  CONFIRMATION                               │
│                                                             │
│  User sees in Telegram:                                     │
│  ✅ Service restarted successfully                          │
│  ✅ New sessions loaded                                     │
│  ✅ Ready to use                                            │
│                                                             │
│  Verify via API:                                            │
│  curl http://localhost:3264/api/status                      │
└─────────────────────────────────────────────────────────────┘
```

## ⚡ Timing Breakdown

```
T+0s    User sends archive
T+1s    Bot starts downloading
T+3s    Download complete
T+4s    Extraction starts
T+5s    Extraction complete
T+6s    Restart triggered (exit 42)
T+9s    Service restarts (3s delay)
T+12s   Service ready
        Total: ~12 seconds
```

## 🔍 Validation Checks

### Before Download:
- ✅ User authorized? (TELEGRAM_USER_IDS)
- ✅ File extension valid? (.zip, .7z)
- ✅ File size OK? (< 50MB)

### During Extraction:
- ✅ Archive contains session/ folder?
- ✅ No path traversal attacks?
- ✅ Sufficient disk space?

### After Extraction:
- ✅ Session structure valid?
- ✅ tokens.json exists?
- ✅ accounts/ directory present?

## 🛡️ Security Layers

```
Layer 1: User Authentication
         └─ Only TELEGRAM_USER_IDS allowed

Layer 2: File Validation
         ├─ Extension check
         ├─ Size limit
         └─ Format verification

Layer 3: Archive Validation
         ├─ Must contain session/
         ├─ No malicious paths
         └─ Safe extraction

Layer 4: Process Isolation
         ├─ Temp directory
         ├─ Cleanup after use
         └─ Controlled restart
```

## 📊 Exit Codes Reference

```
Code  Meaning              Action
────  ───────────────────  ──────────────────────
0     Normal shutdown      Stop service
42    Session update       Restart after 3s
130   SIGINT (Ctrl+C)      Stop service
143   SIGTERM              Stop service
Other Error                Restart after 5s
```

## 🎯 Success Criteria

Archive upload is successful when:
- ✅ File downloaded completely
- ✅ Archive extracted without errors
- ✅ session/ folder updated
- ✅ Service restarted automatically
- ✅ API responds with new session data
- ✅ Bot confirms completion

## 🚨 Error Handling

### Invalid User:
```
❌ У вас нет доступа к этому боту
```

### Wrong Format:
```
❌ Неподдерживаемый формат файла: .rar
📎 Поддерживаются только: .zip и .7z
```

### File Too Large:
```
❌ Файл слишком большой: 75.5MB
📏 Максимальный размер: 50MB
```

### Missing Session Folder:
```
❌ Ошибка распаковки: Архив не содержит папку "session"
```

### Extraction Error:
```
❌ Ошибка: [error details]
```

## 📝 Log Examples

### Successful Upload:
```
[INFO] 📦 Получен файл: session.zip (245678 bytes)
[INFO] ✅ Файл сохранен: /app/temp/session.zip
[INFO] ✅ ZIP архив успешно распакован
[INFO] 🔄 Запуск корректного перезапуска сервиса...
[INFO] 🛑 Завершение работы для перезапуска Docker Compose...
[INFO] 🔄 Обнаружен флаг перезапуска: telegram_session_update
[INFO] 🤖 Telegram бот запущен: @my_bot
```

### Error Case:
```
[INFO] 📦 Получен файл: backup.rar (123456 bytes)
[WARN] ❌ Неподдерживаемый формат файла: .rar
```

## 🎓 Best Practices

1. **Before Upload:**
   - Backup current sessions
   - Verify archive structure
   - Check file size

2. **During Upload:**
   - Send as file (not photo)
   - Wait for confirmation
   - Don't send multiple files

3. **After Upload:**
   - Wait 10-15 seconds
   - Check /status command
   - Test API endpoint

4. **Troubleshooting:**
   - Check logs if fails
   - Verify archive structure
   - Try smaller test archive first

5. **Diagnostics:**
   - Use `/screenshot` to see browser state
   - Use `/screencast 30` to record browser activity
   - Check OCR text for CAPTCHA detection
   - See [Diagnostic Commands](./TELEGRAM_DIAGNOSTIC_COMMANDS.md) for details

## 🎉 Complete!

You now have a fully functional Telegram bot for remote session management!
