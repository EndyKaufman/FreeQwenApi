# Token Expiry Checking & Telegram Notifications

## Overview

The system now automatically checks token expiry before making LLM requests. If a token is expiring soon (within 1 hour by default) or has already expired, the system will:

1. **Skip the expiring token** and use the next available session
2. **Send Telegram notifications** to configured users when ALL tokens are expired
3. **Continue normal operation** if at least one valid token is available

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Telegram Bot Token (get from @BotFather)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Telegram User IDs (comma-separated)
# Get your ID from @userinfobot
TELEGRAM_USER_IDS=123456789,987654321

# Token expiry warning threshold in milliseconds (default: 1 hour)
TOKEN_EXPIRY_WARNING_MS=3600000
```

### Setup Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Copy the bot token (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. Add it to your `.env` file as `TELEGRAM_BOT_TOKEN`

### Get Your Telegram User ID

1. Open Telegram and search for `@userinfobot`
2. Send any message
3. The bot will reply with your User ID
4. Add it to your `.env` file as `TELEGRAM_USER_IDS`

## How It Works

### Token Selection Logic

1. **Before each request**, the system checks all tokens for expiry
2. **Safe tokens** (not expiring within `TOKEN_EXPIRY_WARNING_MS`) are prioritized
3. **Expiring tokens** (less than 1 hour left) are marked and avoided
4. **Expired/invalid tokens** are skipped automatically

### Notification Triggers

Telegram notifications are sent when:
- **ALL tokens are expired or rate-limited**
- **No safe tokens are available** for new requests

### Token States

- ✅ **Active**: Token is valid and not expiring soon
- ⏰ **Expiring Soon**: Token will expire within the warning threshold (default: 1 hour)
- ❌ **Expired**: Token has already expired
- 🚫 **Invalid**: Token is marked as invalid (401 errors)

## API Functions

### New Functions in `tokenManager.js`

```javascript
// Check if a specific token is expiring soon
checkTokenExpiry(tokenId, warningMs)

// Check all tokens and get expiry status
checkAllTokensExpiry(warningMs)

// Get a token that won't expire soon
getSafeToken(warningMs)
```

### Telegram Notifications

```javascript
// Send notification to all configured users
sendTelegramNotification(message)

// Format token expiry message
formatTokenExpiryMessage(tokens)
```

## Example Telegram Notification

When all tokens expire, users receive:

```
🚨 FreeQwenApi - Проблема с токенами

❌ Все токены недоступны:

1. acc_1234567890
   Статус: ⏰ Истекает через 2 ч.
   Сброс: 09.05.2026, 15:30:00

2. acc_9876543210
   Статус: ❌ Недействителен

⚠️ Требуется действие:
   • Перезапустите авторизацию для обновления токенов
   • Или дождитесь автоматического сброса лимитов
```

## Behavior Flow

```
Request Received
    ↓
Check Token Expiry
    ↓
├─ Safe Token Available?
│   ├─ YES → Use safe token → Normal operation
│   └─ NO ↓
│
├─ All Tokens Expired?
│   ├─ YES → Send Telegram notification
│   │         ↓
│   │      Try any available token (even expiring)
│   │         ↓
│   │      ├─ Token exists → Use with warning
│   │      └─ No tokens → Return error
│   │
│   └─ NO → Use next available token
│
└─ Continue request processing
```

## Customization

### Change Warning Threshold

```bash
# Set to 30 minutes (in milliseconds)
TOKEN_EXPIRY_WARNING_MS=1800000

# Set to 2 hours
TOKEN_EXPIRY_WARNING_MS=7200000
```

### Disable Telegram Notifications

Simply don't set `TELEGRAM_BOT_TOKEN` or `TELEGRAM_USER_IDS`. The system will:
- Still check token expiry
- Still skip expiring tokens
- Just skip the notification part

## Monitoring

Check logs for token status:

```bash
# Look for these log messages
grep "Используется аккаунт" logs/combined.log
grep "истекает через" logs/combined.log
grep "Все токены истекают" logs/combined.log
grep "Telegram уведомление" logs/combined.log
```

## Troubleshooting

### Telegram notifications not sent?

1. Verify `TELEGRAM_BOT_TOKEN` is correct
2. Check `TELEGRAM_USER_IDS` contains valid IDs
3. Ensure the bot is not blocked by users
4. Check logs for error messages

### Tokens not being rotated properly?

1. Check `session/tokens.json` for token states
2. Verify `resetAt` timestamps are correct
3. Review logs for token selection decisions

### Want to force token refresh?

```bash
# Mark all tokens as valid (clear rate limits)
# Edit session/tokens.json and remove resetAt fields
```

## Files Modified

- `src/config.js` - Added Telegram configuration
- `src/api/tokenManager.js` - Added expiry checking functions
- `src/api/chat.js` - Integrated expiry checks into token resolution
- `src/utils/telegramNotifier.js` - New Telegram notification utility
- `.env.example` - Added example configuration
