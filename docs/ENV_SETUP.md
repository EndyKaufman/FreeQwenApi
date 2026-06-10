# Environment Configuration Guide

## How .env Loading Works

### Docker Compose (Production)
When using `docker compose up`, the `.env` file is loaded automatically:

```bash
docker compose up -d
```

**How it works:**
1. Docker Compose reads `.env` from project root
2. Variables passed to container via `env_file` directive
3. Container receives all environment variables
4. Application uses `process.env.*` directly

**docker-compose.yml:**
```yaml
services:
  qwen-proxy:
    env_file:
      - .env  # Loads all variables from .env
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      # ... more variables
```

### Direct Node.js (Development)
When running `node index.js` directly, `dotenv` package loads `.env`:

```bash
npm install
node index.js
```

**How it works:**
1. `index.js` imports `dotenv` package
2. `dotenv.config()` reads `.env` file
3. Variables added to `process.env`
4. Application uses `process.env.*`

**index.js:**
```javascript
import dotenv from 'dotenv';
const dotenvResult = dotenv.config();
if (dotenvResult.error) {
    console.warn('⚠️  .env file not found, using environment variables');
} else {
    console.log('✅ .env file loaded');
}
```

## Setup

### 1. Create .env File

Copy the example:
```bash
cp .env.example .env
```

### 2. Edit .env

```bash
nano .env
```

**Required variables:**
```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_USER_IDS=your_user_id_here

# Optional: Proxy (if Telegram is blocked)
TELEGRAM_PROXY=http://proxy.example.com:8080

# Optional: Token expiry warning (default: 1 hour)
TOKEN_EXPIRY_WARNING_MS=3600000

# Optional: Default model for LLM chat
DEFAULT_MODEL=qwen-max-latest
```

### 3. Run

**With Docker Compose:**
```bash
docker compose build
docker compose up -d

# Check logs
docker compose logs -f
```

**With Node.js directly:**
```bash
npm install
node index.js
```

## Verification

### Docker Compose
```bash
# Verify variables loaded
docker compose exec qwen-proxy env | grep TELEGRAM

# Should show:
TELEGRAM_BOT_TOKEN=
TELEGRAM_USER_IDS=
TELEGRAM_PROXY=
```

### Direct Node.js
```bash
node index.js

# Should show at startup:
✅ .env файл загружен
```

## .env File Format

```bash
# Comments start with #
KEY=value
KEY2="value with spaces"
KEY3='single quotes work too'

# Boolean values
BOOL_KEY=true

# Numbers (still strings in env)
NUMBER_KEY=3600000

# Comma-separated lists
LIST_KEY=value1,value2,value3
```

## Important Notes

### 1. Security
- **NEVER commit `.env` to git**
- `.env` is in `.gitignore`
- Use `.env.example` as template
- Keep tokens and passwords secret

### 2. Docker vs Local

| Aspect | Docker Compose | Direct Node.js |
|--------|---------------|----------------|
| .env location | Project root | Project root |
| Loading method | `env_file` directive | `dotenv` package |
| Variables in container | ✅ Passed via env | ✅ Loaded from file |
| Need .env in image | ❌ No | ❌ No (loaded at runtime) |

### 3. Variable Precedence

**Docker Compose:**
1. Environment variables (already set in shell)
2. `.env` file values
3. Default values in `${VAR:-default}`

**Direct Node.js:**
1. Environment variables (already set in shell)
2. `.env` file values (via dotenv)

### 4. Common Issues

**Issue:** Variables not loaded
```bash
# Check .env exists
ls -la .env

# Check format (no spaces around =)
KEY=value  ✅
KEY = value  ❌

# Check for BOM or encoding issues
file .env
```

**Issue:** Docker doesn't see .env
```bash
# .env must be in same directory as docker-compose.yml
ls -la docker-compose.yml .env

# Rebuild to apply changes
docker compose down
docker compose build
docker compose up -d
```

**Issue:** Direct Node.js doesn't see .env
```bash
# Make sure dotenv is installed
npm install dotenv

# Check import order in index.js
import dotenv from 'dotenv';
dotenv.config();  // Must be BEFORE other imports that use env vars
```

## Available Variables

### Required
| Variable | Description | Example |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | `8...:AAE...` |
| `TELEGRAM_USER_IDS` | Authorized user IDs | `102....` |

### Optional
| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `TELEGRAM_PROXY` | Proxy URL for Telegram | (none) | `http://proxy:8080` |
| `TELEGRAM_PROXY_URL` | Alternative proxy var | (none) | `socks5://proxy:1080` |
| `TOKEN_EXPIRY_WARNING_MS` | Token expiry warning time | `3600000` | `7200000` |
| `DEFAULT_MODEL` | Default LLM model | `qwen-max-latest` | `qwen-turbo` |
| `QWEN_BASE_URL` | Qwen API base URL | `https://chat.qwen.ai` | (custom URL) |
| `PORT` | Server port | `3264` | `3000` |
| `LOG_LEVEL` | Logging level | `info` | `debug` |

## Testing

### Test .env Loading

**Create test script:**
```javascript
// test-env.js
import dotenv from 'dotenv';
dotenv.config();

console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Not set');
console.log('TELEGRAM_USER_IDS:', process.env.TELEGRAM_USER_IDS);
console.log('TELEGRAM_PROXY:', process.env.TELEGRAM_PROXY ? '✅ Set' : '❌ Not set');
```

**Run:**
```bash
node test-env.js
```

### Test in Docker

```bash
# Build and run
docker compose up -d

# Test from outside
curl http://localhost:3264/api/status

# Check container env
docker exec qwen-proxy env | grep TELEGRAM
```

## Troubleshooting

### Error: ".env file not found"

**Solution:**
```bash
# Create .env
cp .env.example .env
nano .env

# Or set environment variables directly
export TELEGRAM_BOT_TOKEN=your_token
node index.js
```

### Error: "Variables undefined"

**Check:**
```bash
# 1. .env file exists
ls -la .env

# 2. Format is correct (no spaces)
cat .env

# 3. Docker: env_file directive present
grep -A 1 "env_file" docker-compose.yml

# 4. Node.js: dotenv imported first
head -10 index.js
```

### Variables Change But Not Applied

**Docker:**
```bash
# Must rebuild/restart
docker compose down
docker compose up -d
```

**Node.js:**
```bash
# Must restart process
# Ctrl+C
node index.js
```

## Summary

✅ **Docker Compose** - Uses `env_file` directive  
✅ **Direct Node.js** - Uses `dotenv` package  
✅ **Security** - .env in .gitignore, never committed  
✅ **Flexibility** - Works both in Docker and locally  
✅ **Validation** - Startup message confirms .env loaded  

## Quick Reference

```bash
# Development
npm install
node index.js

# Production
docker compose build
docker compose up -d

# Check status
docker compose logs -f
curl http://localhost:3264/api/status
```
