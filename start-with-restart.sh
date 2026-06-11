#!/bin/sh

# Скрипт для запуска сервиса с обработкой перезапуска
# Exit code 42 = нужно перезапустить (обновление сессии ИЛИ Puppeteer protocol timeout)

set -e

echo "🚀 Запуск FreeQwenApi сервиса..."

while true; do
    # Запускаем приложение
    node index.js
    EXIT_CODE=$?
    
    echo ""
    echo "📊 Приложение завершилось с кодом: $EXIT_CODE"
    echo ""
    
    # Проверяем код выхода
    if [ $EXIT_CODE -eq 42 ]; then
        echo "🔄 Обнаружен код 42 - перезапуск после обновления сессии..."
        echo "⏱️  Перезапуск через 3 секунды..."
        sleep 3
        echo ""
        echo "========================================="
        echo ""
        continue
    elif [ $EXIT_CODE -eq 0 ]; then
        echo "✅ Нормальное завершение работы"
        exit 0
    elif [ $EXIT_CODE -eq 130 ]; then
        echo "🛑 Получен SIGINT (Ctrl+C)"
        exit 0
    elif [ $EXIT_CODE -eq 143 ]; then
        echo "🛑 Получен SIGTERM"
        exit 0
    else
        echo "❌ Критическая ошибка (код: $EXIT_CODE)"
        echo "🔄 Перезапуск через 5 секунд..."
        sleep 5
        echo ""
        echo "========================================="
        echo ""
        continue
    fi
done
