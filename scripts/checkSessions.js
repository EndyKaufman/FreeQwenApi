#!/usr/bin/env node

/**
 * Session Diagnostics Tool
 * 
 * This script checks all accounts and reports:
 * - Which accounts have cookies.json
 * - Which accounts have token.txt
 * - Token expiry information
 * - Overall session health
 * 
 * Usage:
 *   npm run check-sessions
 *   or
 *   node scripts/checkSessions.js
 */

import { loadTokens } from '../src/api/tokenManager.js';
import { logInfo, logError, logWarn } from '../src/logger/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SESSION_DIR } from '../src/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SESSION_PATH = path.resolve(ROOT_DIR, SESSION_DIR);

/**
 * Check session health for all accounts
 */
function checkSessionHealth() {
    const tokens = loadTokens();
    
    if (tokens.length === 0) {
        console.log('⚠️  No accounts found in tokens.json');
        console.log('\n💡 To create a new session:');
        console.log('   npm run create-session-archive');
        return;
    }

    console.log(`\n📊 Session Health Report`);
    console.log(`═`.repeat(60));
    console.log(`Total accounts: ${tokens.length}\n`);

    let healthyCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    tokens.forEach((token, index) => {
        const accountDir = path.join(SESSION_PATH, 'accounts', token.id);
        const tokenFile = path.join(accountDir, 'token.txt');
        const cookiesFile = path.join(accountDir, 'cookies.json');

        const hasTokenFile = fs.existsSync(tokenFile);
        const hasCookies = fs.existsSync(cookiesFile);
        
        let tokenStatus = '❌';
        let expiryInfo = '';
        
        if (token.expiryTime) {
            const now = Date.now();
            const timeLeft = token.expiryTime - now;
            
            if (timeLeft <= 0) {
                tokenStatus = '⚠️';
                expiryInfo = 'EXPIRED';
            } else {
                const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                
                if (hoursLeft > 24) {
                    const days = Math.floor(hoursLeft / 24);
                    tokenStatus = '✅';
                    expiryInfo = `${days}d ${hoursLeft % 24}h remaining`;
                } else if (hoursLeft > 0) {
                    tokenStatus = '✅';
                    expiryInfo = `${hoursLeft}h ${minutesLeft}m remaining`;
                } else {
                    tokenStatus = '⚠️';
                    expiryInfo = `${minutesLeft}m remaining (CRITICAL)`;
                }
            }
        } else {
            expiryInfo = 'No expiry info';
        }

        // Determine overall account status
        let accountStatus;
        if (hasTokenFile && hasCookies && tokenStatus === '✅') {
            accountStatus = '✅';
            healthyCount++;
        } else if (hasTokenFile && !hasCookies) {
            accountStatus = '⚠️';
            warningCount++;
        } else {
            accountStatus = '❌';
            errorCount++;
        }

        console.log(`${accountStatus} Account ${index + 1}: ${token.id}`);
        console.log(`   Token file: ${hasTokenFile ? '✅' : '❌'}`);
        console.log(`   Cookies:    ${hasCookies ? '✅' : '❌'}`);
        console.log(`   Token:      ${tokenStatus} ${expiryInfo}`);
        
        if (!hasCookies) {
            console.log(`   ⚠️  WARNING: Cannot extend session without cookies!`);
            console.log(`   💡 Run: npm run create-session-archive`);
        }
        
        console.log('');
    });

    console.log(`═`.repeat(60));
    console.log(`Summary:`);
    console.log(`  ✅ Healthy:  ${healthyCount}`);
    console.log(`  ⚠️  Warnings: ${warningCount}`);
    console.log(`  ❌ Errors:   ${errorCount}`);
    console.log(`═`.repeat(60));

    if (warningCount > 0 || errorCount > 0) {
        console.log(`\n💡 Recommendations:`);
        
        if (warningCount > 0) {
            console.log(`   - ${warningCount} account(s) missing cookies.json`);
            console.log(`   - These accounts cannot be extended via /extend command`);
            console.log(`   - Solution: Run npm run create-session-archive`);
        }
        
        if (errorCount > 0) {
            console.log(`   - ${errorCount} account(s) have critical issues`);
            console.log(`   - May need re-authentication`);
        }
        
        console.log('');
    }
}

// Run diagnostics
try {
    checkSessionHealth();
} catch (error) {
    logError('Session diagnostics failed', error);
    console.error('❌ Diagnostics failed:', error.message);
    process.exit(1);
}
