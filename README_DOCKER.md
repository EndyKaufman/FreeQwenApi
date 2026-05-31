# FreeQwenApi

> **🐳 Docker Hub:** https://hub.docker.com/r/endykaufman/qwen-api-proxy  
> **🔧 Fork:** https://github.com/EndyKaufman/FreeQwenApi  
> **🌐 Original:** https://github.com/y13sint/FreeQwenApi

Free Qwen AI API Proxy with OpenAI compatibility and Telegram bot integration. Access Qwen models without API keys.

## ✨ Features

- **25+ Qwen Models**: qwen3-max, qwen3.5-plus, qwen3-coder-plus, qwen-vl-plus, and more
- **OpenAI Compatible**: Works with OpenAI SDK, just change `baseURL`
- **Telegram Bot**: Session upload, LLM chat, health monitoring
- **Streaming Support**: Server-Sent Events (SSE) for real-time responses
- **File Upload**: Upload images and documents for analysis
- **Image Generation**: DALL-E compatible interface via Qwen Image API
- **Multi-Account**: Automatic rotation with rate limit handling
- **Context Management**: Server-side chat history with chatId/parentId

## 🚀 Quick Start

### Docker (Recommended)

```bash
# 1. Add account locally first
npm run auth

# 2. Build and run
docker compose build --no-cache
docker compose up -d
```

### Docker Compose

```yaml
services:
  qwen-proxy:
    build: .
    container_name: qwen-proxy
    environment:
      - SKIP_ACCOUNT_MENU=true
      - PORT=3264
    ports:
      - "3264:3264"
    volumes:
      - ./session:/app/session
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    restart: unless-stopped
```

### Node.js

```bash
git clone https://github.com/EndyKaufman/FreeQwenApi
cd FreeQwenApi
npm install
npm start
```

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Native chat endpoint |
| `/api/chat/completions` | POST | OpenAI-compatible endpoint |
| `/api/models` | GET | List available models |
| `/api/status` | GET | Check authentication status |
| `/api/chats` | POST | Create new chat |
| `/api/files/upload` | POST | Upload files/images |
| `/api/images/generations` | POST | Generate images (DALL-E compatible) |

## 💡 Usage Examples

### Basic Chat Request

```bash
curl http://localhost:3264/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-max-latest","messages":[{"role":"user","content":"Hello!"}]}'
```

### OpenAI SDK

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'http://localhost:3264/api',
    apiKey: 'any-string',
});

const response = await client.chat.completions.create({
    model: 'qwen-max-latest',
    messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Streaming

```bash
curl -X POST http://localhost:3264/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-max-latest","messages":[{"role":"user","content":"Write a poem"}],"stream":true}'
```

### Context-Aware Conversation

```javascript
// First message
const res1 = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ message: "What is 2+2?" })
});
const data1 = await res1.json();
// Response: { chatId: "abc-123", parentId: "xyz-789", ... }

// Continue conversation
const res2 = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ 
    message: "Now add 3?",
    chatId: data1.chatId,
    parentId: data1.parentId
  })
});
```

## 🤖 Available Models

### Qwen 3.5
- `qwen3.5-plus`, `qwen3.5-flash`, `qwen3.5-397b-a17b`, `qwen3.5-122b-a10b`, `qwen3.5-27b`

### Qwen 3
- `qwen3-max`, `qwen3-plus`, `qwen3-omni-flash`, `qwen3-coder-plus`

### Vision Models
- `qwen-vl-max`, `qwen-vl-plus`, `qwen2.5-vl-32b-instruct`, `qwen2.5-vl-7b-instruct`

### Standard Models
- `qwen-max`, `qwen-plus`, `qwen-turbo`, `qwen2.5-72b-instruct`, `qwq-32b`

> **Auto-mapping**: Aliases like `qwen3`, `qwq`, `qwen-turbo` automatically map to canonical models.

## 🔑 API Key Authorization

By default, API is open. To enable authorization, add keys to `src/Authorization.txt`:

```
your-api-key-here
```

Then include header: `Authorization: Bearer your-api-key-here`

## 🌐 Telegram Bot Integration

Enhanced fork includes Telegram bot for:
- Session upload (.zip/.7z archives)
- LLM chat assistant
- Real-time health monitoring
- Automatic session backups
- Graceful service restarts

Configure via environment variables:
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather
- `TELEGRAM_ALLOWED_USERS` - Comma-separated user IDs (optional whitelist)

## 📊 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3264` | HTTP server port |
| `SKIP_ACCOUNT_MENU` | `false` | Skip interactive account menu |
| `DEFAULT_MODEL` | `qwen-max-latest` | Default model if not specified |
| `LOG_LEVEL` | `info` | Logging level (error/warn/info/debug) |
| `MAX_FILE_SIZE` | `10485760` | Max upload size (10MB) |
| `DASHSCOPE_API_KEY` | - | Required for image generation |
| `TELEGRAM_BOT_TOKEN` | - | Telegram bot token |

## 🗂️ Docker Volumes

| Volume | Purpose |
|--------|---------|
| `./session` | Qwen tokens and accounts |
| `./logs` | Winston log files |
| `./uploads` | Temporary uploaded files |
| `./temp` | Archive extraction temp dir |
| `./session_backup` | Session backups before updates |

## 🔧 Account Management

### Interactive Menu

Run `npm start` without `SKIP_ACCOUNT_MENU`:

1. **Add Account** - Opens browser for Qwen login
2. **Re-login** - Refresh expired token
3. **Start Proxy** - Launch server (default)
4. **Delete Account** - Remove saved account

### Account Statuses

- **OK** - Active and valid
- **WAIT** - Rate limited (auto-resets after 24h)
- **INVALID** - Token expired, needs re-login

### Auto-Rotation

With multiple accounts:
- Round-robin selection
- Auto-switch on HTTP 429 (rate limit)
- Auto-switch on HTTP 401 (unauthorized)

## 📝 API Reference

### POST /api/chat/completions (OpenAI Compatible)

```json
{
  "model": "qwen-max-latest",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant"},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false
}
```

**Response:**
```json
{
  "id": "chatcmpl-123",
  "choices": [{"message": {"role": "assistant", "content": "Hi!"}}],
  "chatId": "abc-123",
  "parentId": "def-456"
}
```

### POST /api/chat (Native)

```json
{
  "message": "Hello!",
  "model": "qwen-max-latest",
  "chatId": "abc-123",
  "parentId": "def-456"
}
```

### POST /api/files/upload

```bash
curl -X POST http://localhost:3264/api/files/upload -F "file=@image.jpg"
```

**Response:**
```json
{
  "success": true,
  "file": {
    "url": "https://cdn.qwenlm.ai/uploaded-image.jpg"
  }
}
```

### POST /api/images/generations

```json
{
  "prompt": "Space ship on nebula background",
  "model": "qwen-image-plus",
  "n": 1,
  "size": "1024x1024"
}
```

## 🔌 OpenWebUI Integration

1. **Base URL**: `http://localhost:3264/api`
2. **API Key**: Any (or leave empty if Authorization.txt is empty)
3. **Streaming**: Fully supported
4. **Chat Isolation**: Without `conversation_id`, proxy doesn't restore global context

## 📚 Documentation

Full documentation available in repository:
- `docs/ENV_SETUP.md` - Environment configuration
- `docs/TELEGRAM_BOT_FLOW.md` - Telegram bot workflows
- `docs/IMAGE_GENERATION.md` - Image generation guide
- `docs/OPENWEBUI_SETUP.md` - OpenWebUI integration
- `docs/TOKEN_EXPIRY_CHECKING.md` - Token expiry detection

## 🛡️ Security

- Credentials never logged
- Proxy support for Telegram API (HTTP/HTTPS/SOCKS)
- User whitelist for Telegram bot
- Secure file permission management

## 📦 Project Structure

```
├── index.js              # Entry point: Express server
├── main.py               # Python FastAPI alternative
├── src/
│   ├── api/              # API routes and handlers
│   ├── browser/          # Puppeteer browser automation
│   ├── logger/           # Winston logging
│   └── utils/            # Utilities (account setup, Telegram bot)
├── session/              # Tokens and accounts
├── logs/                 # Log files
└── examples/             # Usage examples (JS/Python)
```

## 🤝 Contributing

This is an enhanced fork of https://github.com/y13sint/FreeQwenApi

Key improvements:
- Telegram bot integration
- Session management via Telegram
- LLM chat assistant
- Enhanced logging (Winston)
- Archive auto-extraction
- Health monitoring
- Fault-tolerant operations

## 📄 License

MIT License - see LICENSE file for details
