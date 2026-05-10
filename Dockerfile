# syntax=docker/dockerfile:1.6
FROM node:23-alpine AS base

# Metadata labels
LABEL org.opencontainers.image.title="FreeQwenApi"
LABEL org.opencontainers.image.description="Free Qwen AI API Proxy with OpenAI compatibility, Telegram bot integration, multi-account rotation, and production-ready features"
LABEL org.opencontainers.image.url="https://github.com/EndyKaufman/FreeQwenApi"
LABEL org.opencontainers.image.source="https://github.com/EndyKaufman/FreeQwenApi"
LABEL org.opencontainers.image.documentation="https://github.com/EndyKaufman/FreeQwenApi/blob/main/README.md"
LABEL org.opencontainers.image.vendor="EndyKaufman"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.authors="Endy Kaufman"
LABEL org.opencontainers.image.version="1.0.1"
LABEL org.opencontainers.image.keywords="qwen,ai,api,proxy,openai,telegram-bot,llm,free-api"

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init \
    p7zip \
    dos2unix

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    CHROME_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# fix CRLF + permissions
RUN dos2unix /app/start-with-restart.sh \
 && chmod +x /app/start-with-restart.sh \
 && mkdir -p /app/session /app/logs /app/uploads \
 && addgroup -S appgroup \
 && adduser -S appuser -G appgroup \
 && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3264

CMD ["dumb-init", "/app/start-with-restart.sh"]