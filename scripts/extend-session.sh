#!/bin/bash

# Automatic Session Extender - Shell Wrapper
# This script provides a convenient way to extend Qwen sessions
# Usage: ./scripts/extend-session.sh

echo "🚀 Запуск автоматического продления сессии..."
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден. Установите Node.js v23.11.1 или выше"
    exit 1
fi

# Run the Node.js script
node "$(dirname "$0")/extendSession.js" "$@"
