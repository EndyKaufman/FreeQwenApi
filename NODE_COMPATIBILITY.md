# Node.js Compatibility

## Supported Versions

- **Node.js 18.x** (LTS) - ✅ Fully supported
- **Node.js 20.x** (LTS) - ✅ Fully supported  
- **Node.js 21.x** - ✅ Fully supported
- **Node.js 22.x** (LTS) - ✅ Fully supported
- **Node.js 23.x** (Current) - ✅ Fully supported

## Minimum Requirements

- **Minimum Node.js version**: 18.0.0
- **ESM support**: Required (all files use ES modules)
- **Top-level await**: Required (used in async initialization)

## Features Used

The codebase uses the following Node.js features available since v18:

### ES Modules (ESM)
```javascript
import express from 'express';
import { fileURLToPath } from 'url';
```

All files use `"type": "module"` in package.json for ESM support.

### Top-Level Await
```javascript
// In bin/qwen-api-proxy.js
await import(path.join(PACKAGE_ROOT, 'index.js'));
```

Available since Node.js 14.8.0, fully stable in Node.js 18+.

### import.meta.url
```javascript
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

Used for resolving paths in ESM context.

### Dynamic Imports
```javascript
const { sendMessage } = await import('../api/chat.js');
```

Used for lazy loading modules and avoiding circular dependencies.

## Dependency Compatibility

All dependencies are compatible with Node.js 18+:

| Package | Version | Node 18 Support |
|---------|---------|-----------------|
| express | ^4.18.2 | ✅ |
| puppeteer | ^24.31.0 | ✅ (requires Node 18+) |
| openai | ^4.104.0 | ✅ |
| undici | ^8.3.0 | ✅ |
| node-fetch | ^3.3.2 | ✅ (ESM only) |
| dotenv | ^16.6.1 | ✅ |
| winston | ^3.17.0 | ✅ |

## Version Management

### Using nvm (Recommended)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js 18
nvm install 18

# Use Node.js 18
nvm use 18

# Set as default
nvm alias default 18
```

### Using .nvmrc

The project includes a `.nvmrc` file specifying Node.js 18:

```bash
# Automatically use the version in .nvmrc
nvm use
```

## Troubleshooting

### Error: "SyntaxError: Cannot use import statement outside a module"

**Solution**: Ensure you're using Node.js 18+ and the project has `"type": "module"` in package.json.

```bash
node --version  # Should be v18.0.0 or higher
```

### Error: "await is only valid in async functions"

**Solution**: Top-level await requires Node.js 14.8.0+. Upgrade to Node.js 18+.

```bash
nvm install 18
nvm use 18
```

### Error: "Engine incompatible"

If you see warnings about Node.js version during installation:

```bash
# Check your Node.js version
node --version

# Upgrade if needed
nvm install 18
nvm use 18
```

## Testing Compatibility

To test with a specific Node.js version:

```bash
# Install specific version
nvm install 18.20.0

# Use it
nvm use 18.20.0

# Run the application
qwen-api-proxy

# Or from source
npm start
```

## Why Node.js 18?

Node.js 18 was chosen because:

1. **LTS Support**: Long-term support until April 2025
2. **Stable ESM**: Full ES modules support
3. **Top-level await**: Native support without flags
4. **Modern Features**: Includes fetch API, test runner, etc.
5. **Wide Adoption**: Most widely used LTS version

## Migration from Older Versions

If you're upgrading from Node.js 16 or older:

```bash
# Install Node.js 18+
nvm install 18

# Update dependencies
npm install

# Test the application
npm start
```

No code changes should be needed - the application is fully backward compatible with Node.js 18+.
