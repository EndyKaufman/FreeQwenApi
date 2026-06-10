#!/bin/sh
set -e

# Docker Entrypoint Script
# Fixes volume permissions and runs as non-root user

echo "🔧 FreeQwenApi - Container Initialization"
echo "═══════════════════════════════════════════════════════"

# Fix permissions for mounted volumes
echo "📁 Fixing permissions for mounted volumes..."

# Directories to fix
for dir in /app/session /app/session/accounts /app/session/history /app/uploads /app/logs /app/temp /app/session_backup; do
    if [ -d "$dir" ]; then
        chown -R appuser:appgroup "$dir" 2>/dev/null || true
        chmod -R 755 "$dir" 2>/dev/null || true
        echo "  ✅ $dir"
    fi
done

# Fix file permissions
for file in /app/session/tokens.json /app/session/auth_token.txt /app/session/bot_settings.json; do
    if [ -f "$file" ]; then
        chown appuser:appgroup "$file" 2>/dev/null || true
        chmod 644 "$file" 2>/dev/null || true
        echo "  ✅ $file"
    fi
done

echo ""
echo "✅ Permissions fixed successfully"
echo "👤 Switching to appuser..."
echo ""

# Execute the CMD as appuser (not root)
exec su-exec appuser:appgroup "$@"
