# Rebuilding tokens.json

## Problem

If you see `(пусто)` (empty) when starting the server, even though you have account directories with `token.txt` files, it means `tokens.json` is empty or corrupted.

### Example Error:
```
Список аккаунтов:
  (пусто)
```

## Cause

The `tokens.json` file is the registry that tracks all accounts. It can become empty if:
- Manual editing went wrong
- File corruption
- Docker permission issues
- Incomplete archive extraction

## Solution

### Quick Fix (Automated)

Run the rebuild script:

```bash
npm run rebuild-tokens
```

This script will:
1. ✅ Scan all account directories in `session/accounts/`
2. ✅ Read `token.txt` from each directory
3. ✅ Decode JWT tokens to extract expiry times
4. ✅ Rebuild `tokens.json` with all valid tokens
5. ✅ Show token status (valid/expired)

### Example Output:

```
🔍 Scanning account directories...

📁 Found 4 account(s):

  ⚠️  acc_1778350143090: No token.txt file
  ✅ acc_1778350147301: ❌ Expired
  ⚠️  acc_1781026414633: No token.txt file
  ✅ acc_1781026421133: ⏰ 29d 23h left

📊 Summary:
   Total accounts: 4
   Valid tokens: 2

✅ tokens.json rebuilt successfully!
```

### Manual Fix

If the script doesn't work, you can manually rebuild:

```bash
# 1. Check account directories
ls -la session/accounts/

# 2. Verify token files exist
find session/accounts -name "token.txt"

# 3. Check a specific token
cat session/accounts/acc_XXXXXXX/token.txt

# 4. Run rebuild
npm run rebuild-tokens
```

## Understanding Token Status

After rebuilding, you'll see token status:

| Status | Meaning | Action |
|--------|---------|--------|
| ✅ Valid | Token is good to use | None needed |
| ⏰ Xd Xh left | Token expires in X days/hours | Plan re-authentication |
| ❌ Expired | JWT token has expired | Need to re-authenticate |
| ⚠️ No expiry | Cannot decode JWT expiry | Token may still work |

## Token Structure

Each token entry in `tokens.json`:

```json
{
  "id": "acc_1781026421133",
  "token": "eyJhbGci...",
  "resetAt": null,
  "invalid": false,
  "expiryTime": 1783618420000
}
```

- **id**: Account directory name
- **token**: JWT token string
- **resetAt**: Rate limit reset time (null = no limit)
- **invalid**: Marked as invalid (true = skip this token)
- **expiryTime**: JWT expiration time in milliseconds

## When to Rebuild

Rebuild tokens.json when:
- ✅ Server shows empty account list
- ✅ After manually adding token.txt files
- ✅ After extracting session archives
- ✅ After fixing permission issues
- ✅ When tokens seem missing

## Prevention

To keep tokens.json healthy:

1. **Always use the system** to add accounts (not manual file creation)
2. **Check permissions** after Docker operations: `npm run check-permissions`
3. **Backup regularly**: `cp session/tokens.json session/tokens.json.backup`
4. **Verify after uploads**: Check account list after sending archives via Telegram

## Related Scripts

```bash
# Check permissions
npm run check-permissions

# Fix permissions
npm run fix-permissions

# Rebuild tokens
npm run rebuild-tokens

# Check token expiry
node test_token_expiry.js
```

## Troubleshooting

### "No account directories found"
```bash
# Check if accounts exist
ls -la session/accounts/

# If empty, you need to add accounts
npm start
# Then choose option 1 to add account
```

### "No token.txt file"
```bash
# Check specific account
ls -la session/accounts/acc_XXXXXXX/

# If token.txt is missing, account is incomplete
# Need to re-authenticate
```

### Tokens still not showing after rebuild
```bash
# Check file permissions
ls -la session/tokens.json

# Fix if needed
sudo chown $USER:$USER session/tokens.json
chmod 644 session/tokens.json

# Rebuild again
npm run rebuild-tokens
```

## See Also

- [Permission Checking Guide](PERMISSION_CHECKING.md)
- [Token Expiry Checking](docs/TOKEN_EXPIRY_CHECKING.md)
- [Session Management](SESSION_MANAGEMENT_QUICKREF.md)
