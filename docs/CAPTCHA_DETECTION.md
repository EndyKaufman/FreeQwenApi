# CAPTCHA Detection System

## Overview

The FreeQwenApi now includes automatic CAPTCHA detection to handle verification challenges from Qwen AI. When CAPTCHA is detected, the system automatically:

1. **Takes a screenshot** of the page showing the CAPTCHA
2. **Sends a Telegram notification** with the screenshot and details
3. **Closes the problematic page** and creates a fresh one
4. **Restarts the browser** if CAPTCHA persists across multiple pages

## How It Works

### Detection Methods

The system uses multiple strategies to detect CAPTCHA:

#### 1. URL Pattern Analysis
Checks the page URL against known CAPTCHA patterns:
- `captcha`
- `verify`
- `challenge`
- `security-check`
- `human-verification`
- `cf/captcha` (Cloudflare)
- `turnstile` (Cloudflare Turnstile)

#### 2. DOM Element Detection
Scans the page for CAPTCHA-related elements:
- **CAPTCHA iframes**: Detects iframes with `src` or `title` containing CAPTCHA keywords
- **Cloudflare Turnstile**: Specifically identifies Turnstile challenges
- **Verification widgets**: Finds embedded verification components

#### 3. Text Content Analysis (OCR)
Uses Tesseract.js to perform OCR on the page and detect CAPTCHA-related text:
- "verify you are human"
- "security check"
- "complete the challenge"
- "пройти проверку" (Russian)

### Integration Points

CAPTCHA checking is integrated into critical workflows:

#### 1. Page Pool (`pagePool.getPage()`)
- **Before returning a page from the pool**: Validates that the page doesn't contain CAPTCHA
- **After creating a new page**: Checks newly navigated pages before use
- **On CAPTCHA detection**: 
  - Closes the contaminated page
  - Attempts browser restart if CAPTCHA appears on fresh pages
  - Recursively retries page acquisition after restart

#### 2. Chat Creation (`createChatV2()`)
- **Before API call**: Validates the page is CAPTCHA-free
- **On timeout**: Checks for CAPTCHA before triggering process restart (exit code 42)
- **Retry logic**: Up to `MAX_RETRY_COUNT` attempts with different pages

#### 3. Message Sending (`sendMessage()`)
- **Before API call**: Ensures the page is clean
- **Retry with new page**: Automatically retries with a fresh page on CAPTCHA detection

## Telegram Notifications

When CAPTCHA is detected, you'll receive a notification like:

```
⚠️🛡️ Обнаружена CAPTCHA!

📋 Причина: CAPTCHA URL detected: verify
🔗 URL: https://chat.qwen.ai/verify?token=abc123

🖼️ Скриншот сохранен:
`/path/to/logs/screenshots/captcha-2026-06-11T14-03-18-046Z.png`

💡 Действия:
1. Проверьте скриншот выше
2. Браузер будет перезапущен автоматически
3. Если CAPTCHA повторяется, проверьте токены
```

## Screenshot Storage

CAPTCHA screenshots are saved to:
```
logs/screenshots/captcha-<timestamp>.png
```

Timestamps use ISO format with special characters replaced: `2026-06-11T14-03-18-046Z`

## Browser Auto-Restart

When CAPTCHA is detected on a **freshly created page** (not from pool), the system:

1. Closes the problematic page
2. Shuts down the browser (`shutdownBrowser()`)
3. Waits 2 seconds
4. Reinitializes the browser (`initBrowser()`)
5. Recursively acquires a new page

This helps clear session-based CAPTCHA challenges.

## Retry Logic

### Page Pool Level
- Pages with CAPTCHA are immediately closed
- Next page from pool is tried
- If pool is empty, a new page is created

### API Call Level (`createChatV2`, `sendMessage`)
- On CAPTCHA detection, the page is closed
- Retry counter is incremented
- New page is obtained from pool
- Up to `MAX_RETRY_COUNT` (default: 3) retries

### Global Level (Protocol Timeout)
- If `page.evaluate()` times out due to CAPTCHA blocking the request
- System checks for CAPTCHA before restart
- Sends screenshot to Telegram
- Exits with code 42 for automatic service restart

## Configuration

CAPTCHA detection is **disabled by default**. To enable it, set the `ENABLE_ANTICAPTCHA` environment variable to `true`.

### Environment Variables

```bash
# Enable/disable CAPTCHA detection (default: false)
ENABLE_ANTICAPTCHA=true

# Maximum retry attempts for API calls
MAX_RETRY_COUNT=3

# Delay between retries (milliseconds)
RETRY_DELAY=2000

# Puppeteer protocol timeout (triggers exit code 42)
PUPPETEER_PROTOCOL_TIMEOUT=120000

# Telegram notifications (required for alerts)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_USER_IDS=123456789
```

## Troubleshooting

### Frequent CAPTCHA Detection

If you're seeing CAPTCHA frequently:

1. **Check token validity**: Expired or rate-limited tokens trigger more CAPTCHAs
   ```bash
   # Check account status
   node scripts/checkSessions.js
   ```

2. **Rotate accounts**: Multiple accounts distribute the load
   ```bash
   # Add a new account
   node scripts/addAccount.js
   ```

3. **Reduce request frequency**: High request rates trigger anti-bot measures

4. **Check IP reputation**: Your server IP might be flagged
   - Consider using a proxy (see `QWEN_PROXY` in `.env`)
   - Use residential proxies for better results

### CAPTCHA Not Detected

If CAPTCHA is showing but not being detected:

1. **Check logs** for detection attempts:
   ```
   🔍 [detectCaptcha] Проверка URL: ...
   🔍 [detectCaptcha] Обнаружены CAPTCHA iframes: 1
   ```

2. **Review screenshots** in `logs/screenshots/` to see what CAPTCHA looks like

3. **Add new patterns**: Edit the `detectCaptcha()` function in `src/api/chat.js`:
   ```javascript
   const captchaUrlPatterns = [
       'captcha',
       'verify',
       // Add new patterns here
       'your-new-pattern'
   ];
   ```

### OCR Not Working

If text-based CAPTCHA detection isn't working:

1. **Verify Tesseract.js is installed**:
   ```bash
   npm list tesseract.js
   ```

2. **Check OCR logs**:
   ```
   🔤 Initializing Tesseract OCR worker...
   🔤 Performing OCR on screenshot...
   ```

3. **Language support**: Currently uses English (`eng`). Add Russian if needed:
   ```javascript
   tesseractWorker = await createWorker('eng+rus', 1, { ... });
   ```

## Architecture

### Key Functions

```javascript
// Main detection function
detectCaptcha(page)
  ├── Checks URL patterns
  ├── Scans DOM for CAPTCHA iframes
  └── Analyzes page text content

// Handler for detected CAPTCHA
handleCaptchaDetected(page, reason)
  ├── Takes screenshot
  └── Sends Telegram notification

// Page validation wrapper
validatePageForCaptcha(page)
  ├── Calls detectCaptcha()
  └── Calls handleCaptchaDetected() if found
```

### Integration Flow

```
pagePool.getPage()
  └── validatePageForCaptcha(page)
        ├── CAPTCHA found?
        │   ├── Yes: Close page, retry/restart browser
        │   └── No: Return page
        └── Return validated page

createChatV2()
  └── pagePool.getPage()
        └── validatePageForCaptcha(page)
              └── CAPTCHA? → Retry with new page
  └── page.evaluate() [API call]
        └── Timeout? → detectCaptcha() → Telegram → exit(42)

sendMessage()
  └── pagePool.getPage()
        └── validatePageForCaptcha(page)
              └── CAPTCHA? → Retry with new page
```

## Future Enhancements

Potential improvements being considered:

- [ ] **Automatic CAPTCHA solving** via third-party services
- [ ] **CAPTCHA pattern learning**: Store detected CAPTCHAs for ML training
- [ ] **Smart retry delays**: Exponential backoff based on CAPTCHA frequency
- [ ] **Account cooldown**: Temporarily disable accounts that trigger CAPTCHA
- [ ] **Browser fingerprint rotation**: Change browser characteristics to avoid detection

## Related Documentation

- [Puppeteer Timeout Self-Recovery](PUPPETEER_TIMEOUT_RECOVERY.md)
- [Token Expiry Checking](TOKEN_EXPIRY_FEATURE.md)
- [Telegram Notifications](TELEGRAM_LLM_CHAT.md)
- [Session Management](SESSION_MANAGEMENT_QUICKREF.md)
