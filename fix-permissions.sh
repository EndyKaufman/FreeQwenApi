#!/bin/bash

# Fix Permissions Script
# 
# This script fixes permission issues for all FreeQwenApi directories and files.
# Run this if you see EACCES permission denied errors.
#
# Usage:
#   bash fix-permissions.sh
#   or
#   ./fix-permissions.sh

set -e

echo "🔧 FreeQwenApi - Fix Permissions Script"
echo "════════════════════════════════════════════════════════"
echo ""

# Get the current user
CURRENT_USER=$(whoami)
echo "👤 Current user: $CURRENT_USER"
echo ""

# Define directories to fix
DIRS=("session" "session/accounts" "session/history" "uploads" "logs" "temp" "session_backup")

echo "📁 Fixing ownership and permissions..."
echo ""

for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "  ✅ $dir/"
        
        # Fix ownership
        if sudo chown -R $CURRENT_USER:$CURRENT_USER "$dir" 2>/dev/null; then
            echo "     ✓ Ownership fixed"
        else
            echo "     ⚠ Could not change ownership (try running with sudo)"
        fi
        
        # Fix permissions
        if sudo chmod -R 755 "$dir" 2>/dev/null; then
            echo "     ✓ Permissions set to 755"
        else
            echo "     ⚠ Could not change permissions"
        fi
    else
        echo "  ⚠️ $dir/ - Directory not found, creating..."
        mkdir -p "$dir"
        if chmod 755 "$dir" 2>/dev/null; then
            echo "     ✓ Created with 755 permissions"
        fi
    fi
    echo ""
done

# Fix specific files if they exist
FILES=("session/tokens.json" "session/auth_token.txt" "session/bot_settings.json" "logs/combined.log" "logs/http.log" "logs/error.log" "logs/raw-responses.log")

echo "📄 Fixing file permissions..."
echo ""

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
        
        # Fix ownership
        if sudo chown $CURRENT_USER:$CURRENT_USER "$file" 2>/dev/null; then
            echo "     ✓ Ownership fixed"
        else
            echo "     ⚠ Could not change ownership"
        fi
        
        # Fix permissions (644 for files)
        if sudo chmod 644 "$file" 2>/dev/null; then
            echo "     ✓ Permissions set to 644"
        else
            echo "     ⚠ Could not change permissions"
        fi
    else
        echo "  ⏭️ $file - File not found (optional, will be created when needed)"
    fi
    echo ""
done

echo "════════════════════════════════════════════════════════"
echo "✅ Permissions fixed successfully!"
echo ""
echo "💡 You can now start the server:"
echo "   npm start"
echo ""
echo "🔍 To verify permissions, run:"
echo "   npm run check-permissions"
echo ""
