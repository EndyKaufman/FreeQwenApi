#!/usr/bin/env node
/**
 * Quick verification script for Browser Profile Mode
 * Run: node scripts/verify-profile-mode.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('🔍 Verifying Browser Profile Mode Implementation...\n');

let allChecks = true;

function check(description, condition) {
    const status = condition ? '✅' : '❌';
    console.log(`${status} ${description}`);
    if (!condition) {
        allChecks = false;
    }
}

// 1. Check config.js has BROWSER_PERSISTENCE_MODE
try {
    const configPath = path.join(rootDir, 'src', 'config.js');
    const configContent = fs.readFileSync(configPath, 'utf8');
    check(
        'config.js exports BROWSER_PERSISTENCE_MODE',
        configContent.includes('export const BROWSER_PERSISTENCE_MODE')
    );
} catch (error) {
    check('config.js has BROWSER_PERSISTENCE_MODE', false);
}

// 2. Check browser.js has profile mode functions
try {
    const browserPath = path.join(rootDir, 'src', 'browser', 'browser.js');
    const browserContent = fs.readFileSync(browserPath, 'utf8');
    check(
        'browser.js imports BROWSER_PERSISTENCE_MODE',
        browserContent.includes('BROWSER_PERSISTENCE_MODE')
    );
    check(
        'browser.js has getProfileDir function',
        browserContent.includes('function getProfileDir()')
    );
    check(
        'browser.js has getLatestProfile function',
        browserContent.includes('function getLatestProfile()')
    );
    check(
        'browser.js has getDedicatedPage export',
        browserContent.includes('export function getDedicatedPage()')
    );
    check(
        'browser.js has isProfileMode export',
        browserContent.includes('export function isProfileMode()')
    );
    check(
        'browser.js uses userDataDir in launch options',
        browserContent.includes('launchOptions.userDataDir')
    );
} catch (error) {
    check('browser.js has profile mode functions', false);
}

// 3. Check chat.js respects profile mode
try {
    const chatPath = path.join(rootDir, 'src', 'api', 'chat.js');
    const chatContent = fs.readFileSync(chatPath, 'utf8');
    check(
        'chat.js imports isProfileMode',
        chatContent.includes('isProfileMode')
    );
    check(
        'chat.js imports getDedicatedPage',
        chatContent.includes('getDedicatedPage')
    );
    check(
        'pagePool.getPage checks isProfileMode()',
        chatContent.includes('if (isProfileMode())')
    );
} catch (error) {
    check('chat.js respects profile mode', false);
}

// 4. Check auth.js respects profile mode
try {
    const authPath = path.join(rootDir, 'src', 'browser', 'auth.js');
    const authContent = fs.readFileSync(authPath, 'utf8');
    check(
        'auth.js imports isProfileMode',
        authContent.includes('isProfileMode')
    );
    check(
        'auth.js skips saveSession in profile mode',
        authContent.includes('if (!isProfileMode())') &&
        authContent.includes('saveSession')
    );
} catch (error) {
    check('auth.js respects profile mode', false);
}

// 5. Check telegramBot.js respects profile mode
try {
    const telegramPath = path.join(rootDir, 'src', 'utils', 'telegramBot.js');
    const telegramContent = fs.readFileSync(telegramPath, 'utf8');
    check(
        'telegramBot.js imports isProfileMode',
        telegramContent.includes('isProfileMode')
    );
} catch (error) {
    check('telegramBot.js respects profile mode', false);
}

// 6. Check documentation
try {
    const docPath = path.join(rootDir, 'docs', 'BROWSER_PROFILE_MODE.md');
    check(
        'Documentation exists (docs/BROWSER_PROFILE_MODE.md)',
        fs.existsSync(docPath)
    );
} catch (error) {
    check('Documentation exists', false);
}

// 7. Check .env.example
try {
    const envPath = path.join(rootDir, '.env.example');
    const envContent = fs.readFileSync(envPath, 'utf8');
    check(
        '.env.example documents BROWSER_PERSISTENCE_MODE',
        envContent.includes('BROWSER_PERSISTENCE_MODE')
    );
} catch (error) {
    check('.env.example documents BROWSER_PERSISTENCE_MODE', false);
}

// 8. Check session directory structure
try {
    const sessionDir = path.join(rootDir, 'session');
    check(
        'session/ directory exists',
        fs.existsSync(sessionDir)
    );
} catch (error) {
    check('session/ directory exists', false);
}

// Summary
console.log('\n' + '='.repeat(60));
if (allChecks) {
    console.log('✅ All verification checks passed!');
    console.log('\n📝 To use profile mode:');
    console.log('   1. Add to .env: BROWSER_PERSISTENCE_MODE=profile');
    console.log('   2. Run: node index.js');
    console.log('   3. Complete authentication when prompted');
    console.log('   4. Profile will be saved to: session/browser-profiles/default/');
} else {
    console.log('❌ Some checks failed. Please review the implementation.');
    process.exit(1);
}
console.log('='.repeat(60));
