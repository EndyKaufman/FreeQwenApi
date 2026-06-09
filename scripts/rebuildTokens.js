#!/usr/bin/env node

/**
 * Rebuild tokens.json from account directories
 * 
 * This script scans the session/accounts directory for token.txt files
 * and rebuilds the tokens.json registry.
 * 
 * Usage:
 *   npm run rebuild-tokens
 *   or
 *   node scripts/rebuildTokens.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SESSION_DIR, ACCOUNTS_DIR } from '../src/config.js';
import { logInfo, logError, logWarn } from '../src/logger/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SESSION_PATH = path.resolve(ROOT_DIR, SESSION_DIR);
const ACCOUNTS_PATH = path.join(SESSION_PATH, ACCOUNTS_DIR);
const TOKENS_FILE = path.join(SESSION_PATH, 'tokens.json');

/**
 * Decode JWT to get expiry time
 */
function decodeJwtExpiry(token) {
    try {
        if (!token || typeof token !== 'string') return null;
        
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
            base64 += '=';
        }
        
        const payload = Buffer.from(base64, 'base64').toString('utf8');
        const decoded = JSON.parse(payload);
        
        if (decoded.exp) {
            return decoded.exp * 1000;
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Rebuild tokens.json from account directories
 */
function rebuildTokens() {
    console.log('🔍 Scanning account directories...\n');
    
    if (!fs.existsSync(ACCOUNTS_PATH)) {
        logError(`Accounts directory not found: ${ACCOUNTS_PATH}`);
        process.exit(1);
    }
    
    const accounts = fs.readdirSync(ACCOUNTS_PATH).filter(dir => {
        return fs.statSync(path.join(ACCOUNTS_PATH, dir)).isDirectory();
    });
    
    if (accounts.length === 0) {
        logWarn('No account directories found');
        process.exit(0);
    }
    
    console.log(`📁 Found ${accounts.length} account(s):\n`);
    
    const tokens = [];
    const now = Date.now();
    
    for (const accountId of accounts) {
        const accountDir = path.join(ACCOUNTS_PATH, accountId);
        const tokenFile = path.join(accountDir, 'token.txt');
        
        if (!fs.existsSync(tokenFile)) {
            logWarn(`  ⚠️  ${accountId}: No token.txt file`);
            continue;
        }
        
        try {
            const token = fs.readFileSync(tokenFile, 'utf8').trim();
            
            if (!token) {
                logWarn(`  ⚠️  ${accountId}: Empty token`);
                continue;
            }
            
            // Decode JWT expiry
            const expiryTime = decodeJwtExpiry(token);
            let expiryStatus = '✅ Valid';
            
            if (expiryTime) {
                const timeLeft = expiryTime - now;
                if (timeLeft <= 0) {
                    expiryStatus = '❌ Expired';
                } else {
                    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    expiryStatus = `⏰ ${days}d ${hours}h left`;
                }
            } else {
                expiryStatus = '⚠️  No expiry';
            }
            
            // Build token entry
            const tokenEntry = {
                id: accountId,
                token: token,
                resetAt: null,
                invalid: false,
                expiryTime: expiryTime
            };
            
            tokens.push(tokenEntry);
            console.log(`  ✅ ${accountId}: ${expiryStatus}`);
            
        } catch (error) {
            logError(`  ❌ ${accountId}: Error reading token`, error);
        }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total accounts: ${accounts.length}`);
    console.log(`   Valid tokens: ${tokens.length}`);
    
    // Save tokens.json
    try {
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
        console.log(`\n✅ tokens.json rebuilt successfully!`);
        console.log(`📄 File: ${TOKENS_FILE}`);
    } catch (error) {
        logError('Failed to save tokens.json', error);
        process.exit(1);
    }
    
    // Show token details
    console.log('\n📋 Token Details:');
    tokens.forEach((t, i) => {
        const expiryDate = t.expiryTime ? new Date(t.expiryTime).toISOString() : 'N/A';
        console.log(`\n${i + 1}. ${t.id}`);
        console.log(`   Expires: ${expiryDate}`);
        console.log(`   Token: ${t.token.substring(0, 50)}...`);
    });
    
    console.log('\n✨ Done! You can now start the server.');
}

// Run
rebuildTokens();
