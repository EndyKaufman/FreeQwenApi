# NPM Publication Summary

## Overview
The qwen-api-proxy package has been prepared for global npm installation. When installed globally, it creates all necessary files and directories in the current working directory where the command is executed.

## Key Changes

### 1. CLI Entry Point (`bin/qwen-api-proxy.js`)
- Created executable CLI wrapper for global installation
- Automatically sets up working directory structure on first run
- Creates necessary directories: `session/`, `logs/`, `uploads/`, `temp/`
- Creates `.env` and `.env.example` files if they don't exist
- Sets `QWEN_API_PROXY_GLOBAL=true` environment variable
- Validates .gitignore files and warns if they're missing the `*` rule

### 2. Configuration Updates (`src/config.js`)
- Added detection for global vs local installation
- Uses `process.cwd()` for global installs, package root for development
- Exports `BASE_DIR` for use in other modules
- Loads `.env` from working directory in global mode

### 3. Package Configuration (`package.json`)
- Added `bin` field: `"qwen-api-proxy": "./bin/qwen-api-proxy.js"`
- Added `files` field to include only necessary files in npm package
- Updated metadata: author, keywords, repository URLs
- Added `archive` npm script

### 4. GitIgnore Validation
The setup script now:
- Creates `.gitignore` files with `*` rule in all data directories
- Checks existing `.gitignore` files for the `*` rule
- Shows warning if .gitignore exists but doesn't protect the directory
- Prevents accidental exposure of sensitive session data

### 5. NPM Ignore File (`.npmignore`)
Created comprehensive `.npmignore` to exclude:
- Development files (tests, examples, scripts)
- Runtime data (session, logs, uploads, temp)
- Docker files
- Documentation (except README.md)
- IDE and OS files

## Installation & Usage

### Global Installation
```bash
npm install -g qwen-api-proxy
```

### First Run
```bash
cd /your/project/directory
qwen-api-proxy
```

This will:
1. Create all necessary directories
2. Create `.env` and `.env.example` files
3. Add `.gitignore` files to protect sensitive data
4. Start the interactive server menu

### CLI Commands

```bash
# Start server (interactive)
qwen-api-proxy

# Start server (non-interactive)
NON_INTERACTIVE=1 qwen-api-proxy

# Create session archive
qwen-api-proxy archive
qwen-api-proxy --archive

# Force setup
qwen-api-proxy --setup
```

## Directory Structure

After first run in your working directory:

```
your-directory/
├── session/              # Session data and tokens
│   ├── .gitignore        # Auto-generated: *
│   ├── accounts/         # Account credentials
│   │   ├── .gitignore
│   │   └── acc_*/        # Individual accounts
│   │       ├── token.txt
│   │       └── cookies.json
│   └── history/          # Chat history
│       ├── .gitignore
│       └── *.json
├── logs/                 # Server logs
│   └── .gitignore        # Auto-generated: *
├── uploads/              # Uploaded files
│   └── .gitignore        # Auto-generated: *
├── temp/                 # Temporary files
│   └── .gitignore        # Auto-generated: *
├── .env                  # Configuration
└── .env.example          # Example configuration
```

## .gitignore Validation

The setup script checks for the `*` rule in .gitignore files:

### Example Warning
```
⚠️  WARNING: The following directories may be tracked by git:
   - session/.gitignore exists but doesn't contain "*" rule

   This may expose sensitive session data and tokens!
   Please add "*" to these .gitignore files or delete them to auto-regenerate.
```

### Correct .gitignore Content
```gitignore
# Auto-generated - do not commit
*
!.gitignore
```

## Testing

### Test Global Installation
```bash
# Install globally from local directory
npm install -g /path/to/FreeQwenApi

# Test in temporary directory
cd /tmp
mkdir test-project && cd test-project
qwen-api-proxy --setup

# Verify directories created
ls -la

# Test archive command
qwen-api-proxy archive
```

### Test .gitignore Validation
```bash
# Create directory with bad .gitignore
mkdir test-bad-gitignore && cd test-bad-gitignore
mkdir session
echo "# custom rules" > session/.gitignore

# Run setup - should show warning
qwen-api-proxy --setup
```

## Environment Variables

All paths are now relative to working directory:

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_DIR` | Session directory | `session` |
| `UPLOADS_DIR` | Uploads directory | `uploads` |
| `LOGS_DIR` | Logs directory | `logs` |
| `TEMP_DIR` | Temp directory | `temp` |
| `QWEN_API_PROXY_GLOBAL` | Auto-set to `true` for global installs | - |

## Backward Compatibility

- Local development (`npm start`) still works as before
- All paths resolve correctly in both modes
- Docker deployment unchanged
- Existing installations unaffected

## Publishing to npm

```bash
# Login to npm
npm login

# Test package locally
npm pack
tar -tzf qwen-api-proxy-*.tgz | head -20

# Publish
npm publish

# Or with specific tag
npm publish --tag beta
```

## Package Contents

The published package includes:
```
qwen-api-proxy/
├── bin/
│   └── qwen-api-proxy.js      # CLI entry point
├── src/                        # Source code
│   ├── api/
│   ├── browser/
│   ├── logger/
│   ├── utils/
│   └── config.js
├── index.js                    # Main server file
├── .env.example                # Configuration template
└── README.md                   # Documentation
```

## Security Considerations

1. **Session Data**: All session data created in working directory, not in package
2. **.gitignore**: Auto-generated to prevent accidental commits
3. **Warnings**: Users alerted if .gitignore is misconfigured
4. **Environment**: Sensitive data in `.env`, never in package
5. **Permissions**: Directories created with proper permissions

## Future Enhancements

- [x] Add `qwen-api-proxy init` command for manual setup
- [x] Support custom working directory via `--dir` flag
- [x] Add `qwen-api-proxy doctor` for system checks
- [ ] Create systemd service generator
- [ ] Add update/migrate command for version upgrades

## Troubleshooting

### Command not found after global install
```bash
# Check npm global bin directory
npm config get prefix

# Add to PATH if needed
export PATH=$(npm config get prefix)/bin:$PATH
```

### Permission denied on first run
```bash
# Fix directory permissions
chmod -R 755 session logs uploads temp
```

### .gitignore warnings
```bash
# Option 1: Delete and let it regenerate
rm session/.gitignore
qwen-api-proxy --setup

# Option 2: Manually add the rule
echo "*" >> session/.gitignore
```

## Migration Guide

### From Docker to Global Install
```bash
# Install globally
npm install -g qwen-api-proxy

# Create working directory
mkdir ~/qwen-proxy && cd ~/qwen-proxy

# Copy .env from Docker
cp /path/to/docker/.env .

# Copy session data (optional)
cp -r /path/to/docker/session ./

# Start
qwen-api-proxy
```

### From Local Dev to Global Install
```bash
# Your working directory already has everything
cd /your/existing/project

# Just run the global command
qwen-api-proxy

# It will use existing directories and .env
```
