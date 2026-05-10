# Telegram Proxy Configuration

## Overview

Added support for Telegram API access through a proxy server. This is useful when Telegram API is blocked or restricted in your region.

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Option 1: Simple proxy URL
TELEGRAM_PROXY=http://proxy.example.com:8080

# Option 2: Alternative variable name
TELEGRAM_PROXY_URL=http://proxy.example.com:8080

# With authentication
TELEGRAM_PROXY=http://username:password@proxy.example.com:8080
```

**Note:** `TELEGRAM_PROXY_URL` takes precedence over `TELEGRAM_PROXY` if both are set.

## Supported Proxy Protocols

- **HTTP/HTTPS**: `http://proxy.example.com:8080`
- **SOCKS4**: `socks4://proxy.example.com:1080`
- **SOCKS5**: `socks5://proxy.example.com:1080`

## Examples

### Example 1: HTTP Proxy

```bash
TELEGRAM_PROXY=http://192.168.1.100:3128
```

### Example 2: SOCKS5 Proxy

```bash
TELEGRAM_PROXY=socks5://10.0.0.1:1080
```

### Example 3: Proxy with Authentication

```bash
TELEGRAM_PROXY=http://user:pass@proxy.example.com:8080
```

### Example 4: HTTPS Proxy

```bash
TELEGRAM_PROXY=https://secure-proxy.example.com:443
```

## Docker Compose Usage

Add to your `.env` file:

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_USER_IDS=your_user_id_here

# Proxy Configuration
TELEGRAM_PROXY=http://proxy.example.com:8080
```

Then restart:

```bash
docker-compose down
docker-compose build
docker-compose up -d
```

## How It Works

1. **Proxy Detection**: On startup, the bot checks for `TELEGRAM_PROXY` or `TELEGRAM_PROXY_URL`
2. **Agent Creation**: Creates a `ProxyAgent` using the `proxy-agent` library
3. **Request Routing**: All Telegram API requests go through the proxy
4. **Local API**: The Qwen API (localhost) is NOT proxied

### Architecture

```
Telegram Bot
    ↓
Proxy Agent (if configured)
    ↓
Proxy Server
    ↓
Telegram API (api.telegram.org)
```

## Logging

When proxy is configured, you'll see:

```
🔧 Telegram прокси настроен: http://proxy.example.com:8080
✅ Прокси агент создан успешно
🤖 Запуск Telegram бота...
✅ Telegram бот запущен: @YourBotName
```

## Troubleshooting

### Proxy Connection Failed

**Check:**
```bash
# Test proxy connectivity
curl -x http://proxy.example.com:8080 https://api.telegram.org

# Check logs
docker-compose logs | grep -i proxy
```

**Common Issues:**
1. Wrong proxy address
2. Proxy requires authentication
3. Firewall blocking proxy
4. Proxy server down

### Invalid Proxy URL

Make sure the URL format is correct:
- ✅ `http://proxy.example.com:8080`
- ✅ `socks5://10.0.0.1:1080`
- ❌ `proxy.example.com:8080` (missing protocol)
- ❌ `http://proxy.example.com` (missing port, though sometimes works)

### Proxy Works but Bot Still Fails

**Check:**
```bash
# Verify environment variables loaded
docker-compose exec qwen-proxy env | grep TELEGRAM_PROXY

# Check proxy agent creation
docker-compose logs | grep "Прокси агент"
```

## Testing

### Test Proxy Connection

```bash
# Inside container
docker-compose exec qwen-proxy node -e "
const { ProxyAgent } = require('proxy-agent');
const agent = new ProxyAgent('http://proxy.example.com:8080');
fetch('https://api.telegram.org', { agent })
  .then(r => console.log('✅ Proxy works:', r.status))
  .catch(e => console.error('❌ Proxy failed:', e.message));
"
```

### Test Without Proxy

If you want to temporarily disable proxy:

```bash
# Comment out in .env
# TELEGRAM_PROXY=http://proxy.example.com:8080

# Or set empty
TELEGRAM_PROXY=
```

Then restart:
```bash
docker-compose restart
```

## Security Notes

1. **Credentials**: If using proxy with auth, credentials are in `.env` (not committed to git)
2. **Encryption**: HTTPS proxies encrypt traffic between you and proxy
3. **Trust**: Make sure you trust the proxy server owner
4. **Local API**: Qwen API calls to localhost are NOT proxied (direct connection)

## Advanced Configuration

### System-Wide Proxy (Alternative)

If you want all traffic (not just Telegram) to go through proxy:

```bash
# In docker-compose.yml
environment:
  - HTTP_PROXY=http://proxy.example.com:8080
  - HTTPS_PROXY=http://proxy.example.com:8080
  - NO_PROXY=localhost,127.0.0.1
```

### Proxy Rotation

For advanced users wanting to rotate proxies, you would need to:
1. Modify `telegramBot.js` to support multiple proxies
2. Implement rotation logic
3. Handle proxy failures gracefully

## Performance Impact

- **Added Latency**: ~50-500ms depending on proxy location
- **Reliability**: Depends on proxy server stability
- **Bandwidth**: Proxy may have speed limits

## Dependencies

Added package:
- `proxy-agent` ^6.5.0 - Universal proxy agent for Node.js fetch

## Summary

✅ **Added**: Telegram proxy support via environment variables  
✅ **Protocols**: HTTP, HTTPS, SOCKS4, SOCKS5  
✅ **Auth**: Username/password support  
✅ **Logging**: Clear proxy status messages  
✅ **Safety**: Only Telegram API is proxied, local API remains direct  

## Quick Start

1. Add to `.env`:
   ```bash
   TELEGRAM_PROXY=http://your-proxy:port
   ```

2. Rebuild and restart:
   ```bash
   docker-compose build
   docker-compose up -d
   ```

3. Verify in logs:
   ```bash
   docker-compose logs | grep -i "прокси"
   ```

That's it! Your Telegram bot will now use the proxy for all API communications. 🚀
