# Smart Archive Command - How It Works

## ✅ Works in BOTH Scenarios

### 1. npm Package (Global CLI)
```bash
# User installs via npm
npm install -g qwen-api-proxy

# Or uses npx (no installation)
npx qwen-api-proxy archive

# Flow:
# 1. bin/qwen-api-proxy.js runs first
# 2. Sets up working directory
# 3. Imports index.js via pathToFileURL()
# 4. index.js handleCLICommand() processes 'archive'
# 5. Smart logic: checks accounts → offers to add → creates archive
```

### 2. Direct Usage (Development/Manual)
```bash
# User clones repository
git clone https://github.com/EndyKaufman/FreeQwenApi
cd FreeQwenApi

# Runs directly
node index.js archive

# OR via npm script
npm run archive

# Flow:
# 1. index.js runs directly
# 2. handleCLICommand() processes 'archive'
# 3. Smart logic: checks accounts → offers to add → creates archive
```

## 🔍 Code Flow

### Entry Points

**npm Package:**
```
npx qwen-api-proxy archive
    ↓
bin/qwen-api-proxy.js (line 1-510)
    ├─ Sets up working directory
    ├─ Creates session/, logs/, uploads/, temp/
    ├─ Creates .env if missing
    ├─ Sets QWEN_API_PROXY_GLOBAL=true
    └─ await import(index.js) ← via pathToFileURL()
        ↓
index.js (line 273-337)
    └─ handleCLICommand('archive')
        ├─ Checks for accounts
        ├─ If no accounts → offers 3 options
        ├─ If option 1 → adds account via browser
        └─ Creates archive
```

**Direct Usage:**
```
node index.js archive
    ↓
index.js (line 273-337)
    └─ handleCLICommand('archive')
        ├─ Checks for accounts
        ├─ If no accounts → offers 3 options
        ├─ If option 1 → adds account via browser
        └─ Creates archive
```

## 📋 Smart Archive Logic

### Step 1: Check for Existing Accounts

```javascript
// Checks two locations:
const tokensPath = path.join(process.cwd(), SESSION_DIR, 'tokens.json');
const accountsPath = path.join(process.cwd(), SESSION_DIR, ACCOUNTS_DIR);

// Method 1: Check tokens.json
if (fs.existsSync(tokensPath)) {
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    if (Array.isArray(tokens) && tokens.length > 0) {
        hasAccounts = true;
    }
}

// Method 2: Check accounts/ directory
if (!hasAccounts && fs.existsSync(accountsPath)) {
    const accounts = fs.readdirSync(accountsPath);
    if (accounts.length > 0) {
        hasAccounts = true;
    }
}
```

### Step 2: Decision Tree

```
┌─────────────────────────────────────┐
│  Run: npx qwen-api-proxy archive    │
│  or: node index.js archive          │
└──────────────┬──────────────────────┘
               ↓
        Check for accounts
               ↓
        ┌──────┴──────┐
        │             │
    Has accounts   No accounts
        │             ↓
        │      Show menu:
        │      1. Add now (browser)
        │      2. Use Telegram bot
        │      3. Exit
        │             ↓
        │      User selects (Enter = 1)
        │             ↓
        │      ┌──────┴──────┬──────────┐
        │      │             │          │
        │   Option 1     Option 2   Option 3
        │   (default)   (Telegram)  (Exit)
        │      │             │          │
        │      ↓             ↓          ↓
        │   Open browser  Show info   Exit cleanly
        │   Add account   Exit
        │      ↓
        │   Save account
        │      ↓
        └──────┴─────────────┘
               ↓
        Create Archive
               ↓
        Show statistics:
        ✓ Accounts: X
        ✓ Tokens: Y
               ↓
        Success! 📦
```

### Step 3: Account Addition (If Needed)

```javascript
if (!hasAccounts) {
    // Prompt user
    const { prompt } = await import('./src/utils/prompt.js');
    const choice = await prompt('Ваш выбор (1/2/3, Enter = 1): ');
    
    if (choice === '2') {
        // Telegram bot option
        console.log('💡 Для использования Telegram бота:');
        console.log('   1. Добавьте TELEGRAM_BOT_TOKEN в .env файл');
        console.log('   2. Запустите: npx qwen-api-proxy');
        console.log('   3. Отправьте файл сессии боту\n');
        process.exit(0);
    } else if (choice === '3') {
        // Exit gracefully
        console.log('👋 Выход. Запустите "npx qwen-api-proxy" для добавления аккаунта.\n');
        process.exit(0);
    }
    
    // Default: choice === '1' or Enter
    console.log('🔐 Запуск браузера для добавления аккаунта...\n');
    
    const { addAccountInteractive } = await import('./src/utils/accountSetup.js');
    const accountId = await addAccountInteractive();
    
    if (!accountId) {
        console.log('\n❌ Аккаунт не был добавлен. Архив не создан.\n');
        process.exit(1);
    }
    
    console.log(`\n✅ Аккаунт ${accountId} успешно добавлен!\n`);
}
```

### Step 4: Archive Creation

```javascript
// Now create archive (always runs after account check)
const archivePath = createSessionArchive();

console.log('\n🎉 ГОТОВО!');
console.log(`📄 Архив: ${archivePath}`);
console.log('\n📱 Следующие шаги:');
console.log('   1. Откройте Telegram бота');
console.log('   2. Нажмите 📎 (скрепка)');
console.log('   3. Выберите "Файл" (НЕ "Фото"!)');
console.log('   4. Отправьте архив боту');
console.log('   5. Дождитесь подтверждения\n');
process.exit(0);
```

## 🧪 Testing Both Scenarios

### Test 1: npm Package (npx)

```bash
# Clean test
rm -rf test-npx
mkdir test-npx
cd test-npx

# Run via npx
npx qwen-api-proxy archive

# Expected behavior:
# 1. Setup working directory
# 2. Detect no accounts
# 3. Show menu: "Аккаунты не найдены..."
# 4. Wait for user input
```

### Test 2: Direct Usage (node)

```bash
# In project directory
node index.js archive

# Expected behavior:
# 1. Detect no accounts (or find existing)
# 2. Show menu (if no accounts)
# 3. Wait for user input
```

### Test 3: npm Script

```bash
# In project directory
npm run archive

# Expected behavior:
# Same as "node index.js archive"
```

## 📊 Comparison Table

| Feature | npm Package (npx) | Direct (node) | npm Script |
|---------|------------------|---------------|------------|
| **Command** | `npx qwen-api-proxy archive` | `node index.js archive` | `npm run archive` |
| **Setup dirs** | ✅ Auto | ❌ Manual | ❌ Manual |
| **Create .env** | ✅ Auto | ❌ Manual | ❌ Manual |
| **Smart archive** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Account check** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Interactive menu** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Browser launch** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Cross-platform** | ✅ Yes | ✅ Yes | ✅ Yes |

## 🎯 Key Points

1. **Same Logic**: Both entry points use the **exact same** `handleCLICommand()` function in `index.js`

2. **npm Package Extra Steps**: `bin/qwen-api-proxy.js` only adds:
   - Working directory setup
   - .env file creation
   - .gitignore validation
   - Dependency checking (zip/7z)

3. **Core Functionality**: All smart archive logic is in `index.js`:
   - Account detection
   - Interactive menu
   - Browser launch
   - Archive creation

4. **Cross-Platform**: Works on Windows, Linux, macOS in both scenarios

5. **No Duplication**: Code is **not duplicated** - `bin/qwen-api-proxy.js` imports `index.js`

## 🔧 Configuration

### package.json

```json
{
  "name": "qwen-api-proxy",
  "version": "1.0.20",
  "bin": {
    "qwen-api-proxy": "./bin/qwen-api-proxy.js"  // CLI entry point
  },
  "main": "index.js",  // Library entry point
  "type": "module",
  "scripts": {
    "archive": "node index.js archive",  // npm script
    "start": "node index.js"
  }
}
```

### Files Array (npm publish)

```json
{
  "files": [
    "bin/",      // CLI entry point
    "src/",      // Source code
    "index.js",  // Main entry point
    ".env.example",
    "README.md"
  ]
}
```

## 💡 Use Cases

### For End Users (npm package)
```bash
# Just one command!
npx qwen-api-proxy archive

# Everything happens automatically:
# ✅ Directory setup
# ✅ Account detection
# ✅ Interactive menu (if needed)
# ✅ Browser launch (if needed)
# ✅ Archive creation
```

### For Developers (direct usage)
```bash
# Clone and run
git clone https://github.com/EndyKaufman/FreeQwenApi
cd FreeQwenApi
npm install
node index.js archive

# Or use npm scripts
npm run archive
```

### For Docker
```bash
docker run -v $(pwd)/session:/app/session \
           qwen-api-proxy:1.0.20 \
           node index.js archive
```

## ✅ Summary

**YES! It works in BOTH:**
- ✅ npm package (`npx qwen-api-proxy archive`)
- ✅ Direct usage (`node index.js archive`)
- ✅ npm scripts (`npm run archive`)

**Same code, same logic, same behavior!** 🎉
