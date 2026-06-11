# Browser Profile Persistence Mode

## Overview

The `BROWSER_PERSISTENCE_MODE=profile` feature enables full browser state persistence using Puppeteer's `userDataDir` option. This mode provides a more robust and complete way to maintain browser sessions compared to the legacy token/cookie approach.

## How It Works

### Profile Mode (`BROWSER_PERSISTENCE_MODE=profile`)

When enabled, the browser:
- **Persists complete state**: cookies, localStorage, sessionStorage, IndexedDB, browser cache, and all other browser data
- **Uses a dedicated tab**: All API requests go through a single browser tab, ensuring consistent state
- **Auto-loads latest profile**: On startup, the most recently modified profile is automatically loaded
- **Saves after each response**: Browser state is automatically persisted to disk after API operations
- **Disables legacy mechanisms**: The old `token.txt` and `cookies.json` loading/saving is completely bypassed

### Legacy Mode (`BROWSER_PERSISTENCE_MODE=legacy`, default)

The traditional approach:
- Manually saves and loads `cookies.json` and `token.txt` files
- Uses a page pool with multiple tabs
- Requires explicit session management per account

## Configuration

### Environment Variable

Add to your `.env` file:

```env
# Enable full browser profile persistence
BROWSER_PERSISTENCE_MODE=profile

# Or use the legacy mode (default)
# BROWSER_PERSISTENCE_MODE=legacy
```

## Storage Location

Browser profiles are stored in:

```
session/browser-profiles/
└── default/          # The active browser profile
    ├── Cookies       # Chrome cookie storage
    ├── Local Storage # localStorage data
    ├── Session Storage # sessionStorage data
    ├── IndexedDB     # IndexedDB databases
    └── ...           # Other Chrome internal data
```

## Usage

### Initial Setup (First Time Authentication)

1. Set `BROWSER_PERSISTENCE_MODE=profile` in your `.env`
2. Start the service: `node index.js`
3. The browser will open with a **fresh profile** (no previous state)
4. Complete the authentication process in the browser
5. Press ENTER in the console to continue
6. The browser state is automatically saved to `session/browser-profiles/default/`

### Subsequent Starts

1. The service automatically loads the **most recent profile** from `session/browser-profiles/`
2. No manual authentication required (if session is still valid)
3. All requests use the same dedicated browser tab

### Profile Reset

To start fresh authentication:

```bash
# Remove the existing profile
rm -rf session/browser-profiles/default

# Restart the service - it will create a new profile
node index.js
```

## Key Differences from Legacy Mode

| Feature | Profile Mode | Legacy Mode |
|---------|-------------|-------------|
| **State Storage** | Complete Chrome profile | cookies.json + token.txt |
| **Tab Management** | Single dedicated tab | Page pool (multiple tabs) |
| **Session Load** | Automatic via userDataDir | Manual cookie injection |
| **Session Save** | Automatic Chrome persistence | Manual saveSession() calls |
| **localStorage** | ✅ Persisted | ❌ Not persisted |
| **sessionStorage** | ✅ Persisted | ❌ Not persisted |
| **IndexedDB** | ✅ Persisted | ❌ Not persisted |
| **Browser Cache** | ✅ Persisted | ❌ Not persisted |
| **Multiple Accounts** | ❌ One profile per instance | ✅ Multiple accounts supported |

## Advantages

1. **More Reliable**: Complete browser state means fewer authentication issues
2. **Simpler Architecture**: No need to manually manage cookies and tokens
3. **Better Security**: All browser security mechanisms are preserved
4. **Faster Startup**: No cookie loading delays
5. **More Human-like**: Single tab usage pattern is less detectable

## Limitations

1. **Single Account**: Only one browser profile can be active at a time
2. **Disk Space**: Chrome profiles can grow to 50-200MB
3. **No Account Switching**: Cannot switch between different accounts dynamically

## Migration from Legacy Mode

If you're switching from legacy mode:

1. Stop the service
2. Set `BROWSER_PERSISTENCE_MODE=profile` in `.env`
3. Start the service - it will create a fresh profile
4. Re-authenticate when prompted
5. (Optional) Backup old session data: `cp -r session/accounts session/accounts-backup`

## Technical Details

### Profile Selection Logic

On startup (when not in authentication mode):
```javascript
1. Scan session/browser-profiles/ directory
2. Get all subdirectories (profiles)
3. Sort by modification time (newest first)
4. Load the most recent profile
```

### Profile Creation Logic

During authentication:
```javascript
1. Create fresh profile at session/browser-profiles/default/
2. Launch browser with userDataDir pointing to this path
3. User completes authentication
4. Chrome automatically saves all state to disk
```

### State Persistence

After each API request:
- Chrome automatically persists state to disk (no manual save needed)
- On shutdown, a 1-second delay ensures all data is flushed to disk
- No explicit cookie/token extraction required

## Troubleshooting

### Authentication Lost After Restart

**Problem**: Need to re-authenticate every time

**Solutions**:
1. Check if profile directory exists: `ls -la session/browser-profiles/`
2. Verify profile has recent modification time
3. Check logs for profile loading errors
4. Try removing and recreating the profile

### Profile Directory Not Created

**Problem**: `session/browser-profiles/` directory is empty

**Solutions**:
1. Ensure `BROWSER_PERSISTENCE_MODE=profile` is set
2. Check file permissions on `session/` directory
3. Look for errors in startup logs

### Multiple Profiles Accumulating

**Problem**: Many old profiles taking up disk space

**Solution**:
```bash
# List all profiles with sizes
du -sh session/browser-profiles/*/

# Remove old profiles (keep only 'default')
rm -rf session/browser-profiles/old-profile-*
```

## Best Practices

1. **Monitor Disk Space**: Profiles can grow over time
2. **Regular Backups**: Backup the profile directory periodically
3. **Test After Updates**: Browser updates may affect profile compatibility
4. **Use in Production**: Profile mode is more stable for single-account production use
5. **Legacy for Multi-Account**: Use legacy mode if you need multiple account support

## Examples

### Docker Configuration

```yaml
environment:
  - BROWSER_PERSISTENCE_MODE=profile
  - SESSION_DIR=session

volumes:
  - ./session:/app/session
```

### Docker Compose

```yaml
services:
  qwen-api:
    environment:
      - BROWSER_PERSISTENCE_MODE=profile
    volumes:
      - ./data/session:/app/session
```

### Development Setup

```bash
# .env
BROWSER_PERSISTENCE_MODE=profile
MOUSE_MOVEMENT_DURATION=2000

# Start the service
npm start
```

## Future Enhancements

Potential improvements being considered:
- Multiple named profiles with profile switching
- Automatic profile cleanup based on age
- Profile compression to reduce disk usage
- Profile backup/restore commands
