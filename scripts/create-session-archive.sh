#!/bin/bash

# Session Archive Creator - Shell Wrapper
# This script provides a convenient way to create session archives
# Usage: ./scripts/create-session-archive.sh

echo "🚀 Запуск создания архива сессии..."
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден. Установите Node.js v23.11.1 или выше"
    exit 1
fi

# Check if zip is installed
if ! command -v zip &> /dev/null; then
    echo "❌ zip не найден. Установите zip:"
    echo "   Ubuntu/Debian: sudo apt-get install zip"
    echo "   macOS: brew install zip"
    exit 1
fi

# Run the Node.js script
node "$(dirname "$0")/createSessionArchive.js"
