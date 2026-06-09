# Expired Token Filtering - Implementation Summary

## 🎯 Problem

Expired tokens (marked as ❌) were still being displayed in:
- Telegram `/status` command
- Telegram `/extend` command  
- API `/status` endpoint
- Interactive account menu

This caused confusion because:
- Users saw tokens that couldn't be used
- Extension attempts failed on expired tokens
- Status reports showed unusable accounts

## ✅ Solution

Implemented **automatic filtering** of expired tokens everywhere in the system.

### Filtering Criteria

A token is considered **invalid/expired** and will be filtered out if:
1. `t.invalid === true` (marked as invalid from 401 errors)
2. `t.resetAt` is in the future (rate-limited)
3. `t.expiryTime <= now` (JWT token expired)

**Only tokens that pass ALL three checks are shown/used.**

## 📝 Changes Made

### 1. **tokenManager.js** - New Helper Function

**File:** `src/api/tokenManager.js`

**Added:**
```javascript
export function getValidTokens() {
    const tokens = loadTokens();
    const now = Date.now();
    
    return tokens.filter(t => {
        if (t.invalid) return false;
        if (t.resetAt && new Date(t.resetAt).getTime() > now) return false;
        if (t.expiryTime && t.expiryTime <= now) return false;
        return true;
    });
}
```

This function can be used anywhere to get only valid tokens.

### 2. **telegramBot.js** - Status Command

**File:** `src/utils/telegramBot.js`

**Before:**
```
🎫 Токены: ✅ Всего: 3, Доступно: 1, Протухло: 1
   Токен 1: ❌ acc_1778350147301
      ⏱️ Осталось: Протух
   Токен 2: ❌ acc_1781026421133
      ⏱️ Осталось: 29д 22ч 59м 38с
   Токен 3: ✅ acc_1781030008338
      ⏱️ Осталось: 29д 23ч 59м 25с
```

**After:**
```
🎫 Токены: ✅ Доступно: 1 (пропущено 2 истекших)
   Токен 1: ✅ acc_1781030008338
      ⏱️ Осталось: 29д 23ч 59м 25с
      ✅ (has cookies)

⚠️ Внимание: Все 3 токенов истекли. Создайте новые сессии.
```

### 3. **telegramBot.js** - Extend Command

**File:** `src/utils/telegramBot.js`

**Before:**
```
🔄 Продление сессий...
📊 Найдено аккаунтов: 3
⏳ Это может занять несколько минут...

❌ acc_1778350147301 - нет cookies
❌ acc_1781026421133 - нет cookies
✅ acc_1781030008338 - продлен
```

**After:**
```
🔄 Продление сессий...
📊 Найдено аккаунтов: 1 (пропущено 2 истекших)
⏳ Это может занять несколько минут...

✅ acc_1781030008338 - продлен
```

**If ALL tokens expired:**
```
⚠️ Нет действительных токенов

Все 3 токенов истекли.

Создайте новые сессии:
1. Запустите: npm run create-session-archive
2. Или отправьте архив через бота
```

### 4. **routes.js** - API Status Endpoint

**File:** `src/api/routes.js`

**Change:** API `/status` endpoint now only returns valid tokens in the `accounts` array.

**Before:** Returns all tokens including expired ones
**After:** Returns only tokens that can actually be used

### 5. **accountSetup.js** - Interactive Menu

**File:** `src/utils/accountSetup.js`

**Change:** `removeAccountInteractive()` now only shows valid tokens for deletion.

**Before:** Shows all tokens (including expired)
**After:** Shows only valid tokens that can be used

## 🔄 Where Filtering Is Applied

| Location | Function | Filtered? |
|----------|----------|-----------|
| **Telegram** | `/status` command | ✅ Yes |
| **Telegram** | `/extend` command | ✅ Yes |
| **API** | `GET /status` | ✅ Yes |
| **CLI** | Account removal menu | ✅ Yes |
| **Core** | `getAvailableToken()` | ✅ Already filtered |
| **Core** | `getSafeToken()` | ✅ Already filtered |
| **Core** | Token rotation for requests | ✅ Already filtered |

## 📊 Benefits

1. **Cleaner Status Reports**
   - Only shows usable tokens
   - Clear indication of how many were filtered
   - No confusion about expired tokens

2. **Better User Experience**
   - `/extend` only processes valid tokens
   - Faster execution (skips expired ones)
   - Clear error messages when all tokens expired

3. **Consistent Behavior**
   - Same filtering logic everywhere
   - Centralized in `getValidTokens()` function
   - Easy to maintain

4. **Proactive Alerts**
   - Shows warning when all tokens expired
   - Provides clear next steps
   - Links to session creation command

## 🧪 Testing

### Check Current Session Status

```bash
npm run check-sessions
```

This shows:
- ✅ Healthy sessions (have cookies + valid token)
- ⚠️ Warning sessions (missing cookies)
- ❌ Error sessions (expired tokens)

### Test Telegram Commands

1. **Status Command:**
   ```
   /status
   ```
   Should show only valid tokens

2. **Extend Command:**
   ```
   /extend
   ```
   Should only extend valid tokens

### Test API Endpoint

```bash
curl http://localhost:3264/api/status
```

Should return only valid accounts.

## 🔍 Examples

### Scenario 1: Mixed Tokens (Some Expired)

**tokens.json:**
```json
[
  { "id": "acc_1", "expiryTime": 1700000000000, "invalid": false },  // EXPIRED
  { "id": "acc_2", "expiryTime": 1900000000000, "invalid": false },  // VALID
  { "id": "acc_3", "expiryTime": 1900000000000, "invalid": true }    // INVALID
]
```

**Result:**
- `/status` shows: "Доступно: 1 (пропущено 2 истекших)"
- `/extend` processes: Only `acc_2`
- API returns: Only `acc_2`

### Scenario 2: All Tokens Expired

**Result:**
- `/status` shows warning: "Все 3 токенов истекли"
- `/extend` shows: "Нет действительных токенов" + instructions
- API returns: Empty accounts array

### Scenario 3: All Tokens Valid

**Result:**
- `/status` shows: "Доступно: 3"
- `/extend` processes: All 3 tokens
- No filtering message shown

## 📋 Maintenance

### Adding New Token Display

When adding new places that display tokens, use:

```javascript
import { getValidTokens } from './api/tokenManager.js';

const validTokens = getValidTokens();
// Use validTokens instead of loadTokens()
```

### Or inline filtering:

```javascript
const tokens = loadTokens();
const now = Date.now();

const validTokens = tokens.filter(t => {
    if (t.invalid) return false;
    if (t.resetAt && new Date(t.resetAt).getTime() > now) return false;
    if (t.expiryTime && t.expiryTime <= now) return false;
    return true;
});
```

## 🎯 What This Doesn't Do

- ❌ Does NOT delete expired tokens from `tokens.json`
- ❌ Does NOT mark tokens as invalid automatically
- ❌ Does NOT change how tokens are rotated (already filtered)

It only **hides** expired tokens from display and processing.

## 🔧 Future Improvements

Possible enhancements:

1. **Auto-cleanup command:**
   ```bash
   npm run cleanup-tokens  # Remove expired tokens from tokens.json
   ```

2. **Telegram notification:**
   Auto-notify when tokens expire (already implemented for ALL tokens expired)

3. **Historical tracking:**
   Keep log of when tokens expired

## ✨ Summary

**Before:** Showed all tokens including expired ones → confusion
**After:** Shows only valid tokens → clarity

The system now behaves consistently:
- ✅ Expired tokens are hidden from display
- ✅ Expired tokens are skipped during operations
- ✅ Clear warnings when action is needed
- ✅ Same filtering logic everywhere
