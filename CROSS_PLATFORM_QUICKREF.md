# Quick Reference: Cross-Platform Usage

## Windows Users

### Installation

```powershell
# Using npx (no installation)
npx qwen-api-proxy init
npx qwen-api-proxy

# Or global installation
npm install -g qwen-api-proxy
qwen-api-proxy init
qwen-api-proxy
```

### Archive Command Options

**Option 1: PowerShell (Built-in, No Installation)**
```powershell
# Works automatically - no setup needed
qwen-api-proxy archive
```

**Option 2: Install zip (Optional)**
```powershell
# Via Chocolatey
choco install zip

# Then use normally
qwen-api-proxy archive
```

**Option 3: Install 7-Zip (Optional)**
```powershell
# Via Chocolatey
choco install 7zip

# Will be auto-detected
qwen-api-proxy archive
```

### Health Check

```powershell
qwen-api-proxy doctor
```

This will check:
- ✅ Node.js version
- ✅ Directory structure
- ✅ Archive tool availability (zip/7z/PowerShell)
- ✅ Write permissions
- ✅ Disk space (via wmic or PowerShell)
- ✅ Configuration files

---

## Linux Users

### Installation

```bash
# Using npx (no installation)
npx qwen-api-proxy init
npx qwen-api-proxy

# Or global installation
npm install -g qwen-api-proxy
qwen-api-proxy init
qwen-api-proxy
```

### Archive Command

**Install zip (Required)**
```bash
# Ubuntu/Debian
sudo apt install zip

# CentOS/RHEL
sudo yum install zip

# Then use
qwen-api-proxy archive
```

### Health Check

```bash
qwen-api-proxy doctor
```

This will check:
- ✅ Node.js version
- ✅ Directory structure
- ✅ Archive tool availability (zip)
- ✅ Write permissions
- ✅ Disk space (via df)
- ✅ Configuration files

---

## macOS Users

### Installation

```bash
# Using npx (no installation)
npx qwen-api-proxy init
npx qwen-api-proxy

# Or global installation
npm install -g qwen-api-proxy
qwen-api-proxy init
qwen-api-proxy
```

### Archive Command

**Install zip**
```bash
# Via Homebrew
brew install zip

# Then use
qwen-api-proxy archive
```

### Health Check

```bash
qwen-api-proxy doctor
```

This will check:
- ✅ Node.js version
- ✅ Directory structure
- ✅ Archive tool availability (zip)
- ✅ Write permissions
- ✅ Disk space (via df)
- ✅ Configuration files

---

## Cross-Platform Commands

### Test Cross-Platform Compatibility

```bash
npm run test:cross-platform
```

Runs 10 automated tests to verify:
- ESM module loading
- Path resolution
- File system operations
- Platform detection
- Archive tools
- Disk space detection
- Environment variables
- CLI structure

### Common Commands

```bash
# Initialize working directory
qwen-api-proxy init

# Start the server
qwen-api-proxy

# Create session archive
qwen-api-proxy archive

# System health check
qwen-api-proxy doctor

# Run with custom directory
qwen-api-proxy --dir=/path/to/directory

# Run with setup flag
qwen-api-proxy --setup
```

---

## Troubleshooting

### Windows: ESM URL Error

**Error**: `ERR_UNSUPPORTED_ESM_URL_SCHEME`

**Solution**: Already fixed in v1.0.21. Update to latest version:
```powershell
npm update -g qwen-api-proxy
```

### Windows: Archive Command Fails

**Error**: `zip command not found`

**Solutions**:

1. **Use PowerShell (no installation)**:
   - Already supported as fallback
   - Should work automatically

2. **Install zip**:
   ```powershell
   choco install zip
   ```

3. **Install 7-Zip**:
   ```powershell
   choco install 7zip
   ```

### Linux/macOS: Archive Command Fails

**Error**: `zip command not found`

**Solution**:
```bash
# Ubuntu/Debian
sudo apt install zip

# macOS
brew install zip
```

### Permission Errors

**Windows**:
```powershell
# Run as Administrator
# Or ensure you have write permissions to the directory
```

**Linux/macOS**:
```bash
chmod -R 755 session logs uploads temp
chown -R $USER:$USER session logs uploads temp
```

### Node.js Version Error

**Error**: `Minimum Node.js version 18 required`

**Solution**:
```bash
# Check current version
node --version

# If < 18, upgrade Node.js
# https://nodejs.org/
```

---

## Verification Checklist

After installation, verify everything works:

```bash
# 1. Check Node.js version (should be >= 18)
node --version

# 2. Run cross-platform tests
npm run test:cross-platform

# 3. Run health check
qwen-api-proxy doctor

# 4. Initialize directory
qwen-api-proxy init

# 5. Start server
qwen-api-proxy
```

All steps should complete without errors.

---

## Quick Links

- **Full Cross-Platform Guide**: [CROSS_PLATFORM.md](CROSS_PLATFORM.md)
- **Fix Summary**: [CROSS_PLATFORM_FIX_SUMMARY.md](CROSS_PLATFORM_FIX_SUMMARY.md)
- **Node.js Compatibility**: [NODE_COMPATIBILITY.md](NODE_COMPATIBILITY.md)
- **Main README**: [README.md](README.md)
- **npm Guide**: [README_NPM.md](README_NPM.md)

---

## Getting Help

If you encounter platform-specific issues:

1. **Run diagnostics**:
   ```bash
   npm run test:cross-platform
   qwen-api-proxy doctor
   ```

2. **Collect information**:
   - Operating System: (e.g., Windows 11, Ubuntu 22.04, macOS 14.2)
   - Node.js version: `node --version`
   - Shell: (PowerShell 7.4, Bash 5.1, Zsh 5.9)
   - Error message: (full stack trace)
   - Command run: (what command caused the error)

3. **Report the issue**:
   - GitHub Issues: https://github.com/EndyKaufman/FreeQwenApi/issues
   - Include all information from step 2

---

## Version History

### v1.0.21 (Current)
- ✅ Full Windows support
- ✅ Cross-platform archive command
- ✅ Cross-platform health checks
- ✅ Automated testing suite

### v1.0.10 and Earlier
- ❌ Limited Windows support
- ❌ Unix-only commands
- ❌ No automated cross-platform testing
