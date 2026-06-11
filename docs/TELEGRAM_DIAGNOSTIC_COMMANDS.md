# Telegram Diagnostic Commands

This document describes the diagnostic commands available in the Telegram bot for monitoring and debugging the browser session.

## Overview

The Telegram bot provides two diagnostic commands to help you monitor what's happening in the browser:

1. **`/screencast`** - Records the browser screen for a specified duration
2. **`/screenshot`** - Takes a screenshot with OCR text recognition

These commands are useful for:
- Debugging authentication issues
- Checking if the browser is in the expected state
- Verifying that pages are loading correctly
- Monitoring CAPTCHA or verification screens

---

## `/screencast` Command

Records the browser screen and sends the video to the Telegram chat.

### Usage

```
/screencast <seconds>
/record <seconds>
```

### Parameters

- `seconds` (optional) - Recording duration in seconds
  - **Minimum:** 20 seconds
  - **Maximum:** 60 seconds
  - **Default:** 30 seconds (if not specified)

### Examples

```
/screencast 30    # Record for 30 seconds
/record 60        # Record for 60 seconds
/screencast       # Record for 30 seconds (default)
```

### Response

The bot will:
1. Confirm the recording has started
2. Record the browser screen for the specified duration
3. Send the WebM video file to the chat with:
   - Recording duration
   - File size
   - Current page URL

### Notes

- **Requires browser to be running** - The command will fail if the browser is not started
- **File format** - Video is saved as WebM format
- **Storage location** - Videos are saved to `logs/screencasts/` directory
- **File cleanup** - Files remain on disk for later inspection if needed

---

## `/screenshot` Command

Takes a screenshot of the current browser page and performs OCR (Optical Character Recognition) to extract text.

### Usage

```
/screenshot
/scr
```

### Parameters

- No parameters required

### Response

The bot will:
1. Take a screenshot of the current browser page
2. Run OCR to extract text from the image
3. Send the PNG image to the chat with:
   - Current page URL
   - File size
   - Recognized text (if any)

### Examples

```
/screenshot       # Take screenshot with OCR
/scr              # Same as /screenshot
```

### Notes

- **Requires browser to be running** - The command will fail if the browser is not started
- **OCR language** - Currently supports English text recognition
- **Text limit** - Up to 1000 characters of recognized text are shown
- **File format** - Screenshot is saved as PNG format
- **Storage location** - Screenshots are saved to `logs/screenshots/` directory
- **Tesseract.js** - Uses Tesseract.js for OCR (initialized at startup)

---

## Use Cases

### 1. Debug Authentication Issues

If tokens are expiring or authentication is failing:

```
/screenshot
```

Check if:
- Login page is shown
- CAPTCHA is displayed
- Verification screen appears

### 2. Monitor Browser State

To see what the browser is currently displaying:

```
/screencast 30
```

This is useful for:
- Checking if pages are loading
- Verifying navigation is working
- Seeing error messages or dialogs

### 3. CAPTCHA Detection

When you suspect CAPTCHA is blocking requests:

```
/screenshot
```

The OCR will often detect CAPTCHA text like:
- "Verify you are human"
- "Complete the security check"
- Other verification prompts

### 4. Recording Interactions

To capture a longer interaction sequence:

```
/screencast 60
```

Use this to:
- Watch page transitions
- See loading states
- Observe any UI issues

---

## Technical Details

### Screencast Implementation

- Uses Puppeteer's `page.screencast()` API
- Records in WebM format
- Stops automatically after specified duration
- File is sent via Telegram document API

### Screenshot & OCR Implementation

- Uses Puppeteer's `page.screenshot()` API
- Tesseract.js performs OCR on the screenshot
- English language model is loaded at startup
- Text is extracted and cleaned before sending

### File Storage

All diagnostic files are stored in:
- **Screencasts:** `logs/screencasts/screencast-cmd-<timestamp>.webm`
- **Screenshots:** `logs/screenshots/screenshot-cmd-<timestamp>.png`

Timestamps are in ISO format with special characters replaced by dashes.

---

## Troubleshooting

### Command fails with "Browser not running"

**Solution:** Ensure the service is started and authenticated:
```bash
npm start
```

### Video file is too small or corrupted

**Possible causes:**
- Browser page was closed during recording
- ffmpeg is not installed (required for WebM encoding)

**Solution:** Install ffmpeg:
```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg
```

### OCR returns empty text

**Possible causes:**
- Screenshot contains no text
- Text is in a language other than English
- Image quality is too low
- Text is rendered as images/graphics

**Solution:** Try taking another screenshot or check the image manually

### Command times out

**Solution:** 
- Check if browser is responsive
- Try `/screenshot` first (f than screencast)
- Restart the service if needed

---

## Permissions

These commands are available to all authorized Telegram users (configured via `TELEGRAM_USER_IDS` in `.env`).

---

## Related Documentation

- [CAPTCHA Detection](./CAPTCHA_DETECTION.md) - Automatic CAPTCHA detection and handling
- [Telegram Bot Setup](./TELEGRAM_SETUP_RU.md) - Configure Telegram bot integration
- [Browser Profile Mode](./BROWSER_PROFILE_MODE.md) - Browser persistence settings

---

## Environment Variables

No additional environment variables are required for these commands. They use existing configuration:

- `LOGS_DIR` - Directory for storing logs (default: `logs`)
- `TELEGRAM_BOT_TOKEN` - Telegram bot authentication token
- `TELEGRAM_USER_IDS` - Authorized user IDs

---

## Version

These commands were added in June 2026 to enhance diagnostic capabilities of the Telegram bot.
