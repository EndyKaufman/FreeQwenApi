#!/usr/bin/env node

/**
 * CLI script to sync Qwen models from chat.qwen.ai
 * Usage: node scripts/syncModels.js
 */

import { syncQwenModels } from '../src/utils/modelSync.js';

async function main() {
    console.log('🚀 Starting Qwen model synchronization...\n');

    try {
        const merged = await syncQwenModels();

        console.log('\n✅ Synchronization completed successfully!');
        console.log(`📊 Total models: ${merged.length}`);
        console.log('📄 Models file: src/AvailableModels.txt');
        console.log('📖 Documentation: docs/QWEN_CHAT_MODELS.md');
    } catch (error) {
        console.error('\n❌ Synchronization failed:', error.message);
        process.exit(1);
    }
}

main();
