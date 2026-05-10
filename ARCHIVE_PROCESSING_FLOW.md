# Archive Processing Flow

## Overview
The application now processes uploaded archives on startup BEFORE any other initialization. This ensures sessions are extracted before the browser and API are initialized.

## Flow Diagram

### 1. Archive Upload (via Telegram Bot)
```
User uploads .zip/.7z archive
    ↓
Bot downloads and saves to temp/
    ↓
Creates .pending_archive flag file with:
  - archivePath
  - fileName
  - ext
  - uploadedAt
    ↓
Bot initiates graceful restart (process.exit(42))
    ↓
User sees: "✅ Archive saved, will be extracted on restart"
```

### 2. Application Startup
```
startServer() called
    ↓
FIRST: Check for .pending_archive file
    ↓
├─ EXISTS → Process archive
│   ↓
│   Read .pending_archive JSON
│   ↓
│   Verify archive file exists
│   ↓
│   Extract to session/ (NO backup on first run)
│   ↓
│   Delete .pending_archive flag
│   ↓
│   Delete archive file from temp/
│   ↓
│   Continue with normal startup
│
└─ NOT EXISTS → Continue with normal startup
    ↓
Check .restart_flag (if exists)
    ↓
Initialize browser (if tokens exist)
    ↓
Start Telegram bot
    ↓
Start API server
```

## Key Files

### `.pending_archive`
- **Location**: Project root
- **Format**: JSON
- **Content**:
```json
{
  "archivePath": "/path/to/temp/archive.zip",
  "fileName": "sessions.zip",
  "ext": ".zip",
  "uploadedAt": "2026-05-10T13:45:30.000Z"
}
```
- **Purpose**: Signals that an archive needs extraction on next startup
- **Deleted**: After successful extraction or if archive file is missing

### `.restart_flag`
- **Location**: Project root
- **Format**: JSON
- **Content** (when archive is pending):
```json
{
  "reason": "telegram_session_upload_with_archive",
  "timestamp": "2026-05-10T13:45:30.000Z",
  "chatId": "123456789",
  "hasPendingArchive": true
}
```
- **Purpose**: Signals Docker Compose to restart the container
- **Deleted**: On startup after reading

## Implementation Details

### telegramBot.js

#### `handleDocument(chatId, document)`
1. Downloads archive from Telegram
2. Saves to `temp/` directory
3. Creates `.pending_archive` flag
4. Calls `gracefulRestart(chatId)`

#### `processPendingArchive()`
- **Exported**: Yes (used by index.js)
- **Returns**: `boolean` (true if archive was processed)
- **Called**: At the very beginning of `startServer()`
- **Behavior**:
  - Checks for `.pending_archive` file
  - Extracts archive directly (no backup)
  - Deletes both flag and archive file
  - Handles errors gracefully (deletes flag to prevent blocking)

#### `gracefulRestart(chatId)`
- Creates `.restart_flag` with `hasPendingArchive: true` if archive exists
- Exits with code 42 (Docker Compose restart signal)

### index.js

#### `startServer()`
```javascript
async function startServer() {
    // FIRST: Process pending archive
    const archiveProcessed = await processPendingArchive();
    if (archiveProcessed) {
        logInfo('✅ Pending archive successfully extracted on startup');
    }
    
    // THEN: Check restart flag
    // THEN: Normal startup...
}
```

## Git/Docker Configuration

### .gitignore
```
.restart_flag
.pending_archive
temp
```

### .dockerignore
```
.restart_flag
.pending_archive
temp
```

## Error Handling

### Archive File Missing
- If `.pending_archive` exists but archive file is deleted:
  - Logs warning
  - Deletes `.pending_archive` flag
  - Continues startup normally

### Extraction Error
- Logs error details
- Deletes `.pending_archive` flag (prevents blocking)
- Continues startup (may fail later if tokens missing)

### Invalid JSON in Flag
- Caught by try-catch in `processPendingArchive()`
- Deletes corrupted flag
- Returns false

## Benefits

1. **Atomic Operation**: Archive extraction happens before any services start
2. **No Race Conditions**: Browser/API don't try to read sessions while extracting
3. **Clean State**: Old archive and flag are deleted after extraction
4. **Resilient**: Errors don't block startup
5. **Transparent**: User gets clear feedback at each step

## Testing

### Manual Test
1. Upload archive via Telegram bot
2. Verify `.pending_archive` is created
3. Wait for restart
4. Check logs for: "🔄 Detected pending archive for extraction"
5. Verify sessions are extracted
6. Verify `.pending_archive` and archive file are deleted

### Log Messages
```
🔄 Обнаружен ожидающий архив для распаковки
📂 Архив: sessions.zip
📍 Путь: /app/temp/sessions.zip
📦 Распаковка архива...
✅ ZIP архив распакован: 45 файлов успешно, 0 ошибок
✅ Архив успешно распакован
🗑️ Удален флаг .pending_archive
🗑️ Удален временный архив
✅ Ожидющий архив успешно распакован при запуске
```
