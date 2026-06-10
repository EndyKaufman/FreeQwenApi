# Qwen API Proxy

A powerful proxy server that provides OpenAI-compatible API access to Qwen (通义千问) models through browser emulation. Features include chat completions, image generation, file uploads, and a Telegram bot for session management.

## CLI Commands

All commands can be run with `npx` (no installation) or after global install:

```bash
# Using npx (recommended for occasional use)
npx qwen-api-proxy <command>

# After global install (recommended for frequent use)
qwen-api-proxy <command>
```

### Available Commands

#### Start Server

```bash
npx qwen-api-proxy
```

#### Initialize Directory (Without Starting Server)

```bash
npx qwen-api-proxy init
```

Creates all necessary directories and `.env` file without starting the server.

#### Create Session Archive

```bash
npx qwen-api-proxy archive
```

Creates a ZIP archive of the session directory for backup or transfer.

#### Extend Session

```bash
# Extend all sessions
npx qwen-api-proxy extend

# Extend specific account
npx qwen-api-proxy extend --account-id acc_1234567890

# Verbose output
npx qwen-api-proxy extend --verbose
```

Extends session expiration dates for configured accounts.

#### System Health Check

```bash
npx qwen-api-proxy doctor
```

Comprehensive system health check including:
- Node.js version
- Required directories
- File permissions
- Disk space
- Account configuration
- Dependencies

#### Custom Working Directory

```bash
npx qwen-api-proxy --dir=/path/to/project
npx qwen-api-proxy archive --dir=/path/to/project
npx qwen-api-proxy doctor --dir=/path/to/project
```

## Features

- 🔄 **OpenAI-Compatible API** - Drop-in replacement for OpenAI SDK
- 🌐 **Browser Emulation** - Access Qwen API through automated browser
- 💬 **Multiple Models** - Support for 25+ Qwen models (qwen-max, qwen-plus, qwen3, etc.)
- 🖼️ **Image Generation** - Generate images via DashScope or browser
- 📎 **File Upload** - Upload and analyze images/documents
- 🤖 **Telegram Bot** - Manage sessions, generate images, chat with AI
- 💾 **Session Management** - Persistent sessions with automatic backup
- 📊 **Streaming Support** - Real-time streaming responses
- 🔐 **Multi-Account** - Support for multiple Qwen accounts

## System Requirements

- **Node.js**: 18.0.0 or higher (LTS recommended)
- **npm**: 9.0.0 or higher
- **OS**: Linux, macOS, Windows
- **RAM**: 2GB minimum (4GB recommended for browser automation)
- **Disk**: 500MB for dependencies + Chromium

## Installation

### Global Installation (Recommended)

```bash
npm install -g qwen-api-proxy
```

### Local Installation

```bash
npm install qwen-api-proxy
```

### Node.js Version Management

This project requires **Node.js 18 or higher**. If you have multiple Node.js versions:

```bash
# Using nvm (Node Version Manager)
nvm install 18
nvm use 18

# Or use .nvmrc file (in project directory)
nvm use
```

## Quick Start

### 1. First Run

When you run the command for the first time, it will automatically create all necessary directories:

```bash
# Using npx (no installation required)
npx qwen-api-proxy

# Or after global install
qwen-api-proxy
```

This creates:
```
your-current-directory/
├── session/          # Session data and tokens
│   ├── accounts/     # Account credentials
│   └── history/      # Chat history
├── logs/             # Server logs
├── uploads/          # Uploaded files
├── temp/             # Temporary files
└── .env              # Configuration file
```

### 2. Configure Environment

Edit the `.env` file in your working directory:

```bash
nano .env
```

Add your configuration:

```env
# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_USER_IDS=123456789,987654321

# Default model
DEFAULT_MODEL=qwen-max-latest

# Image generation (optional)
IMAGE_GENERATION_MODE=browser
DASHSCOPE_API_KEY=your-dashscope-api-key
```

### 3. Add Qwen Account

The first time you run the server, it will prompt you to add a Qwen account:

```bash
qwen-api-proxy
```

Follow the interactive menu:
1. Select "1" to add a new account
2. Browser will open - login to Qwen (via GitHub/Google/email)
3. Press ENTER in console after login
4. Select "3" to start the proxy server

### 4. Use the API

The server starts on `http://localhost:3264` by default.

#### Using with OpenAI SDK

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:3264/api',
  apiKey: 'not-needed' // API key not required
});

const response = await openai.chat.completions.create({
  model: 'qwen-max',
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response.choices[0].message.content);
```

#### Using cURL

```bash
curl -X POST http://localhost:3264/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?"}'
```

## CLI Commands

### Start Server

```bash
# Interactive mode (with menu)
qwen-api-proxy

# Non-interactive mode (auto-start)
NON_INTERACTIVE=1 qwen-api-proxy
```

### Create Session Archive

Create a ZIP backup of your session:

```bash
qwen-api-proxy archive
# or
qwen-api-proxy --archive
```

### Force Setup

Re-create working directory structure:

```bash
qwen-api-proxy --setup
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3264` |
| `HOST` | Server host | `0.0.0.0` |
| `DEFAULT_MODEL` | Default AI model | `qwen-max` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | - |
| `TELEGRAM_USER_IDS` | Authorized user IDs | - |
| `IMAGE_GENERATION_MODE` | Image generation mode | `dashscope` |
| `DASHSCOPE_API_KEY` | DashScope API key | - |
| `LOG_LEVEL` | Logging level | `info` |
| `FORCE_NEW_CHAT_PER_REQUEST` | New chat per request | `false` |

See `.env.example` for all available options.

## Telegram Bot Features

If you configure a Telegram bot token, you get:

- 📦 **Session Upload** - Send ZIP archives to update sessions
- 💬 **LLM Chat** - Chat with AI directly in Telegram
- 🎨 **Image Generation** - Generate images with `/image` command
- 📊 **Status** - Check server status with `/status`
- ⚙️ **Settings** - Change models and settings with `/settings`
- 🔄 **Health Checks** - Periodic system health monitoring

## Available Models

- **Standard**: qwen-max, qwen-plus, qwen-turbo (and latest versions)
- **Coder**: qwen3-coder-plus, qwen2.5-coder-*b-instruct (0.5b - 32b)
- **Visual**: qwen-vl-max, qwen-vl-plus (and latest versions)
- **Qwen 3**: qwen3, qwen3-max, qwen3-plus, qwen3-omni-flash
- **Qwen 3.5**: qwen3.5-plus, qwen3.5-flash, qwen3.5-397b-a17b, and more

## API Endpoints

- `POST /api/chat` - Send message (custom format)
- `POST /api/chat/completions` - OpenAI-compatible endpoint
- `GET /api/models` - List available models
- `POST /api/chats` - Create new chat
- `POST /api/files/upload` - Upload files
- `GET /api/status` - Check authorization status

See full API documentation in the [examples](examples/) directory.

## Development

### Run from Source

```bash
git clone https://github.com/EndyKaufman/FreeQwenApi.git
cd FreeQwenApi
npm install
npm start
```

### Run with npm script

```bash
npm run archive  # Create session archive
npm start        # Start server
```

## Docker

See [README_DOCKER.md](README_DOCKER.md) for Docker deployment guide.

## Requirements

- **Node.js** 18+ (LTS recommended)
- **zip** command (for archive creation)
- **Chromium/Chrome** (automatically downloaded by Puppeteer)

### Check Node.js Version

```bash
node --version  # Should be v18.0.0 or higher
```

### Install Node.js 18+

**Using nvm (recommended):**
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node.js 18
nvm install 18
nvm use 18
nvm alias default 18
```

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

**macOS:**
```bash
brew install node@18
```

### Install Dependencies

**Ubuntu/Debian:**
```bash
sudo apt install zip
```

**macOS:**
```bash
brew install zip
```

**Windows:**
zip is included with Git Bash or WSL

## Troubleshooting

### Port already in use

```bash
# Change port in .env
PORT=3000
```

### Browser fails to start

```bash
# Install system dependencies (Ubuntu)
sudo apt-get install -y \
  chromium-browser \
  fonts-liberation \
  libnss3 \
  libatk-bridge2.0-0 \
  libgtk-3-0
```

### Permission errors

```bash
# Fix permissions
npm run fix-permissions
# or manually
chmod -R 755 session logs uploads temp
```

## Security Notes

- Never commit `.env` file or `session/` directory
- Keep your tokens and cookies private
- Use environment variables for sensitive data
- The session directory is auto-generated with `.gitignore`

## License

MIT License - see LICENSE file for details

## Repository

- **GitHub**: https://github.com/EndyKaufman/FreeQwenApi
- **Issues**: https://github.com/EndyKaufman/FreeQwenApi/issues
- **npm**: https://www.npmjs.com/package/qwen-api-proxy

## Author

Endy Kaufman

---

**Note**: This project is not affiliated with Alibaba Group or Qwen. It's an independent open-source project.
