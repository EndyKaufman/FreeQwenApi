#!/usr/bin/env node

/**
 * qwen-api-proxy - CLI entry point for global installation
 *
 * This script:
 * 1. Sets up the working directory structure in the current location
 * 2. Creates necessary directories (session, logs, uploads, temp)
 * 3. Creates .env.example if not exists
 * 4. Passes control to the main index.js
 */

import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const WORKING_DIR = process.cwd();

// Parse command-line arguments early to get custom directory
const args = process.argv.slice(2);
const dirFlag = args.find((arg) => arg.startsWith('--dir='));
const customDir = dirFlag ? dirFlag.split('=')[1] : null;

// Use custom directory if specified
const EFFECTIVE_DIR = customDir ? path.resolve(customDir) : WORKING_DIR;
if (customDir) {
    console.log(`📍 Using custom directory: ${EFFECTIVE_DIR}`);
    if (!fs.existsSync(EFFECTIVE_DIR)) {
        fs.mkdirSync(EFFECTIVE_DIR, { recursive: true });
    }
}

/**
 * Creates required directories in the working directory
 */
function setupWorkingDirectory(targetDir = EFFECTIVE_DIR) {
    const dirs = [
        'session',
        'session/accounts',
        'session/history',
        'logs',
        'uploads',
        'temp'
    ];

    console.log('📁 Setting up working directory...');

    dirs.forEach((dir) => {
        const dirPath = path.join(targetDir, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`   ✓ Created ${dir}/`);
        } else {
            console.log(`   ✓ ${dir}/ already exists`);
        }
    });

    // Create .gitkeep for history
    const gitkeepPath = path.join(targetDir, 'session', 'history', '.gitkeep');
    if (!fs.existsSync(gitkeepPath)) {
        fs.writeFileSync(gitkeepPath, '');
    }
}

/**
 * Creates .env file from example if it doesn't exist
 */
function setupEnvFile(targetDir = EFFECTIVE_DIR) {
    const envPath = path.join(targetDir, '.env');
    const envExamplePath = path.join(targetDir, '.env.example');

    if (!fs.existsSync(envPath)) {
        // Copy .env.example from package if it exists in working dir, otherwise create basic
        const packageEnvExample = path.join(PACKAGE_ROOT, '.env.example');

        if (fs.existsSync(packageEnvExample)) {
            fs.copyFileSync(packageEnvExample, envExamplePath);
            console.log('   ✓ Created .env.example');
        }

        // Create empty .env if not exists
        if (!fs.existsSync(envPath)) {
            fs.writeFileSync(envPath, '# Qwen API Proxy Configuration\n# See .env.example for available options\n\n');
            console.log('   ✓ Created .env (empty)');
        }
    } else {
        console.log('   ✓ .env already exists');
    }
}

/**
 * Creates or validates root .gitignore file
 */
function setupGitignore(targetDir = EFFECTIVE_DIR) {
    const gitignorePath = path.join(targetDir, '.gitignore');
    const requiredEntries = [
        'session',
        'logs',
        'uploads',
        'temp',
        'session_backup',
        'session_backup_*'
    ];
    const missingEntries = [];

    // Check which entries are missing from .gitignore
    if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf8');
        const lines = content.split('\n').map((line) => line.trim());
        requiredEntries.forEach((entry) => {
            if (!lines.includes(entry)) {
                missingEntries.push(entry);
            }
        });
    } else {
        // .gitignore doesn't exist - create it
        const gitignoreContent = `# Qwen API Proxy - Auto-generated
# Sensitive data and runtime files
session
logs
uploads
temp
session_backup

# Backup archives
session_backup_*
*.zip

# Environment files
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*

# Runtime files
.restart_flag
.pending_archive
.last_telegram_update
`;
        fs.writeFileSync(gitignorePath, gitignoreContent);
        console.log('   ✓ Created .gitignore');
    }

    return missingEntries;
}

/**
 * Check if zip is available (cross-platform)
 */
function checkDependencies() {
    const isWindows = process.platform === 'win32';

    try {
        // On Windows, check for zip.exe or 7z.exe
        if (isWindows) {
            try {
                execSync('zip --version', { stdio: 'ignore' });
                console.log('   ✓ zip command available');
                return;
            } catch (e) {
                // Try 7z as alternative
                try {
                    execSync('7z --help', { stdio: 'ignore' });
                    console.log('   ✓ 7z command available (alternative to zip)');
                    return;
                } catch (e2) {
                    // Neither available
                }
            }
            console.warn('   ⚠️  zip/7z command not found (required for archive command)');
            console.warn('      Install with: choco install zip or download 7-Zip from 7-zip.org');
        } else {
            // Unix-like systems (Linux, macOS)
            execSync('zip --version', { stdio: 'ignore' });
            console.log('   ✓ zip command available');
        }
    } catch (error) {
        if (!isWindows) {
            console.warn('   ⚠️  zip command not found (required for archive command)');
            console.warn('      Install with: sudo apt install zip (Ubuntu) or brew install zip (macOS)');
        }
    }
}

/**
 * Main setup function
 */
function setup() {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║        Qwen API Proxy - Working Directory Setup          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log(`📍 Working directory: ${EFFECTIVE_DIR}\n`);

    setupWorkingDirectory();
    console.log();
    setupEnvFile();
    console.log();

    const missingGitignoreDirs = setupGitignore();
    console.log();

    checkDependencies();

    console.log('\n✅ Working directory setup complete!\n');
    console.log('📝 Next steps for first-time users:');
    console.log('   1. Add an account: qwen-api-proxy (or npx qwen-api-proxy)');
    console.log('      - Select "1 - Add new account"');
    console.log('      - Browser will open for authentication');
    console.log('      - Login to Qwen and press ENTER in console');
    console.log('   2. Create archive: qwen-api-proxy archive');
    console.log('   3. Start server: qwen-api-proxy');
    console.log('\n💡 Alternative: Use Telegram bot to upload session files');
    console.log('   - Configure TELEGRAM_BOT_TOKEN in .env file');
    console.log('   - Send session archive to the bot');
    console.log('\n');

    // Show warnings for missing .gitignore entries
    if (missingGitignoreDirs.length > 0) {
        console.warn('⚠️  WARNING: The following entries are not in .gitignore:');
        missingGitignoreDirs.forEach((entry) => {
            console.warn(`   - ${entry}`);
        });
        console.warn('\n   Add them to .gitignore to prevent committing sensitive data!\n');
    }
}

// Run setup only on first run or when --setup flag is used
const needsSetup = args.includes('--setup') || !fs.existsSync(path.join(EFFECTIVE_DIR, 'session'));

// Parse command from arguments (already defined args above)
const command = args.find((arg) => !arg.startsWith('-'));

// Handle 'init' command - manual setup only
if (command === 'init') {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║        Qwen API Proxy - Initialize Working Directory     ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log(`📍 Working directory: ${EFFECTIVE_DIR}\n`);

    setupWorkingDirectory(EFFECTIVE_DIR);
    console.log();
    setupEnvFile(EFFECTIVE_DIR);
    console.log();

    const missingGitignoreDirs = setupGitignore(EFFECTIVE_DIR);
    console.log();

    checkDependencies();

    console.log('\n✅ Working directory initialized successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Edit .env file with your configuration');
    console.log('   2. Run: qwen-api-proxy');
    console.log('\n');

    // Show warnings for missing .gitignore entries
    if (missingGitignoreDirs.length > 0) {
        console.warn('⚠️  WARNING: The following entries are not in .gitignore:');
        missingGitignoreDirs.forEach((entry) => {
            console.warn(`   - ${entry}`);
        });
        console.warn('\n   Add them to .gitignore to prevent committing sensitive data!\n');
    }

    process.exit(0);
}

// Handle 'doctor' command - system health check
if (command === 'doctor') {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║        Qwen API Proxy - System Health Check              ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    const issues = [];
    const warnings = [];
    const ok = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion >= 18) {
        ok.push(`Node.js ${nodeVersion} (✓ version >= 18)`);
    } else {
        issues.push(`Node.js ${nodeVersion} (✗ requires >= 18)`);
    }

    // Check zip command (cross-platform)
    const isWindows = process.platform === 'win32';
    let zipAvailable = false;
    try {
        if (isWindows) {
            try {
                execSync('zip --version', { stdio: 'ignore' });
                zipAvailable = true;
            } catch (e) {
                try {
                    execSync('7z --help', { stdio: 'ignore' });
                    zipAvailable = true; // 7z can work as alternative
                } catch (e2) {
                    // Neither available
                }
            }
        } else {
            execSync('zip --version', { stdio: 'ignore' });
            zipAvailable = true;
        }
    } catch (error) {
        // zip not available
    }

    if (zipAvailable) {
        ok.push('zip/7z command available');
    } else {
        warnings.push('zip/7z command not found (required for archive command)');
    }

    // Check working directory structure
    const requiredDirs = ['session', 'session/accounts', 'session/history', 'logs', 'uploads', 'temp'];
    requiredDirs.forEach((dir) => {
        const dirPath = path.join(EFFECTIVE_DIR, dir);
        if (fs.existsSync(dirPath)) {
            ok.push(`${dir}/ directory exists`);
        } else {
            warnings.push(`${dir}/ directory missing`);
        }
    });

    // Check .env file
    const envPath = path.join(EFFECTIVE_DIR, '.env');
    if (fs.existsSync(envPath)) {
        ok.push('.env file exists');

        // Check for common configurations
        const envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('TELEGRAM_BOT_TOKEN=') && !envContent.includes('TELEGRAM_BOT_TOKEN=your_bot_token_here')) {
            ok.push('Telegram bot token configured');
        } else {
            warnings.push('Telegram bot token not configured (optional)');
        }
    } else {
        warnings.push('.env file not found (run "qwen-api-proxy init" to create)');
    }

    // Check .gitignore file
    const gitignorePath = path.join(EFFECTIVE_DIR, '.gitignore');
    const requiredGitignoreEntries = [
        'session',
        'logs',
        'uploads',
        'temp',
        'session_backup',
        'session_backup_*'
    ];
    const missingGitignoreEntries = [];

    if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf8');
        const lines = content.split('\n').map((line) => line.trim());
        requiredGitignoreEntries.forEach((entry) => {
            if (!lines.includes(entry)) {
                missingGitignoreEntries.push(entry);
            }
        });

        if (missingGitignoreEntries.length === 0) {
            ok.push('.gitignore properly configured');
        } else {
            warnings.push(`.gitignore missing: ${missingGitignoreEntries.join(', ')}`);
        }
    } else {
        warnings.push('.gitignore not found (run "qwen-api-proxy init" to create)');
    }

    // Check permissions
    const testDirs = ['session', 'logs', 'uploads'];
    let permissionsOk = true;
    testDirs.forEach((dir) => {
        const dirPath = path.join(EFFECTIVE_DIR, dir);
        if (fs.existsSync(dirPath)) {
            try {
                const testFile = path.join(dirPath, '.write_test');
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);
            } catch (error) {
                issues.push(`${dir}/ - no write permission`);
                permissionsOk = false;
            }
        }
    });
    if (permissionsOk) {
        ok.push('Directory permissions OK');
    }

    // Check session data
    const tokensPath = path.join(EFFECTIVE_DIR, 'session', 'tokens.json');
    if (fs.existsSync(tokensPath)) {
        try {
            const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
            if (Array.isArray(tokens) && tokens.length > 0) {
                ok.push(`${tokens.length} account(s) configured`);
            } else {
                warnings.push('No accounts configured (run server and add account)');
            }
        } catch (error) {
            issues.push('tokens.json is corrupted');
        }
    } else {
        warnings.push('No accounts configured yet');
    }

    // Check disk space (cross-platform)
    try {
        if (isWindows) {
            // Use PowerShell or wmic on Windows
            try {
                const wmicOutput = execSync('wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace /value', { encoding: 'utf8' });
                const match = wmicOutput.match(/FreeSpace=(\d+)/);
                if (match) {
                    const availableBytes = parseInt(match[1]);
                    const availableGB = (availableBytes / 1024 / 1024 / 1024).toFixed(2);
                    if (availableGB > 1) {
                        ok.push(`Disk space: ${availableGB} GB available`);
                    } else {
                        warnings.push(`Low disk space: ${availableGB} GB available`);
                    }
                }
            } catch (e) {
                // wmic might not be available, try PowerShell
                try {
                    const psOutput = execSync('powershell -Command "(Get-PSDrive C).Free"', { encoding: 'utf8' });
                    const freeBytes = parseInt(psOutput.trim());
                    if (!isNaN(freeBytes)) {
                        const availableGB = (freeBytes / 1024 / 1024 / 1024).toFixed(2);
                        if (availableGB > 1) {
                            ok.push(`Disk space: ${availableGB} GB available`);
                        } else {
                            warnings.push(`Low disk space: ${availableGB} GB available`);
                        }
                    }
                } catch (e2) {
                    // Skip disk check on Windows if commands fail
                }
            }
        } else {
            // Unix-like systems
            const dfOutput = execSync('df -k .', { encoding: 'utf8' });
            const lines = dfOutput.split('\n');
            if (lines.length >= 2) {
                const parts = lines[1].split(/\s+/);
                const availableKB = parseInt(parts[3]);
                const availableGB = (availableKB / 1024 / 1024).toFixed(2);
                if (availableGB > 1) {
                    ok.push(`Disk space: ${availableGB} GB available`);
                } else {
                    warnings.push(`Low disk space: ${availableGB} GB available`);
                }
            }
        }
    } catch (error) {
        // df/wmic not available, skip
    }

    // Print results
    console.log('✅ OK:');
    ok.forEach((msg) => console.log(`   ✓ ${msg}`));

    if (warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        warnings.forEach((msg) => console.log(`   ⚠ ${msg}`));
    }

    if (issues.length > 0) {
        console.log('\n❌ Issues:');
        issues.forEach((msg) => console.log(`   ✗ ${msg}`));
    }

    console.log('\n' + '='.repeat(60));
    if (issues.length === 0 && warnings.length === 0) {
        console.log('🎉 All checks passed! System is healthy.');
    } else if (issues.length === 0) {
        console.log(`✓ System operational (${warnings.length} warning(s))`);
    } else {
        console.log(`✗ ${issues.length} issue(s) found - please fix before running`);
    }
    console.log('='.repeat(60) + '\n');

    process.exit(issues.length > 0 ? 1 : 0);
}

if (needsSetup) {
    setup();
}

// Set environment variable to indicate we're running from global install
process.env.QWEN_API_PROXY_GLOBAL = 'true';

// Import and run the main application
// Convert path to file:// URL for cross-platform ESM compatibility
const indexPath = path.join(PACKAGE_ROOT, 'index.js');
const indexUrl = pathToFileURL(indexPath).href;
await import(indexUrl);
