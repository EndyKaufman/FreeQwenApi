# Cross-Platform Compatibility Guide

## Supported Platforms

✅ **Windows** (10/11, Server 2019+)
✅ **Linux** (Ubuntu 18.04+, Debian 10+, CentOS 8+, etc.)
✅ **macOS** (10.15+, including Apple Silicon)

## Node.js Requirements

- **Minimum Version**: Node.js 18.0.0
- **Recommended**: Node.js 20.x or 22.x (LTS)
- **ESM Support**: Required (all files use ES modules)

## Windows-Specific Notes

### ESM Module Loading
The application uses `pathToFileURL()` to convert Windows paths (e.g., `C:\path\to\file.js`) to proper `file://` URLs required by Node.js ESM loader.

**Fixed in**: `bin/qwen-api-proxy.js` line 414

### Archive Command
On Windows, the `archive` command supports multiple backends:
1. **zip** (if installed via Chocolatey: `choco install zip`)
2. **PowerShell Compress-Archive** (built-in fallback)
3. **7-Zip** (alternative: `choco install 7zip`)

### Health Check (`doctor` command)
Disk space checking on Windows uses:
1. **wmic** (Windows Management Instrumentation)
2. **PowerShell** (fallback: `Get-PSDrive`)

### Path Handling
All paths use Node.js `path` module which automatically handles:
- Windows: `C:\Users\Endy\Desktop\ss`
- Linux/macOS: `/home/endy/projects/ss`

## Linux/macOS Notes

### Archive Command
Requires `zip` utility:
```bash
# Ubuntu/Debian
sudo apt install zip

# CentOS/RHEL
sudo yum install zip

# macOS
brew install zip
```

### Health Check (`doctor` command)
Uses standard Unix `df` command for disk space checking.

## Common Issues & Solutions

### Issue: `ERR_UNSUPPORTED_ESM_URL_SCHEME` on Windows
**Cause**: Using `path.join()` with `import()` creates invalid `C:\` URLs
**Solution**: Already fixed - uses `pathToFileURL()` for cross-platform compatibility

### Issue: `zip command not found`
**Windows**: 
```powershell
# Option 1: Install zip via Chocolatey
choco install zip

# Option 2: Install 7-Zip (will be auto-detected)
choco install 7zip

# Option 3: Use built-in PowerShell (no installation needed)
# The archive command will automatically fallback to PowerShell
```

**Linux**:
```bash
sudo apt install zip  # Ubuntu/Debian
sudo yum install zip  # CentOS/RHEL
```

**macOS**:
```bash
brew install zip
```

### Issue: Permission errors on startup
**Windows**: Run Command Prompt/PowerShell as Administrator
**Linux/macOS**: 
```bash
chmod -R 755 session logs uploads temp
chown -R $USER:$USER session logs uploads temp
```

## Testing Cross-Platform Compatibility

### Quick Health Check
```bash
qwen-api-proxy doctor
```

This will verify:
- ✅ Node.js version (>= 18)
- ✅ Directory structure
- ✅ Archive tool availability (zip/7z/PowerShell)
- ✅ Write permissions
- ✅ Disk space
- ✅ Configuration files

### Manual Testing

**Windows (PowerShell)**:
```powershell
# Test ESM loading
node --version  # Should be >= 18
npx qwen-api-proxy init
npx qwen-api-proxy

# Test archive command
npx qwen-api-proxy archive
```

**Linux/macOS (Bash)**:
```bash
# Test ESM loading
node --version  # Should be >= 18
npx qwen-api-proxy init
npx qwen-api-proxy

# Test archive command
npx qwen-api-proxy archive
```

## Development Notes

### Path Resolution
Always use these patterns for cross-platform compatibility:

```javascript
// ✅ CORRECT
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'some-file.js');

// For dynamic imports
await import(pathToFileURL(filePath).href);

// ❌ WRONG (will fail on Windows)
await import(filePath);
```

### Shell Commands
When executing shell commands, always check the platform:

```javascript
const isWindows = process.platform === 'win32';

if (isWindows) {
    // Use Windows commands (powershell, wmic, etc.)
    execSync('powershell -Command "..."');
} else {
    // Use Unix commands (df, ls, etc.)
    execSync('df -k .');
}
```

### Environment Variables
Windows uses different syntax for setting environment variables:

**Windows (CMD)**:
```cmd
set PORT=3000
node index.js
```

**Windows (PowerShell)**:
```powershell
$env:PORT=3000
node index.js
```

**Linux/macOS**:
```bash
PORT=3000 node index.js
```

## CI/CD Testing

If you're setting up CI/CD, test on all platforms:

```yaml
# GitHub Actions example
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node-version: [18, 20, 22]
```

## Reporting Platform-Specific Issues

When reporting issues, include:
1. **Operating System**: Windows 11 / Ubuntu 22.04 / macOS 14.2
2. **Node.js Version**: `node --version`
3. **Shell**: PowerShell 7.4 / Bash 5.1 / Zsh 5.9
4. **Error Message**: Full stack trace
5. **Command Run**: What command caused the error