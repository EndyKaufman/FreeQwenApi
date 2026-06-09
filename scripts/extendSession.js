#!/usr/bin/env node

/**
 * Automatic Session Extender
 * 
 * This script automatically extends Qwen session tokens by:
 * 1. Opening browser in headless mode
 * 2. Loading existing cookies/session
 * 3. Navigating to Qwen to refresh the session
 * 4. Extracting and saving the new token
 * 5. Closing browser
 * 
 * Can be run manually or scheduled via cron
 * 
 * Usage:
 *   npm run extend-session
 *   or
 *   node scripts/extendSession.js
 *   or
 *   node scripts/extendSession.js --account-id acc_123456
 */

import { initBrowser, shutdownBrowser, getBrowserContext } from '../src/browser/browser.js';
import { extractAuthToken } from '../src/api/chat.js';
import { loadAuthToken, saveAuthToken, loadSession } from '../src/browser/session.js';
import { loadTokens, saveTokens, markRateLimited } from '../src/api/tokenManager.js';
import { logInfo, logError, logWarn } from '../src/logger/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SESSION_DIR, CHAT_PAGE_URL } from '../src/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SESSION_PATH = path.resolve(ROOT_DIR, SESSION_DIR);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        accountId: null,
        all: false,
        verbose: false
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--account-id' && i + 1 < args.length) {
            options.accountId = args[i + 1];
            i++;
        } else if (args[i] === '--all') {
            options.all = true;
        } else if (args[i] === '--verbose' || args[i] === '-v') {
            options.verbose = true;
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
Usage: node scripts/extendSession.js [options]

Options:
  --account-id <id>  Extend specific account (e.g., acc_1234567890)
  --all              Extend all accounts
  --verbose, -v      Show detailed logs
  --help, -h         Show this help message

Examples:
  # Extend all accounts (default)
  npm run extend-session

  # Extend specific account
  node scripts/extendSession.js --account-id acc_1234567890

  # Extend all with verbose output
  node scripts/extendSession.js --all --verbose
`);
            process.exit(0);
        }
    }

    return options;
}

/**
 * Load cookies for a specific account
 */
function loadAccountCookies(accountId) {
    const cookiesPath = path.join(SESSION_PATH, 'accounts', accountId, 'cookies.json');
    
    if (!fs.existsSync(cookiesPath)) {
        logWarn(`Cookies not found for account ${accountId}`);
        return null;
    }

    try {
        const cookiesData = fs.readFileSync(cookiesPath, 'utf8');
        const cookies = JSON.parse(cookiesData);
        logInfo(`Loaded ${cookies.length} cookies for account ${accountId}`);
        return cookies;
    } catch (error) {
        logError(`Failed to load cookies for ${accountId}`, error);
        return null;
    }
}

/**
 * Extend session for a single account
 */
async function extendAccountSession(accountId) {
    console.log(`\n🔄 Extending session for account: ${accountId}`);
    
    try {
        // Load existing cookies
        const cookies = loadAccountCookies(accountId);
        
        if (!cookies || cookies.length === 0) {
            logWarn(`⚠️ No cookies found for ${accountId}, skipping`);
            return { success: false, reason: 'no_cookies' };
        }

        // Initialize browser in headless mode (silent)
        logInfo('🌐 Opening browser in headless mode...');
        const browserOk = await initBrowser(false, true); // false = headless
        
        if (!browserOk) {
            throw new Error('Failed to initialize browser');
        }

        const ctx = getBrowserContext();
        
        // Load existing cookies into browser
        logInfo('🍪 Loading saved cookies...');
        if (ctx && typeof ctx.setCookie === 'function') {
            await ctx.setCookie(...cookies);
        }

        // Navigate to Qwen chat to refresh session (3 minutes timeout)
        logInfo('📄 Navigating to Qwen to refresh session...');
        await ctx.goto(CHAT_PAGE_URL, { 
            waitUntil: 'domcontentloaded', 
            timeout: 180000 // 3 minutes
        });

        // Wait for page to load and session to refresh (1 minute)
        await delay(60000);

        // Extract new token
        logInfo('🔑 Extracting new auth token...');
        const newToken = await extractAuthToken(ctx, true);

        if (!newToken) {
            logWarn(`⚠️ Failed to extract token for ${accountId}`);
            await shutdownBrowser();
            return { success: false, reason: 'token_extraction_failed' };
        }

        // Save new token
        const tokenFile = path.join(SESSION_PATH, 'accounts', accountId, 'token.txt');
        fs.writeFileSync(tokenFile, newToken, 'utf8');
        saveAuthToken(newToken);

        // Update tokens.json
        const tokens = loadTokens();
        const tokenIndex = tokens.findIndex(t => t.id === accountId);
        
        if (tokenIndex !== -1) {
            tokens[tokenIndex].token = newToken;
            tokens[tokenIndex].resetAt = null; // Clear rate limit
            tokens[tokenIndex].invalid = false; // Mark as valid
            tokens[tokenIndex].lastExtended = new Date().toISOString();
            saveTokens(tokens);
        }

        // Save updated cookies
        const newCookies = await ctx.cookies();
        const cookiesPath = path.join(SESSION_PATH, 'accounts', accountId, 'cookies.json');
        fs.writeFileSync(cookiesPath, JSON.stringify(newCookies, null, 2));

        // Close browser
        await shutdownBrowser();

        logInfo(`✅ Session extended successfully for ${accountId}`);
        return { success: true, accountId };

    } catch (error) {
        logError(`❌ Failed to extend session for ${accountId}`, error);
        
        // Ensure browser is closed
        try {
            await shutdownBrowser();
        } catch (e) {
            // ignore
        }
        
        return { success: false, reason: error.message };
    }
}

/**
 * Extend sessions for all accounts
 */
async function extendAllSessions() {
    const tokens = loadTokens();
    
    if (tokens.length === 0) {
        console.log('⚠️ No accounts found in tokens.json');
        return [];
    }

    console.log(`\n📊 Found ${tokens.length} account(s) to extend`);
    
    const results = [];
    
    for (const token of tokens) {
        // Skip invalid tokens
        if (token.invalid) {
            console.log(`\n⏭️ Skipping invalid account: ${token.id}`);
            results.push({ 
                success: false, 
                accountId: token.id, 
                reason: 'invalid_token' 
            });
            continue;
        }

        const result = await extendAccountSession(token.id);
        results.push(result);

        // Small delay between accounts to avoid rate limiting
        if (results.length < tokens.length) {
            await delay(2000);
        }
    }

    return results;
}

/**
 * Main function
 */
async function main() {
    const options = parseArgs();

    console.log(`
╔══════════════════════════════════════════════════════════╗
║           Automatic Session Extender                     ║
║                                                          ║
║  This script will:                                       ║
║  1. Open browser in headless mode                        ║
║  2. Load saved cookies                                   ║
║  3. Refresh session by visiting Qwen                     ║
║  4. Extract and save new token                           ║
╚══════════════════════════════════════════════════════════╝
`);

    try {
        let results = [];

        if (options.accountId) {
            // Extend specific account
            console.log(`🎯 Mode: Extend specific account ${options.accountId}`);
            const result = await extendAccountSession(options.accountId);
            results = [result];
        } else {
            // Extend all accounts (default)
            console.log('🌐 Mode: Extend all accounts');
            results = await extendAllSessions();
        }

        // Print summary
        console.log('\n' + '═'.repeat(60));
        console.log('📋 EXTENSION SUMMARY');
        console.log('═'.repeat(60));

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        results.forEach(result => {
            if (result.success) {
                console.log(`✅ ${result.accountId} - Extended successfully`);
            } else {
                console.log(`❌ ${result.accountId} - Failed: ${result.reason}`);
            }
        });

        console.log('\n' + '─'.repeat(60));
        console.log(`Total: ${results.length} | Success: ${successCount} | Failed: ${failCount}`);
        console.log('═'.repeat(60));

        if (failCount > 0) {
            console.log('\n⚠️ Some accounts failed to extend.');
            console.log('💡 You may need to re-authenticate manually using:');
            console.log('   npm run create-session-archive');
        } else if (successCount > 0) {
            console.log('\n🎉 All sessions extended successfully!');
        }

    } catch (error) {
        logError('Fatal error during session extension', error);
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    }
}

// Run
main().catch(error => {
    logError('Fatal error', error);
    process.exit(1);
});
