# Quick Reference - FreeQwenApi v1.0.3

## 🚀 Quick Start

### Option 1: Docker (Recommended)
```bash
# 1. Clone
git clone https://github.com/EndyKaufman/FreeQwenApi
cd FreeQwenApi

# 2. Configure
cp .env.example .env
nano .env  # Add your Telegram bot token

# 3. Run
docker-compose up -d
docker-compose logs -f
```

### Option 2: Local Development
```bash
npm install
cp .env.example .env
nano .env
npm start
```

---

## 🤖 Telegram Bot Commands

### Telegram Bot Commands
| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/status` | Service status |
| `/restart` | Restart service |
| `/model [name]` | Set/show active model |
| `/chat` | Toggle AI chat mode |
| `/clear` | Clear chat context |

### File Upload
- Send `.zip` or `.7z` archive with `session/` folder
- Max size: 50MB
- Auto-extracts and restarts service

---

## 🔧 Environment Variables

### Required
```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdef...
TELEGRAM_USER_IDS=102375526
```

### Optional
```bash
# Proxy for Telegram (if blocked)
TELEGRAM_PROXY=http://user:pass@proxy:8080

# Token expiry warning (default: 1 hour)
TOKEN_EXPIRY_WARNING_MS=3600000

# Default model (if not set in bot_settings.json)
DEFAULT_MODEL=qwen3.5-plus
```

---

## 📡 API Endpoints

### Chat
```bash
# Send message (model optional - uses active model from settings)
POST /api/chat
POST /api/chat/completions  # OpenAI compatible

# Example with explicit model (highest priority)
curl http://localhost:3264/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3.5-flash",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# Example without model (uses active model from bot settings)
curl http://localhost:3264/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Models
```bash
GET /api/models
```

### Status
```bash
GET /api/status
```

### File Upload
```bash
POST /api/files/upload
```

---

## 🎯 Model Selection Priority

**Request parameter > Bot settings > .env > AvailableModels.txt**

```
1. Request "model" parameter (HIGHEST)
   ↓ (if not specified)
2. bot_settings.json (activeModel)
   ↓ (if not set)
3. .env (DEFAULT_MODEL)
   ↓ (if not set)
4. AvailableModels.txt (first model)
```

**Examples:**
```bash
# Uses qwen3.5-flash (explicit in request)
curl ... -d '{"model":"qwen3.5-flash","messages":[...]}'

# Uses active model from bot settings
curl ... -d '{"messages":[...]}'
```

**Change via Telegram:**
```bash
/model qwen3.5-plus  # Sets active model for all requests without explicit model
```

---

## 🎯 Common Tasks

### Add First Account via Telegram
1. Start bot (works without tokens)
2. Send `.zip` archive with session
3. Bot extracts and restarts
4. Account ready!

### Check Service Status
```bash
# Via API
curl http://localhost:3264/api/status

# Via Telegram
/status command

# Via Docker
docker-compose logs -f
```

### Change Model
```bash
# In .env
DEFAULT_MODEL=qwen-turbo

# Restart
docker-compose restart
```

### Use Proxy
```bash
# In .env
TELEGRAM_PROXY=http://proxy:8080

# Rebuild
docker-compose build
docker-compose up -d
```

---

## 🐛 Troubleshooting

### Bot doesn't respond
```bash
# Check logs
docker-compose logs | grep telegram

# Verify .env
docker-compose exec qwen-proxy env | grep TELEGRAM

# Test connection
curl -x http://proxy:8080 https://api.telegram.org
```

### "fetch failed" error
- Check proxy is accessible
- Verify credentials
- Test from host machine first

**See:** [docs/TELEGRAM_TROUBLESHOOTING.md](docs/TELEGRAM_TROUBLESHOOTING.md)

### Archive not extracting
```bash
# Check format
# Must contain: session/ folder
# Supported: .zip, .7z
# Max size: 50MB

# Check logs
docker-compose logs | grep -i "archive\|extract"
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [README.md](README.md) | Main documentation |
| [docs/TELEGRAM_LLM_CHAT.md](docs/TELEGRAM_LLM_CHAT.md) | LLM chat guide |
| [docs/TELEGRAM_PROXY.md](docs/TELEGRAM_PROXY.md) | Proxy setup |
| [docs/TELEGRAM_TROUBLESHOOTING.md](docs/TELEGRAM_TROUBLESHOOTING.md) | Troubleshooting |
| [docs/SECURITY_AUDIT_LOGS.md](docs/SECURITY_AUDIT_LOGS.md) | Security audit |
| [docs/ENV_SETUP.md](docs/ENV_SETUP.md) | Environment setup |
| [TELEGRAM_LLM_CHAT_RU.md](TELEGRAM_LLM_CHAT_RU.md) | Russian guide |

---

## 🔗 Links

- **GitHub:** https://github.com/EndyKaufman/FreeQwenApi
- **Issues:** https://github.com/EndyKaufman/FreeQwenApi/issues
- **Original:** https://github.com/y13sint/FreeQwenApi
- **Qwen:** https://chat.qwen.ai

---

## 💡 Tips

1. **Always backup sessions:**
   ```bash
   cp -r session/ session_backup_$(date +%Y%m%d)/
   ```

2. **Use .env file:**
   - Easier than environment variables
   - Loaded automatically
   - Never commit to git

3. **Check health regularly:**
   - Use `/status` in Telegram
   - Reports every 4 hours
   - Monitor token expiry

4. **Secure your bot:**
   - Set `TELEGRAM_USER_IDS`
   - Use proxy if needed
   - Keep tokens secret

---

**Need help?** Check [docs/](docs/) folder or open an issue on GitHub! 🚀
