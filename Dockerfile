# syntax=docker/dockerfile:1.6
FROM node:23-alpine AS base

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