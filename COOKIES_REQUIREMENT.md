# Cookies Requirement - Implementation Summary

## 🎯 Problem

The system was using tokens that **don't have cookies.json files**, which caused:
- "Использован безопасный токен: acc_XXX" would select tokens without cookies
- Session extension (`/extend`) would fail with "нет cookies"
- Tokens without cookies cannot be extended or refreshed
- Confusion about which tokens are actually usable

## ✅ Solution

**All token filtering now REQUIRES cookies.json to exist.**

A token is only considered valid if it meets **ALL** criteria:
1. ✅ `invalid === false` (not marked as invalid)
2. ✅ `resetAt` is not in the future (not rate-limited)
3. ✅ `expiryTime > now` (JWT not expired)
4. ✅ **`cookies.json` exists** (can be extended)

## 📝 Changes Made

### 1. **tokenManager.js** - Added `hasCookies()` Function

```javascript
export function hasCookies(accountId) {
    const cookiesPath = path.join(ACCOUNTS_PATH, accountId, 'cookies.json');
    return fs.existsSync(cookiesPath);
}
```

### 2. **Updated All Token Filtering Functions**

#### `getAvailableToken()`
```javascript
// Пропускаем токены без cookies.json
if (!hasCookies(t.id)) return false;
```

#### `hasValidTokens()`
```javascript
// Пропускаем токены без cookies.json
if (!hasCookies(t.id)) return false;
```

#### `getValidTokens()`
```javascript
// Пропускаем токены без cookies.json
if (!hasCookies(t.id)) return false;
```

#### `getSafeToken()` - This is what logs "Использован безопасный токен"
```javascript
// Пропускаем токены без cookies.json
if (!hasCookies(t.id)) return false;
```

### 3. **telegramBot.js** - Status Command

```javascript
// Фильтруем только действительные токены (не invalid, не rate-limited, не истекшие, с cookies)
const validTokens = tokens.filter(t => {
    if (t.invalid) return false;
    if (t.resetAt && new Date(t.resetAt).getTime() > now) return false;
    if (t.expiryTime && t.expiryTime <= now) return false;
    // Проверяем наличие cookies.json
    const cookiesPath = path.join(process.cwd(), SESSION_DIR, 'accounts', t.id, 'cookies.json');
    if (!fs.existsSync(cookiesPath)) return false;
    return true;
});
```

### 4. **telegramBot.js** - Extend Command

Same filtering applied - only extends tokens WITH cookies.

### 5. **routes.js** - API Status Endpoint

API `/status` now only returns accounts that have cookies.json.

### 6. **accountSetup.js** - Interactive Menu

Account removal menu only shows tokens with cookies.

## 🎯 Result

### Your Current Situation

You have 3 tokens:
```
acc_1778350147301 - ❌ EXPIRED + ❌ NO COOKIES
acc_1781026421133 - ✅ Valid but ❌ NO COOKIES
acc_1781030008338 - ✅ Valid + ✅ HAS COOKIES ← ONLY THIS ONE IS USED
```

### Before Fix

```
/getSafeToken() would return: acc_1781026421133 (no cookies!)
/status would show: All 3 tokens
/extend would try: All 3 tokens (2 would fail)
```

### After Fix

```
/getSafeToken() returns: acc_1781030008338 (has cookies) ✅
/status shows: Only acc_1781030008338 ✅
/extend processes: Only acc_1781030008338 ✅
```

## 📊 What This Means

### "Использован безопасный токен" Log

**Before:**
```
[INFO] Использован безопасный токен: acc_1781026421133
```
❌ This token has no cookies, can't be extended!

**After:**
```
[INFO] Использован безопасный токен: acc_1781030008338
```
✅ This token has cookies, can be extended!

### Telegram /status Command

**Before:**
```
🎫 Токены: ✅ Доступно: 2
   Токен 1: ❌ acc_1778350147301 (expired)
   Токен 2: ❌ acc_1781026421133 (no cookies)
   Токен 3: ✅ acc_1781030008338 (valid)
```

**After:**
```
🎫 Токены: ✅ Доступно: 1
   Токен 1: ✅ acc_1781030008338
      ⏱️ Осталось: 29д 23ч
      ✅ (has cookies)
```

### Telegram /extend Command

**Before:**
```
📊 Найдено аккаунтов: 3
❌ acc_1778350147301 - нет cookies
❌ acc_1781026421133 - нет cookies
✅ acc_1781030008338 - продлен
```

**After:**
```
📊 Найдено аккаунтов: 1
✅ acc_1781030008338 - продлен
```

## 🔍 Why Cookies Are Required

1. **Session Extension**: The `/extend` command uses browser automation with cookies to refresh sessions
2. **No Cookies = No Extension**: Without cookies.json, the browser cannot authenticate to Qwen
3. **Temporary Tokens**: Tokens without cookies are temporary and will die when JWT expires
4. **Better UX**: Showing only extendable tokens prevents confusion

## 🛠️ How to Add Cookies to Existing Tokens

If you have tokens without cookies, you need to:

### Option 1: Create New Session (Recommended)
```bash
npm run create-session-archive
```
This creates a new account WITH cookies.

### Option 2: Re-authenticate
1. Login to Qwen in browser
2. Run `npm run create-session-archive`
3. Upload archive via Telegram bot

## ✨ Benefits

1. **Only Usable Tokens Shown**: No confusion about which tokens work
2. **Safe Token Selection**: `getSafeToken()` only returns tokens that can be extended
3. **Cleaner Status**: `/status` shows only tokens with full functionality
4. **Faster Extension**: `/extend` doesn't waste time on tokens that will fail
5. **Consistent Behavior**: Same filtering everywhere in the system

## 📋 Filtering Logic

```javascript
function isTokenValid(token) {
    // 1. Not marked as invalid
    if (token.invalid) return false;
    
    // 2. Not rate-limited
    if (token.resetAt && new Date(token.resetAt).getTime() > Date.now()) return false;
    
    // 3. JWT not expired
    if (token.expiryTime && token.expiryTime <= Date.now()) return false;
    
    // 4. Has cookies.json (NEW!)
    if (!hasCookies(token.id)) return false;
    
    return true;
}
```

## 🎯 Where This Applies

| Location | Function | Cookies Required? |
|----------|----------|-------------------|
| **Core** | `getSafeToken()` | ✅ Yes |
| **Core** | `getAvailableToken()` | ✅ Yes |
| **Core** | `hasValidTokens()` | ✅ Yes |
| **Core** | `getValidTokens()` | ✅ Yes |
| **Telegram** | `/status` command | ✅ Yes |
| **Telegram** | `/extend` command | ✅ Yes |
| **API** | `GET /status` | ✅ Yes |
| **CLI** | Account menu | ✅ Yes |

## 🚀 Next Steps

1. **Restart the service** to apply changes
2. **Check status**: Send `/status` to see only valid tokens with cookies
3. **Test extension**: Send `/extend` - it should only process tokens with cookies
4. **Monitor logs**: "Использован безопасный токен" should now show tokens WITH cookies

## 💡 Important Notes

- ✅ Tokens WITHOUT cookies are **HIDDEN** from all displays
- ✅ Tokens WITHOUT cookies are **SKIPPED** during operations
- ✅ Tokens WITHOUT cookies are **NOT USED** for API requests
- ⚠️ This doesn't delete tokens without cookies - they're just filtered out
- 💡 To use those tokens again, create new sessions with cookies

## 📚 Related Documentation

- [SESSION_EXTENSION_FIX.md](./SESSION_EXTENSION_FIX.md) - Original cookies fix
- [EXPIRED_TOKEN_FILTERING.md](./EXPIRED_TOKEN_FILTERING.md) - Token expiry filtering
- [TOKEN_EXPIRY_CHECKING.md](./docs/TOKEN_EXPIRY_CHECKING.md) - Dual expiry checking

## ✨ Summary

**Before:** System used any token → Selected tokens without cookies → Extension failed

**After:** System only uses tokens WITH cookies → All selected tokens can be extended → Success! ✅

Now "Использован безопасный токен" will ALWAYS be a token that:
- ✅ Is valid (not expired, not invalid, not rate-limited)
- ✅ Has cookies.json (can be extended)
- ✅ Won't expire soon (safe to use)
- ✅ Has full functionality
