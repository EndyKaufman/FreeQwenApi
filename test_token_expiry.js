// Test script for token expiry checking and Telegram notifications
import { checkTokenExpiry, checkAllTokensExpiry, getSafeToken, saveTokens, loadTokens } from './src/api/tokenManager.js';
import { sendTelegramNotification, formatTokenExpiryMessage } from './src/utils/telegramNotifier.js';
import { logInfo, logWarn, logError } from './src/logger/index.js';

async function testTokenExpiry() {
    console.log('\n=== Token Expiry Checking Test ===\n');

    // Test 1: Check current tokens
    console.log('Test 1: Check all tokens expiry status');
    const status = checkAllTokensExpiry();
    console.log('Status:', JSON.stringify(status, null, 2));

    // Test 2: Create test tokens with different expiry times
    console.log('\nTest 2: Create test tokens');
    const now = Date.now();
    const testTokens = [
        {
            id: 'test_token_1',
            token: 'token123',
            resetAt: null // No expiry
        },
        {
            id: 'test_token_2',
            token: 'token456',
            resetAt: new Date(now + 30 * 60 * 1000).toISOString() // 30 minutes
        },
        {
            id: 'test_token_3',
            token: 'token789',
            resetAt: new Date(now + 2 * 60 * 60 * 1000).toISOString() // 2 hours
        },
        {
            id: 'test_token_4',
            token: 'token012',
            resetAt: new Date(now - 60 * 60 * 1000).toISOString(), // Already expired
            invalid: false
        },
        {
            id: 'test_token_5',
            token: 'token345',
            invalid: true // Invalid token
        }
    ];

    saveTokens(testTokens);
    console.log('✓ Test tokens created');

    // Test 3: Check individual tokens
    console.log('\nTest 3: Check individual tokens');
    for (const token of testTokens) {
        const expiry = checkTokenExpiry(token.id);
        console.log(`\n${token.id}:`);
        console.log(`  - Will expire soon: ${expiry.willExpireSoon}`);
        console.log(`  - Time left: ${expiry.timeLeft ? Math.floor(expiry.timeLeft / 60000) + ' min' : 'N/A'}`);
        console.log(`  - Is expired: ${expiry.isExpired || false}`);
        console.log(`  - Is invalid: ${expiry.isInvalid || false}`);
    }

    // Test 4: Get safe token
    console.log('\nTest 4: Get safe token');
    const safeToken = await getSafeToken();
    console.log('Safe token:', safeToken ? safeToken.id : 'null');

    // Test 5: Check all tokens after test data
    console.log('\nTest 5: Check all tokens expiry');
    const allStatus = checkAllTokensExpiry();
    console.log('Total tokens:', allStatus.totalTokens);
    console.log('Active tokens:', allStatus.activeTokens);
    console.log('All expired:', allStatus.allTokensExpired);
    console.log('Expiring tokens:', allStatus.expiringTokens.length);

    // Test 6: Format Telegram message
    if (allStatus.expiringTokens.length > 0) {
        console.log('\nTest 6: Format Telegram message');
        const message = formatTokenExpiryMessage(allStatus.expiringTokens);
        console.log('Formatted message:');
        console.log(message.replace(/<[^>]*>/g, '')); // Remove HTML tags for console
    }

    // Test 7: Send Telegram notification (only if configured)
    console.log('\nTest 7: Send Telegram notification');
    const telegramSent = await sendTelegramNotification(
        '🧪 <b>Test Message</b>\n\nToken expiry checking is working correctly!'
    );
    console.log('Telegram sent:', telegramSent);

    // Cleanup: Restore original tokens
    console.log('\nCleanup: Restoring original tokens');
    const originalTokens = loadTokens().filter((t) => !t.id.startsWith('test_token_'));
    saveTokens(originalTokens);
    console.log('✓ Original tokens restored');

    console.log('\n=== All tests completed ===\n');
}

// Run tests
testTokenExpiry().catch((error) => {
    logError('Test failed', error);
    process.exit(1);
});
