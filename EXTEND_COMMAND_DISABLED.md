# /extend Command - Temporarily Disabled

## ⚠️ Status: DISABLED

The `/extend` command in Telegram bot is **temporarily disabled** for technical maintenance.

## 📅 Timeline

- **Disabled:** June 10, 2026
- **Expected Re-enable:** TBD (will be announced)

## 🔍 Reason

The session extension system requires additional work to ensure reliable operation with:
- Cookie-based authentication
- Token validation
- Session health checks

## 🛠️ Workaround

### Create New Sessions

Instead of extending existing sessions, create new ones:

```bash
npm run create-session-archive
```

This will:
1. Open browser for authentication
2. Allow you to login to Qwen
3. Save session with cookies
4. Create ZIP archive

### Upload via Telegram

After creating the archive:
1. Open Telegram bot
2. Click 📎 (paperclip)
3. Select "File" (NOT "Photo"!)
4. Send the ZIP archive
5. Wait for confirmation

### Console Extension (Still Available)

If you have server access, you can still use:

```bash
npm run extend-session
```

This command works independently of the Telegram bot.

## 📋 What's Affected

| Feature | Status | Alternative |
|---------|--------|-------------|
| Telegram `/extend` | ❌ Disabled | Use `npm run create-session-archive` |
| Console `npm run extend-session` | ✅ Works | N/A |
| Session creation | ✅ Works | N/A |
| Archive upload | ✅ Works | N/A |

## 🔔 Re-enable Notification

When the `/extend` command is re-enabled:
1. Update will be announced in project releases
2. Documentation will be updated
3. Telegram bot help message will be restored

## 💡 Why Disable Instead of Fix?

The current implementation has issues:
- Tokens without cookies cannot be extended
- Confusing error messages
- Inconsistent behavior

Rather than patching, we're doing a proper refactor to ensure:
- Reliable session extension
- Clear error messages
- Automatic cookie validation
- Better user experience

## 📞 Support

If you have questions or need help:
- Check documentation in `/docs` folder
- Review `SESSION_EXTENSION_FIX.md`
- Create an issue on GitHub

## ✨ Improvements Coming

When re-enabled, `/extend` will have:
- ✅ Automatic cookie validation
- ✅ Better error messages
- ✅ Progress indicators
- ✅ Selective extension (choose accounts)
- ✅ Health checks before extension
- ✅ Automatic cleanup of expired sessions

---

**Last Updated:** June 10, 2026  
**Status:** 🔧 Maintenance in progress
