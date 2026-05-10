# Telegram Post - FreeQwenApi Fork Announcement

---

## 📝 Основной пост (Русский)

🚀 **FreeQwenApi - бесплатный прокси для Qwen AI с интеграцией Telegram!**

📌 **О проекте:**
FreeQwenApi - это OpenAI-совместимый API прокси, который дает бесплатный доступ к моделям Qwen AI через эмуляцию браузера. Проект позволяет использовать мощные AI модели без API ключей и ограничений.

🔗 **GitHub:** https://github.com/EndyKaufman/FreeQwenApi  
🐳 **Docker Hub:** https://hub.docker.com/r/endykaufman/qwen-api-proxy  
📖 **Оригинал:** https://github.com/y13sint/FreeQwenApi

---

### ⭐ Что добавлено в форк:

**🤖 Telegram Bot:**
• Управление API через бот
• Авто-уведомления о статусе каждые 4 часа
• Мониторинг токенов с таймером
• Загрузка сессий через архив
• LLM-чат прямо в Telegram

**🔧 Production-ready:**
• Multi-platform Docker (amd64 + arm64)
• Health checks и авто-восстановление
• Полное логирование
• CI/CD через GitHub Actions
• Graceful restarts

**🎯 API возможности:**
• 25+ моделей Qwen (включая Qwen 3.5)
• OpenAI-совместимый API
• Генерация изображений
• Streaming ответов (SSE)
• Мультиаккаунт ротация

---

### 🚀 Быстрый старт:

```bash
docker run -d \
  --name qwen-api-proxy \
  -p 3264:3264 \
  -v $(pwd)/session:/app/session \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  endykaufman/qwen-api-proxy:latest
```

---

💡 **Бесплатный Qwen AI** с production инфраструктурой и управлением через Telegram!

#FreeQwenApi #Qwen #AI #Telegram #Docker #OpenAI #LLM #OpenSource #API #FreeAPI

---

## 📱 Короткая версия (для репостов)

🚀 **FreeQwenApi - бесплатный Qwen AI API + Telegram Bot**

Прокси-сервер для бесплатного доступа к Qwen AI моделям с полной интеграцией Telegram, мониторингом и автообновлениями.

✅ 25+ моделей Qwen  
✅ OpenAI-совместимый API  
✅ Telegram бот с уведомлениями  
✅ Docker с health checks  

🔗 https://github.com/EndyKaufman/FreeQwenApi  
🐳 https://hub.docker.com/r/endykaufman/qwen-api-proxy

#FreeQwenApi #Qwen #AI #Telegram #Docker #OpenSource

---

## 🇬🇧 English Version

🚀 **FreeQwenApi - Free Qwen AI Proxy with Telegram Integration!**

📌 **About:**
OpenAI-compatible API proxy providing free access to Qwen AI models through browser emulation. Use powerful AI without API keys or restrictions.

🔗 **GitHub:** https://github.com/EndyKaufman/FreeQwenApi  
🐳 **Docker Hub:** https://hub.docker.com/r/endykaufman/qwen-api-proxy

**Added in fork:**
🤖 Telegram bot with management & monitoring  
🔧 Production-ready with health checks  
📊 Auto-notifications every 4 hours  
🎯 25+ Qwen models support  

💡 **Free Qwen AI** with production infrastructure!

#FreeQwenApi #Qwen #AI #Telegram #Docker #OpenAI #LLM #OpenSource
