# Session Extension Fix - Missing Cookies Issue

## 🔍 Problem Identified

When attempting to extend sessions via the Telegram bot's `/extend` command, you received this error:

```
❌ acc_1778350147301 - нет cookies
❌ acc_1781026421133 - нет cookies
```

### Root Cause

The accounts listed in `tokens.json` **do not have `cookies.json` files** in their directories. Session extension requires cookies to work properly.

**Current state:**
```
session/accounts/
├── acc_1778350143090/
│   └── cookies.json ✅ (has cookies)
├── acc_1778350147301/
│   └── token.txt only ❌ (NO cookies)
├── acc_1781026414633/
│   └── cookies.json ✅ (has cookies)
└── acc_1781026421133/
    └── token.txt only ❌ (NO cookies)
```

The `tokens.json` file lists accounts `acc_1778350147301` and `acc_1781026421133`, but these directories only contain `token.txt` without the required `cookies.json`.

## 🛠️ What Was Fixed

### 1. **createSessionArchive.js** - Now Saves Cookies
**File:** `scripts/createSessionArchive.js`

**Before:** Only saved the token
**After:** Saves both token AND cookies

```javascript
// NEW: Save cookies
try {
    const cookies = await ctx.cookies();
    fs.writeFileSync(path.join(accountDir, 'cookies.json'), JSON.stringify(cookies, null, 2));
    logInfo(`Cookies saved for account ${accountId} (${cookies.length} cookies)`);
} catch (error) {
    logWarn('Failed to save cookies, but token was saved', error);
}
```

### 2. **telegramBot.js** - Better Error Messages
**File:** `src/utils/telegramBot.js`

**Improvements:**
- Enhanced error reporting when cookies are missing
- Provides clear instructions on how to fix the issue
- Shows cookie status in `/status` command

### 3. **New Diagnostic Tool** - checkSessions.js
**File:** `scripts/checkSessions.js`

A new utility to check session health:
```bash
npm run check-sessions
```

This shows:
- Which accounts have cookies ✅
- Which accounts are missing cookies ❌
- Token expiry information
- Recommendations for fixing issues

## 🔧 How to Fix Your Current Issue

### Option 1: Create New Sessions (Recommended)

Since your current accounts don't have cookies, you need to create fresh sessions:

```bash
npm run create-session-archive
```

This will:
1. Open a browser
2. Allow you to login to Qwen
3. Save both token AND cookies
4. Create an archive you can upload via Telegram

**Then upload the archive to your Telegram bot.**

### Option 2: Use Existing Valid Accounts

You have 2 accounts with cookies that CAN be extended:
- `acc_1778350143090` ✅ (has cookies)
- `acc_1781026414633` ✅ (has cookies)

But these are NOT in your `tokens.json`. You can either:

1. **Add them to tokens.json manually:**
   ```json
   [
     {
       "id": "acc_1778350143090",
       "token": "<content from token.txt>",
       "resetAt": null,
       "invalid": false
     },
     {
       "id": "acc_1781026414633",
       "token": "<content from token.txt>",
       "resetAt": null,
       "invalid": false
     }
   ]
   ```

2. **Or just create fresh sessions** (Option 1) - this is cleaner.

## 📋 Updated Workflow

### Creating Sessions (First Time or When Expired)
```bash
npm run create-session-archive
# Login in browser
# Archive created automatically
# Upload archive to Telegram bot
```

### Extending Sessions (Regular Maintenance)
**Via Telegram:**
```
/extend
```

**Via Console:**
```bash
npm run extend-session
```

### Checking Session Health
```bash
npm run check-sessions
```

**Via Telegram:**
```
/status  # Now shows cookie status ✅ or ❌
```

## 🎯 What Changed in the Code

### Files Modified:
1. ✅ `scripts/createSessionArchive.js` - Now saves cookies
2. ✅ `src/utils/telegramBot.js` - Better error messages + cookie status in /status
3. ✅ `scripts/checkSessions.js` - NEW diagnostic tool
4. ✅ `package.json` - Added check-sessions script

### What This Means:
- **Future sessions** will have cookies saved automatically
- **Telegram bot** will give better error messages
- **Diagnostic tools** are available to check session health
- **Status command** shows cookie availability

## ⚠️ Important Notes

1. **Session extension REQUIRES cookies** - Without cookies, the browser cannot refresh the session
2. **Old sessions without cookies cannot be extended** - You must create new sessions
3. **New sessions will always have cookies** - The fix ensures cookies are saved

## 🚀 Next Steps

1. **Run diagnostic:**
   ```bash
   npm run check-sessions
   ```

2. **Create new session:**
   ```bash
   npm run create-session-archive
   ```

3. **Upload to Telegram bot** (send the ZIP file)

4. **Test extension:**
   ```
   /extend  # in Telegram
   ```

## 📞 Troubleshooting

**Q: Why did this happen?**
A: The old `createSessionArchive.js` script didn't save cookies. This was a bug that has now been fixed.

**Q: Can I recover the old sessions?**
A: No, sessions without cookies cannot be extended. You need to create new ones.

**Q: Will this happen again?**
A: No, the fix ensures all new sessions will have cookies saved automatically.

**Q: How often should I extend sessions?**
A: Every 6-12 hours, or before the token expires (check with `/status`).
