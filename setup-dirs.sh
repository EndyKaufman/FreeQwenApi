#!/bin/bash

# Script to create and configure Docker volume directories
# Ensures proper permissions and git tracking files

set -e

echo "📁 Setting up Docker volume directories..."
echo ""

# Define directories
DIRS=("session_backup" "session" "logs" "uploads" "temp")

for dir in "${DIRS[@]}"; do
    echo "  Creating ./$dir..."
    
    # Create directory if it doesn't exist
    mkdir -p "$dir"
    
    # Try to set full permissions (read/write/execute for all)
    if chmod 777 "$dir" 2>/dev/null; then
        echo "    ✓ Permissions set to 777"
    else
        echo "    ⚠ Cannot change permissions (owned by Docker?)"
    fi
    
    # Create .gitkeep to ensure directory is tracked by git
    if [ ! -f "$dir/.gitkeep" ]; then
        if touch "$dir/.gitkeep" 2>/dev/null; then
            echo "    ✓ Created .gitkeep"
        else
            echo "    ✗ Cannot create .gitkeep (permission denied)"
        fi
    else
        echo "    • .gitkeep already exists"
    fi
    
    # Create .gitignore to ignore directory contents but keep the directory
    if [ ! -f "$dir/.gitignore" ]; then
        cat > "$dir/.gitignore" << 'EOF'
# Ignore all files in this directory
*
# Except git tracking files
!.gitkeep
!.gitignore
EOF
        echo "    ✓ Created .gitignore"
    else
        echo "    • .gitignore already exists"
    fi
done

# Special handling for session directory - create accounts and history subdirectories
echo ""
echo "  Setting up session subdirectories..."
mkdir -p session/accounts
mkdir -p session/history

if chmod 777 session/accounts session/history 2>/dev/null; then
    echo "    ✓ Subdirectory permissions set"
else
    echo "    ⚠ Cannot change subdirectory permissions"
fi

# Add .gitkeep files for subdirectories
if [ ! -f session/accounts/.gitkeep ]; then
    if touch session/accounts/.gitkeep 2>/dev/null; then
        echo "    ✓ Created session/accounts/.gitkeep"
    else
        echo "    ✗ Cannot create session/accounts/.gitkeep"
    fi
fi

if [ ! -f session/history/.gitkeep ]; then
    if touch session/history/.gitkeep 2>/dev/null; then
        echo "    ✓ Created session/history/.gitkeep"
    else
        echo "    ✗ Cannot create session/history/.gitkeep"
    fi
fi

# Add .gitignore for history (to ignore JSON files but keep directory)
if [ ! -f session/history/.gitignore ]; then
    cat > session/history/.gitignore << 'EOF'
*.json
!.gitkeep
!.gitignore
EOF
    echo "    ✓ Created session/history/.gitignore"
fi

echo ""
echo "✅ All directories configured successfully!"
echo ""
echo "Directory structure:"
echo "  ./session_backup/    - Backup sessions before updates"
echo "  ./session/           - Qwen tokens and accounts"
echo "    ├── accounts/      - Individual account data"
echo "    └── history/       - Chat history files"
echo "  ./logs/              - Application logs"
echo "  ./uploads/           - Temporary uploaded files"
echo "  ./temp/              - Archive extraction temp dir"
echo ""
echo "All directories configured with 777 permissions (full access)"
echo "Ready for Docker volume mounting!"
echo ""
echo "💡 Tip: If you see permission warnings, run:"
echo "   sudo chown -R $USER:$USER session_backup session logs uploads temp"
echo "   sudo chmod -R 777 session_backup session logs uploads temp"
