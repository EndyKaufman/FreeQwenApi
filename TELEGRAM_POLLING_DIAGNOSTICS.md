# Telegram Polling Error Diagnostics

## Problem
The Telegram bot was experiencing "fetch failed" errors during polling without providing enough diagnostic information to identify the root cause.

## Changes Made

### 1. Enhanced Error Reporting in Polling Loop
**File**: `src/utils/telegramBot.js`

The polling error handler now extracts and logs detailed error information:
- Error message and code
- Underlying cause (for network-level errors)
- Error number and syscall (for system errors)
- Proxy configuration status

**Before**:
```
Ошибка в polling Telegram: fetch failed
```

**After**:
```
Ошибка в polling Telegram: fetch failed (cause: connect ECONNREFUSED 172.111.196.84:1577)
  Код: ECONNREFUSED
  Причина: connect ECONNREFUSED 172.111.196.84:1577
  errno: -111
  syscall: connect
  Прокси: настроен (http://user263298:***@172.111.196.84:1577)
Повторная попытка через 5 секунд...
```

### 2. Exponential Backoff for Retry Logic
Instead of a fixed 5-second delay, the bot now uses exponential backoff:
- 1st error: 5 seconds
- 2nd error: 10 seconds
- 3rd error: 20 seconds
- 4th error: 40 seconds
- 5th+ error: 60 seconds (capped)

This prevents overwhelming the proxy server or Telegram API during outages.

### 3. Enhanced Error Context in universalTelegramFetch
Network errors now include the underlying cause:
- Timeout errors show the timeout duration
- Network errors show the specific failure reason (DNS, connection refused, etc.)

### 4. Improved Proxy Test Diagnostics
When proxy configuration fails, the bot now logs:
- Specific error message and code
- Underlying cause
- Warning that the bot will continue but polling may fail

## Diagnostic Tool

A new diagnostic script has been created: `test-telegram-proxy.js`

### Usage

```bash
# Run the diagnostic tool
node test-telegram-proxy.js
```

### What It Tests

1. **Direct Connection**: Can you reach Telegram API without proxy?
2. **Proxy Reachability**: Is the proxy server accessible (ping + TCP test)?
3. **Proxy Connection**: Can you reach Telegram API through the proxy?

### Output Example

```
🔧 Telegram Proxy Diagnostics Tool
==================================================

📡 Testing DIRECT connection to Telegram API...
✅ Direct connection SUCCESS
   Bot: @YourBotName

🔍 Testing PROXY server reachability...
✅ Proxy server is reachable via ping
   Latency: 45.2 ms (avg)

🌐 Testing PROXY connection to Telegram API...
   Proxy: http://***:***@172.111.196.84:1577
✅ Proxy connection SUCCESS
   Bot: @YourBotName

==================================================
📊 DIAGNOSIS SUMMARY:
==================================================
Direct connection:  ✅ WORKING
Proxy reachable:    ✅ YES
Proxy connection:   ✅ WORKING

💡 RECOMMENDATIONS:
   - Both connections working
   - You can use either direct or proxy connection
==================================================
```

## Troubleshooting Steps

### Scenario 1: Direct works, Proxy fails
```
Direct connection:  ✅ WORKING
Proxy connection:   ❌ FAILED
```

**Actions**:
1. Check proxy credentials in `.env`:
   ```
   TELEGRAM_PROXY=http://user:pass@host:port
   ```
2. Verify proxy server is running
3. Test with a different proxy
4. Consider removing `TELEGRAM_PROXY` if not needed

### Scenario 2: Both fail
```
Direct connection:  ❌ FAILED
Proxy connection:   ❌ FAILED
```

**Actions**:
1. Check internet connection
2. Verify Telegram API isn't blocked in your region
3. Try a different proxy server
4. Check firewall rules

### Scenario 3: Only Proxy works
```
Direct connection:  ❌ FAILED
Proxy connection:   ✅ WORKING
```

**Actions**:
- Keep `TELEGRAM_PROXY` configured in `.env`
- Verify proxy credentials haven't expired

## Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `ECONNREFUSED` | Connection refused | Proxy server down or wrong port |
| `ETIMEDOUT` | Connection timeout | Proxy server unreachable or firewall blocking |
| `ENOTFOUND` | DNS resolution failed | Invalid proxy hostname |
| `ECONNRESET` | Connection reset by server | Proxy server terminated connection |
| `EAI_AGAIN` | Temporary DNS failure | Network issue, retry automatically |
| `AbortError` | Request timed out | Increase `TELEGRAM_TIMEOUT` in `.env` |

## Configuration

### Environment Variables

```env
# Telegram proxy (optional)
TELEGRAM_PROXY=http://user:pass@host:port

# Timeout for Telegram requests (default: 300000ms = 5 minutes)
TELEGRAM_TIMEOUT=300000
```

## Monitoring

After these changes, check your logs for:
1. Detailed error messages with root causes
2. Retry delay messages (showing exponential backoff)
3. Proxy status warnings

If you continue to see frequent "fetch failed" errors:
1. Run `node test-telegram-proxy.js`
2. Check the diagnosis summary
3. Follow the recommendations for your scenario
