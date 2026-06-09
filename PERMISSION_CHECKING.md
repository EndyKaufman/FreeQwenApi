# Permission Checking System

## Overview

FreeQwenApi now includes an automatic permission checking system that runs at startup to ensure all required directories and files have proper write permissions. This prevents runtime errors like `EACCES: permission denied` when the application tries to create sessions, write logs, or handle file uploads.

## How It Works

### Automatic Check at Startup

When you start the server with `npm start`, the permission checker runs **before** any other initialization:

1. Checks all required directories and files
2. Tests write permissions by creating temporary test files
3. Reports any permission issues with specific error messages
4. Provides exact commands to fix the issues
5. **Stops the server** if permissions are incorrect (prevents runtime errors)

### What Gets Checked

The system checks the following paths:

#### Directories
- `session/` - Main session directory
- `session/accounts/` - Individual account data
- `session/history/` - Chat history files
- `uploads/` - Temporary uploaded files
- `logs/` - Application logs
- `temp/` - Archive extraction temporary directory
- `session_backup/` - Backup sessions before updates

#### Important Files (if they exist)
- `session/tokens.json` - JWT token storage
- `session/auth_token.txt` - Authentication token
- `session/bot_settings.json` - Telegram bot settings
- `.env` - Environment configuration

## Example Output

### When Permissions Are Correct

```
2026-06-09 22:30:00 [info]: 🔍 Проверка прав доступа к директориям и файлам...
2026-06-09 22:30:00 [info]: ✅ Все директории и файлы доступны для записи
```

### When Permissions Are Incorrect

```
2026-06-09 22:30:00 [info]: 🔍 Проверка прав доступа к директориям и файлам...
2026-06-09 22:30:00 [error]: ❌ Обнаружены проблемы с правами доступа (3):

2026-06-09 22:30:00 [error]:   📁 session/accounts (directory)
2026-06-09 22:30:00 [error]:      Ошибка: EACCES: permission denied, open '/path/to/session/accounts/.write_test'
2026-06-09 22:30:00 [error]:      Решение:
       sudo chown -R $USER:$USER "/path/to/session/accounts"
       sudo chmod -R 755 "/path/to/session/accounts"

══════════════════════════════════════════════════════════════════════
🔧 Быстрое решение (скопируйте и выполните в терминале):
══════════════════════════════════════════════════════════════════════

  ⚡ ОДНОЙ СТРОКОЙ (рекомендуется):
  ────────────────────────────────────────────────────────────────────

  sudo chown -R $USER:$USER /path/to/session/accounts /path/to/session
  sudo chmod -R 755 /path/to/session/accounts /path/to/session

  📦 ИЛИ исправить все основные директории проекта:
  ────────────────────────────────────────────────────────────────────
  sudo chown -R $USER:$USER /path/to/session /path/to/uploads /path/to/logs /path/to/temp /path/to/session_backup
  sudo chmod -R 755 /path/to/session /path/to/uploads /path/to/logs /path/to/temp /path/to/session_backup

══════════════════════════════════════════════════════════════════════

2026-06-09 22:30:00 [error]: ⛔ НЕВОЗМОЖНО ЗАПУСТИТЬСЯ: Исправьте права доступа и перезапустите сервер
```

## How to Fix Permission Issues

### Option 1: Fix Specific Problematic Paths (Recommended)

Copy the commands shown in the error output. They will look something like:

```bash
sudo chown -R $USER:$USER /home/endy/Projects/FreeQwenApi/session/accounts /home/endy/Projects/FreeQwenApi/session
sudo chmod -R 755 /home/endy/Projects/FreeQwenApi/session/accounts /home/endy/Projects/FreeQwenApi/session
```

### Option 2: Fix All Project Directories

If you want to fix all directories at once:

```bash
sudo chown -R $USER:$USER session uploads logs temp session_backup
sudo chmod -R 755 session uploads logs temp session_backup
```

### Option 3: Use the Setup Script

The project includes a setup script that creates directories with proper permissions:

```bash
bash setup-dirs.sh
```

## Manual Permission Check

You can run the permission checker at any time (even when the server is not running):

```bash
# Using npm script
npm run check-permissions

# Or directly
node scripts/checkPermissions.js
```

## Common Scenarios

### After Docker Operations

Docker containers often run as different users (e.g., UID 1001), which can cause permission issues:

```bash
# Fix after Docker operations
sudo chown -R $USER:$USER session/
sudo chmod -R 755 session/
```

### After Cloning the Repository

```bash
# Create directories with proper permissions
bash setup-dirs.sh

# Or manually
mkdir -p session/accounts session/history uploads logs temp session_backup
chmod -R 755 session uploads logs temp session_backup
```

### When Moving Session Files

If you copy session files from another location:

```bash
# After copying, fix ownership
sudo chown -R $USER:$USER session/
sudo chmod -R 755 session/
```

## Why 755 Permissions?

- **755** (rwxr-xr-x) is the standard for directories:
  - Owner: read, write, execute
  - Group: read, execute
  - Others: read, execute

- **644** (rw-r--r--) is used for files:
  - Owner: read, write
  - Group: read
  - Others: read

This provides a good balance between functionality and security.

## Technical Details

### Implementation

The permission checker is implemented in:
- `src/utils/permissionChecker.js` - Core checking logic
- `scripts/checkPermissions.js` - Standalone script
- `index.js` - Startup integration

### How It Tests Permissions

For directories:
1. Creates a temporary test file
2. Writes test data
3. Deletes the test file
4. Reports success or failure

For files:
1. Checks if the file exists
2. Tests read/write access using `fs.accessSync()`
3. If file doesn't exist (optional), checks parent directory

### Auto-Creation of Missing Directories

If a required directory doesn't exist, the checker will attempt to create it automatically. If creation fails due to permissions, it reports the issue with fix commands.

## Best Practices

1. **Always check permissions after:**
   - Docker operations
   - Moving/copying files
   - System updates
   - User/ownership changes

2. **Run the checker before:**
   - Starting the server
   - Creating session archives
   - Uploading files
   - Running tests

3. **Use version control:**
   - The `.gitignore` files in each directory prevent tracking of sensitive data
   - Only `.gitkeep` files are tracked to ensure directories exist

## Troubleshooting

### "Permission denied" even after running chown

Try:
```bash
# Check current ownership
ls -la session/

# Force ownership change
sudo chown -R $(whoami):$(whoami) session/

# Verify
ls -la session/
```

### Issues with specific files

If only certain files have issues:
```bash
# Fix specific file
sudo chown $USER:$USER session/tokens.json
sudo chmod 644 session/tokens.json
```

### Docker-specific issues

If running in Docker:
```bash
# Inside container, check user
whoami
id

# Fix with correct UID
sudo chown -R 1001:1001 session/
```

## Related Documentation

- [Session Management Quick reference](SESSION_MANAGEMENT_QUICKREF.md)
- [Docker setup guide](README_DOCKER.md)
- [Environment configuration](docs/ENV_SETUP.md)
