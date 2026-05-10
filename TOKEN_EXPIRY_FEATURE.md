# Token Expiry Checking Feature - Implementation Summary

## ✅ What Was Implemented

### 1. Token Expiry Checking Before LLM Requests
- **Before each request**, the system now checks if the token will expire within 1 hour
- If a token is expiring soon or already expired, it's **skipped automatically**
- The system rotates to the next available healthy session

### 2. Telegram Notifications
- When **ALL tokens are expired/rate-limited**, notifications are sent to Telegram users
- Notifications include detailed status of each token
- Users are alerted to take action (re-authenticate)

### 3. Smart Token Selection
- **Priority 1**: Use tokens that won't expire within the warning threshold
- **Priority 2**: If all tokens are expiring, send Telegram notification and try anyway
- **Priority 3**: Skip invalid/expired tokens and try the next one

## 📁 Files Created/Modified

### New Files:
1. **`src/utils/telegramNotifier.js`** - Telegram notification utility
2. **`docs/TOKEN_EXPIRY_CHECKING.md`** - Complete documentation
3. **`test_token_expiry.js`** - Test script for the new functionality
4. **`.env.example`** - Example environment configuration

### Modified Files:
1. **`src/config.js`** - Added Telegram configuration variables
2. **`src/api/tokenManager.js`** - Added 4 new functions:
   - `checkTokenExpiry()` - Check individual token expiry
   - `checkAllTokensExpiry()` - Check all tokens status
   - `getSafeToken()` - Get token that won't expire soon
   - Enhanced existing functions with expiry awareness

3. **`src/api/chat.js`** - Updated token resolution:
   - `resolveAuthToken()` - Now checks expiry before using token
   - `createChatV2()` - Now uses safe token selection
   - Integrated Telegram notifications

## 🔧 Configuration

Add to your `.env` file:

```bash
# Get from @BotFather in Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Get from @userinfobot in Telegram (comma-separated for multiple users)
TELEGRAM_USER_IDS=123456789,987654321

# Optional: Change warning threshold (default: 1 hour = 3600000ms)
TOKEN_EXPIRY_WARNING_MS=3600000
```

## 🎯 How It Works

### Normal Flow (Tokens Available):
```
Request → Check Token Expiry → Use Safe Token → Success ✅
```

### When Tokens Are Expiring:
```
Request → Check Token Expiry → Token Expiring Soon → Skip to Next Token → Use Safe Token ✅
```

### When ALL Tokens Are Expired:
```
Request → Check Token Expiry → All Expired → Send Telegram Notification 📱
       ↓
Try Any Available Token (Even Expiring) → Use with Warning ⚠️
       ↓
If No Tokens Available → Return Error ❌
```

## 📊 Token States

| State | Description | Action |
|-------|-------------|--------|
| ✅ Active | Valid, not expiring soon | Used normally |
| ⏰ Expiring Soon | < 1 hour until expiry | Avoided, warning logged |
| ❌ Expired | Already expired | Skipped |
| 🚫 Invalid | Marked invalid (401 errors) | Skipped |

## 🧪 Testing

Run the test script:
```bash
node test_token_expiry.js
```

This will:
- Create test tokens with different expiry times
- Test expiry checking logic
- Test safe token selection
- Test Telegram message formatting
- Attempt to send test notification (if configured)
- Clean up test data

## 📝 Example Logs

```
[INFO] Использован безопасный токен: acc_1234567890
[WARN] ⚠️ Токен acc_9876543210 истекает через 45 мин. Используем с осторожностью.
[WARN] ⚠️ Все токены истекают или уже истекли!
[INFO] Telegram уведомление отправлено пользователю 123456789
[WARN] Используем истекающий токен: acc_1234567890
```

## 🚀 Benefits

1. **Prevents Failed Requests**: Avoids using tokens about to expire
2. **Proactive Alerts**: Notifies you BEFORE all tokens die
3. **Automatic Rotation**: Intelligently selects the healthiest token
4. **No Downtime**: Continues operation with warnings if needed
5. **Configurable**: Adjust warning threshold to your needs

## 🔄 Backward Compatibility

- **Fully backward compatible** - no breaking changes
- If Telegram is not configured, system works normally (just skips notifications)
- Existing token logic still works, just enhanced with expiry checks

## 📋 Next Steps

1. **Configure Telegram** (optional but recommended):
   - Create bot via @BotFather
   - Get your User ID from @userinfobot
   - Add to `.env` file

2. **Test the feature**:
   ```bash
   node test_token_expiry.js
   ```

3. **Monitor logs** for token expiry warnings

4. **Adjust threshold** if needed:
   ```bash
   # Change from 1 hour to 30 minutes
   TOKEN_EXPIRY_WARNING_MS=1800000
   ```

## 🐛 Troubleshooting

### No Telegram notifications?
- Check that `TELEGRAM_BOT_TOKEN` and `TELEGRAM_USER_IDS` are set
- Verify the bot token is correct
- Ensure users haven't blocked the bot

### Tokens not rotating?
- Check `session/tokens.json` for token states
- Look at logs for token selection decisions
- Verify `resetAt` timestamps are correct

### Want to disable?
- Simply remove `TELEGRAM_BOT_TOKEN` from `.env`
- Token expiry checking still works, just no notifications

## 📚 Documentation

Full documentation available at:
- `docs/TOKEN_EXPIRY_CHECKING.md` - Complete feature guide

## ✨ Summary

The system now intelligently manages token expiry:
- ✅ Checks expiry before each request
- ✅ Skips tokens expiring within 1 hour
- ✅ Sends Telegram alerts when all tokens are down
- ✅ Continues operation with warnings if needed
- ✅ Fully configurable and backward compatible
