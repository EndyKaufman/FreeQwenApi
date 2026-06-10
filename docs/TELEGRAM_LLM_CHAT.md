# Telegram Bot - LLM Chat Feature

## 🤖 Overview

The Telegram bot now includes a built-in **LLM chat mode** that allows you to interact with Qwen AI models directly through Telegram.

## ✨ Features

### 1. AI Conversation
- Chat with Qwen models directly in Telegram
- Maintains conversation context (up to 20 messages)
- Supports all Qwen models available in the project

### 2. Smart Commands
- `/chat` - Show LLM chat status
- `/togglechat` - Toggle LLM chat mode on/off
- `/clear` - Clear conversation context
- `/model` - Show model information with all available models
- `/setmodel <name>` - Change active model

### 3. Context Management
- Automatic context window (last 20 messages)
- Clear context when needed
- Multi-turn conversations

## 🚀 Quick Start

### 1. Check LLM Chat Status

Send command in Telegram:
```
/chat
```

Bot responds:
```
📊 LLM Chat Status

🔧 Status: ❌ Disabled
🤖 Model: qwen3.5-plus
💬 Messages in context: 0

💡 Use /togglechat to enable LLM chat
```

### 2. Enable LLM Chat

Send command:
```
/togglechat
```

Bot responds:
```
✅ LLM чат включен!

🤖 Теперь я отвечаю как AI ассистент.
📝 Модель: qwen3.5-plus
💬 Просто отправляйте сообщения.
💾 Настройка сохранена

Команды:
/togglechat - Выключить LLM чат
/clear - Очистить контекст
/model - Информация о модели
/setmodel <название> - Сменить модель
/help - Все команды бота
```

### 3. Start Chatting

Just send any message (not starting with `/`):

**You:**
```
Привет! Как дела?
```

**Bot:**
```
Привет! У меня всё отлично, спасибо! 😊
Я готов помочь вам с вопросами или задачами.
Что вас интересует?
```

### 4. Use Commands While in Chat Mode

All commands still work:
- `/status` - Check service status
- `/clear` - Clear chat context
- `/model` - See model info with all available models
- `/chat` - Check LLM status
- `/togglechat` - Disable LLM mode

## 📋 Available Commands

### Management Commands
| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/status` | Show service status |
| `/restart` | Restart the service |

### LLM Chat Commands
| Command | Description |
|---------|-------------|
| `/chat` | Show LLM chat status |
| `/togglechat` | Toggle LLM chat mode on/off |
| `/clear` | Clear conversation context |
| `/model` | Show model info and all available models |
| `/setmodel <name>` | Change active model |

## 💡 Usage Examples

### Example 1: Simple Q&A

```
User: /chat
Bot: ✅ LLM чат включен!

User: What is Docker?
Bot: Docker is a platform that uses containerization technology 
     to package applications and their dependencies together...

User: How is it different from VMs?
Bot: Unlike virtual machines that virtualize the entire operating 
     system, Docker containers share the host OS kernel...
```

### Example 2: Code Help

```
User: /chat
Bot: ✅ LLM чат включен!

User: Write a simple Express.js server
Bot: Here's a basic Express.js server:

     const express = require('express');
     const app = express();
     const PORT = 3000;
     
     app.get('/', (req, res) => {
       res.send('Hello World!');
     });
     
     app.listen(PORT, () => {
       console.log(`Server running on port ${PORT}`);
     });

User: Add CORS middleware
Bot: Here's the updated code with CORS:

     const express = require('express');
     const cors = require('cors');
     ...
```

### Example 3: Translation

```
User: /chat
Bot: ✅ LLM чат включен!

User: Translate to English: Привет, как дела?
Bot: Translation: "Hello, how are you?"
```

### Example 4: Clear Context

```
User: /chat
Bot: ✅ LLM чат включен!

User: [has long conversation...]

User: /clear
Bot: 🗑️ Контекст чата очищен
     Новая история чата начата.

User: Let's start fresh!
Bot: Of course! I'm ready to help with a new topic. 
     What would you like to discuss?
```

## ⚙️ Configuration

### Default Model

The bot uses the model specified in `.env`:

```bash
DEFAULT_MODEL=qwen-max-latest
```

### Available Models

- `qwen-max-latest` (default) - Most capable
- `qwen-plus` - Balanced performance
- `qwen-turbo` - Fast responses
- `qwen3-max` - Latest Qwen 3
- `qwen-vl-max` - Vision-language model

### Change Model

Edit `.env` file:
```bash
DEFAULT_MODEL=qwen-plus
```

Restart service:
```bash
docker compose restart
```

## 🔧 How It Works

### Architecture

```
User sends message
    ↓
Bot checks if LLM mode enabled
    ↓
Yes → Call Qwen API
    ↓
    http://localhost:3264/api/chat/completions
    ↓
Send request with context:
{
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "message 1"},
    {"role": "assistant", "content": "response 1"},
    {"role": "user", "content": "current message"}
  ],
  "model": "qwen-max-latest"
}
    ↓
Receive response
    ↓
Add to context
    ↓
Send to Telegram user
```

### Context Management

- **Maximum messages:** 20 (10 user + 10 assistant)
- **Auto-cleanup:** Oldest messages removed when limit reached
- **Manual clear:** Use `/clear` command
- **Per-user:** Each user has separate context

### Message Handling

1. **Normal mode:** Messages treated as commands
2. **LLM mode:** Messages sent to Qwen API
3. **Commands:** Always work, even in LLM mode
4. **Long messages:** Auto-split if > 4000 chars

## 📊 System Prompt

The bot uses a system prompt for all conversations:

```
You are a helpful assistant in a Telegram bot. 
Keep responses concise and clear. 
Respond in the same language as the user.
```

## 🎯 Best Practices

### Do's ✅

1. **Use `/clear`** when switching topics
2. **Keep messages concise** for better responses
3. **Use commands** for bot management
4. **Check `/model`** to see current model
5. **Toggle off** with `/chat` when done

### Don'ts ❌

1. **Don't send very long messages** (keep under 2000 chars)
2. **Don't expect real-time streaming** (waits for full response)
3. **Don't forget to disable** when not needed
4. **Don't share sensitive info** in chat

## 🔍 Monitoring

### Log Messages

```
🤖 LLM Chat: Запрос от пользователя 123456789: Привет! Как дела?...
✅ LLM Chat: Ответ отправлен (156 символов)
🗑️ Контекст чата очищен для пользователя 123456789
✅ LLM Chat включен для пользователя 123456789
```

### View Logs

```bash
# LLM chat activity
docker compose logs -f | grep "LLM Chat"

# All bot activity
docker compose logs -f | grep telegram
```

## ⚠️ Important Notes

### Rate Limits

- Bot uses the same Qwen API as your service
- Subject to Qwen rate limits
- If all tokens expired, LLM chat won't work

### Response Time

- Depends on model and message complexity
- Typically 2-10 seconds
- Shows "typing" indicator while waiting

### Message Length

- **Input:** No hard limit (but keep reasonable)
- **Output:** Auto-split if > 4000 characters
- **Context:** Last 20 messages retained

### Privacy

- Conversations stored only in memory
- Cleared on service restart
- Use `/clear` to manually clear
- Not logged or persisted

## 🐛 Troubleshooting

### LLM Chat Not Working

**Check:**
```bash
# Service is running
docker compose ps

# API is accessible
curl http://localhost:3264/api/status

# Check logs
docker compose logs | grep "LLM Chat"
```

**Solutions:**
1. Ensure service is running
2. Check tokens are available
3. Verify API endpoint works

### "Qwen API error"

**Cause:** API tokens expired or rate limited

**Fix:**
```bash
# Check token status
curl http://localhost:3264/api/status

# Re-authenticate if needed
# Upload new session archive via bot
```

### Long Response Times

**Causes:**
- Complex query
- Model is busy
- Network issues

**Solutions:**
1. Try simpler questions
2. Use `qwen-turbo` for faster responses
3. Check network connectivity

### Context Too Long

**Symptom:** Responses become irrelevant

**Fix:**
```
/clear
```

This resets the conversation context.

## 🎓 Advanced Usage

### Multi-Language Support

The bot automatically responds in the same language as the user:

```
User: Hello!
Bot: Hello! How can I help you?

User: Привет!
Bot: Привет! Чем могу помочь?

User: 你好!
Bot: 你好!有什么我可以帮助你的吗?
```

### Code Generation

Great for coding help:

```
User: Write a Python function to calculate fibonacci
Bot: def fibonacci(n):
         if n <= 1:
             return n
         return fibonacci(n-1) + fibonacci(n-2)
     
     Here's an optimized version with memoization:
     ...
```

### Creative Writing

```
User: Write a short poem about coding
Bot: In lines of code, we craft our dreams,
     Where logic flows in digital streams.
     Through bugs and errors, we persist,
     Until our programs work, we insist.
     ...
```

## 📝 Feature Comparison

| Feature | Normal Mode | LLM Chat Mode |
|---------|-------------|---------------|
| Commands | ✅ Work | ✅ Work |
| File Upload | ✅ Work | ✅ Work |
| Regular Messages | ❌ Ignored | ✅ Sent to Qwen |
| Context | N/A | ✅ Maintained |
| AI Responses | N/A | ✅ Enabled |

## 🚀 Future Enhancements

Potential improvements:
- [ ] Model switching via `/model <name>`
- [ ] Temperature control
- [ ] System prompt customization
- [ ] Image generation support
- [ ] Voice messages
- [ ] Response streaming

## ✅ Summary

The LLM chat feature transforms your Telegram bot into:
- ✅ **AI Assistant** - Powered by Qwen models
- ✅ **Conversation Partner** - Maintains context
- ✅ **Code Helper** - Great for programming
- ✅ **Multi-lingual** - Responds in user's language
- ✅ **Easy to Use** - Just send `/chat` to enable

All integrated with existing bot features! 🎉
