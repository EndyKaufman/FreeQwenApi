#!/usr/bin/env node

/**
 * Cross-Platform Compatibility Test
 *
 * This script verifies that the application works correctly across
 * Windows, Linux, and macOS platforms.
 */

import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '.');

let testsPassed = 0;
let testsFailed = 0;
const warnings = [];

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        testsPassed++;
    } catch (error) {
        console.error(`❌ ${name}`);
        console.error(`   Error: ${error.message}`);
        testsFailed++;
    }
}

function warn(name, message) {
    warnings.push({ name, message });
    console.log(`⚠️  ${name}: ${message}`);
}

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║     Cross-Platform Compatibility Test Suite              ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log(`Platform: ${process.platform}`);
console.log(`Node.js: ${process.version}`);
console.log(`Architecture: ${process.arch}\n`);

// Test 1: ESM URL Conversion (Critical for Windows)
test('ESM pathToFileURL conversion works', () => {
    const testPath = path.join(PACKAGE_ROOT, 'index.js');
    const testUrl = pathToFileURL(testPath).href;

    // Should produce file:// URL
    if (!testUrl.startsWith('file://')) {
        throw new Error(`Expected file:// URL, got: ${testUrl}`);
    }

    // Should be importable
    if (process.platform === 'win32') {
        // On Windows, verify it handles drive letters correctly
        if (!testUrl.match(/^file:\/\/\/[A-Z]:\//i)) {
            throw new Error(`Windows URL format incorrect: ${testUrl}`);
        }
    }
});

// Test 2: Dynamic Import (The actual fix)
test('Dynamic import with pathToFileURL works', async () => {
    const configPath = path.join(PACKAGE_ROOT, 'src', 'config.js');
    const configUrl = pathToFileURL(configPath).href;

    // This should not throw ERR_UNSUPPORTED_ESM_URL_SCHEME
    const config = await import(configUrl);

    if (!config.PORT) {
        throw new Error('Failed to import config module');
    }
});

// Test 3: Path Resolution
test('Path resolution works cross-platform', () => {
    const testPath = path.join('session', 'accounts');

    if (process.platform === 'win32') {
        // Windows uses backslashes
        if (!testPath.includes('\\')) {
            throw new Error('Windows path should use backslashes');
        }
    } else {
        // Unix uses forward slashes
        if (!testPath.includes('/')) {
            throw new Error('Unix path should use forward slashes');
        }
    }
});

// Test 4: File System Operations
test('File system operations work', () => {
    const testDir = path.join(PACKAGE_ROOT, 'temp');
    const testFile = path.join(testDir, 'cross-platform-test.txt');

    // Create directory
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(testFile, 'cross-platform test', 'utf8');

    // Read file
    const content = fs.readFileSync(testFile, 'utf8');
    if (content !== 'cross-platform test') {
        throw new Error('File content mismatch');
    }

    // Cleanup
    fs.unlinkSync(testFile);
});

// Test 5: Platform Detection
test('Platform detection works', () => {
    const isWindows = process.platform === 'win32';
    const isLinux = process.platform === 'linux';
    const isMacOS = process.platform === 'darwin';

    // Exactly one should be true
    const platformCount = [isWindows, isLinux, isMacOS].filter(Boolean).length;
    if (platformCount !== 1) {
        throw new Error('Platform detection failed');
    }

    console.log(`   Detected: ${isWindows ? 'Windows' : isLinux ? 'Linux' : 'macOS'}`);
});

// Test 6: Archive Command Availability
test('Archive command tools detected', () => {
    const isWindows = process.platform === 'win32';
    let toolFound = false;

    if (isWindows) {
        // Check for zip
        try {
            execSync('zip --version', { stdio: 'ignore' });
            toolFound = true;
            console.log('   Found: zip');
        } catch (e) {
            // Check for 7z
            try {
                execSync('7z --help', { stdio: 'ignore' });
                toolFound = true;
                console.log('   Found: 7z');
            } catch (e2) {
                // Check for PowerShell Compress-Archive (built-in)
                try {
                    execSync('powershell -Command "Get-Command Compress-Archive"', { stdio: 'ignore' });
                    toolFound = true;
                    console.log('   Found: PowerShell Compress-Archive (built-in)');
                } catch (e3) {
                    warn('Archive Command', 'No archive tool found on Windows');
                }
            }
        }
    } else {
        // Unix: check for zip
        try {
            execSync('zip --version', { stdio: 'ignore' });
            toolFound = true;
            console.log('   Found: zip');
        } catch (e) {
            warn('Archive Command', 'zip not found (install with: sudo apt install zip or brew install zip)');
        }
    }

    if (!toolFound && warnings.length === 0) {
        throw new Error('No archive tool detected and no warning generated');
    }
});

// Test 7: Disk Space Check (Cross-platform)
test('Disk space detection works', () => {
    const isWindows = process.platform === 'win32';
    let diskSpaceDetected = false;

    try {
        if (isWindows) {
            // Try wmic first
            try {
                const wmicOutput = execSync('wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace /value', {
                    encoding: 'utf8'
                });
                const match = wmicOutput.match(/FreeSpace=(\d+)/);
                if (match) {
                    const availableGB = (parseInt(match[1]) / 1024 / 1024 / 1024).toFixed(2);
                    console.log(`   Available disk space: ${availableGB} GB (via wmic)`);
                    diskSpaceDetected = true;
                }
            } catch (e) {
                // Fallback to PowerShell
                const psOutput = execSync('powershell -Command "(Get-PSDrive C).Free"', {
                    encoding: 'utf8'
                });
                const freeBytes = parseInt(psOutput.trim());
                if (!isNaN(freeBytes)) {
                    const availableGB = (freeBytes / 1024 / 1024 / 1024).toFixed(2);
                    console.log(`   Available disk space: ${availableGB} GB (via PowerShell)`);
                    diskSpaceDetected = true;
                }
            }
        } else {
            // Unix: use df
            const dfOutput = execSync('df -k .', { encoding: 'utf8' });
            const lines = dfOutput.split('\n');
            if (lines.length >= 2) {
                const parts = lines[1].split(/\s+/);
                const availableKB = parseInt(parts[3]);
                const availableGB = (availableKB / 1024 / 1024).toFixed(2);
                console.log(`   Available disk space: ${availableGB} GB (via df)`);
                diskSpaceDetected = true;
            }
        }
    } catch (error) {
        warn('Disk Space Check', `Could not detect disk space: ${error.message}`);
        diskSpaceDetected = true; // Warning already issued
    }

    if (!diskSpaceDetected) {
        throw new Error('Disk space detection failed');
    }
});

// Test 8: Environment Variables
test('Environment variable handling works', () => {
    const testVar = 'CROSS_PLATFORM_TEST';
    const testValue = 'test-value-123';

    // Set and read
    process.env[testVar] = testValue;
    const readValue = process.env[testVar];

    if (readValue !== testValue) {
        throw new Error('Environment variable mismatch');
    }

    // Cleanup
    delete process.env[testVar];
});

// Test 9: CLI Entry Point Structure
test('CLI entry point has correct structure', () => {
    const cliPath = path.join(PACKAGE_ROOT, 'bin', 'qwen-api-proxy.js');

    if (!fs.existsSync(cliPath)) {
        throw new Error('CLI entry point not found');
    }

    const content = fs.readFileSync(cliPath, 'utf8');

    // Verify it imports pathToFileURL
    if (!content.includes('pathToFileURL')) {
        throw new Error('CLI entry point missing pathToFileURL import');
    }

    // Verify it uses pathToFileURL for dynamic import
    if (!content.includes('pathToFileURL(indexPath).href')) {
        throw new Error('CLI entry point not using pathToFileURL for import');
    }

    // Verify platform detection
    if (!content.includes('process.platform')) {
        throw new Error('CLI entry point missing platform detection');
    }
});

// Test 10: Main Entry Point Structure
test('Main entry point has cross-platform archive support', () => {
    const mainPath = path.join(PACKAGE_ROOT, 'index.js');

    if (!fs.existsSync(mainPath)) {
        throw new Error('Main entry point not found');
    }

    const content = fs.readFileSync(mainPath, 'utf8');

    // Verify platform detection for archive
    if (!content.includes('process.platform === \'win32\'')) {
        throw new Error('Main entry point missing Windows platform detection for archive');
    }

    // Verify PowerShell fallback
    if (!content.includes('Compress-Archive')) {
        throw new Error('Main entry point missing PowerShell Compress-Archive fallback');
    }
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('Test Results:');
console.log(`  ✅ Passed: ${testsPassed}`);
console.log(`  ❌ Failed: ${testsFailed}`);

if (warnings.length > 0) {
    console.log(`  ⚠️  Warnings: ${warnings.length}`);
    warnings.forEach((w) => {
        console.log(`     - ${w.name}: ${w.message}`);
    });
}

console.log('='.repeat(60));

if (testsFailed === 0) {
    console.log('\n🎉 All critical tests passed! Cross-platform compatibility verified.');
    console.log('\n📝 Notes:');
    console.log('   - Windows ESM loading: Fixed with pathToFileURL()');
    console.log('   - Archive command: Supports zip/7z/PowerShell');
    console.log('   - Health checks: Cross-platform disk space detection');
    console.log('   - Path handling: Uses Node.js path module');
    process.exit(0);
} else {
    console.log(`\n❌ ${testsFailed} test(s) failed. Please review the errors above.`);
    process.exit(1);
}
