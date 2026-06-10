#!/usr/bin/env node
/**
 * Test script to diagnose Telegram proxy connectivity issues
 * Usage: node test-telegram-proxy.js
 */

import { ProxyAgent } from 'undici';
import fetch from 'node-fetch';

const TELEGRAM_PROXY = process.env.TELEGRAM_PROXY || 'http://user263298:kgw8aj@172.111.196.84:1577';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not set in .env file');
    process.exit(1);
}

async function testDirectConnection() {
    console.log('\n📡 Testing DIRECT connection to Telegram API...');
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`;
        const response = await fetch(url, { timeout: 10000 });
        const data = await response.json();

        if (data.ok) {
            console.log('✅ Direct connection SUCCESS');
            console.log(`   Bot: @${data.result.username}`);
            return true;
        } else {
            console.log('❌ Direct connection failed:', data.description);
            return false;
        }
    } catch (error) {
        console.log('❌ Direct connection ERROR:');
        console.log(`   Message: ${error.message}`);
        console.log(`   Code: ${error.code || 'N/A'}`);
        if (error.cause) {
            console.log(`   Cause: ${error.cause.message || error.cause.code || String(error.cause)}`);
        }
        return false;
    }
}

async function testProxyConnection() {
    console.log('\n🌐 Testing PROXY connection to Telegram API...');
    console.log(`   Proxy: ${TELEGRAM_PROXY.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);

    try {
        const proxyAgent = new ProxyAgent(TELEGRAM_PROXY);
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`;

        const response = await fetch(url, {
            dispatcher: proxyAgent,
            timeout: 15000
        });

        const data = await response.json();

        if (data.ok) {
            console.log('✅ Proxy connection SUCCESS');
            console.log(`   Bot: @${data.result.username}`);
            return true;
        } else {
            console.log('❌ Proxy connection failed:', data.description);
            return false;
        }
    } catch (error) {
        console.log('❌ Proxy connection ERROR:');
        console.log(`   Message: ${error.message}`);
        console.log(`   Code: ${error.code || 'N/A'}`);
        if (error.cause) {
            console.log(`   Cause: ${error.cause.message || error.cause.code || String(error.cause)}`);
        }
        return false;
    }
}

async function testProxyReachability() {
    console.log('\n🔍 Testing PROXY server reachability...');
    const proxyUrl = new URL(TELEGRAM_PROXY);
    const host = proxyUrl.hostname;
    const port = proxyUrl.port;

    console.log(`   Host: ${host}`);
    console.log(`   Port: ${port}`);

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
        // Test with ping
        const { stdout } = await execAsync(`ping -c 3 -W 2 ${host}`, { timeout: 10000 });
        console.log('✅ Proxy server is reachable via ping');

        // Extract timing info
        const timingMatch = stdout.match(/rtt min\/avg\/max\/mdev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/);
        if (timingMatch) {
            console.log(`   Latency: ${timingMatch[2]} ms (avg)`);
        }
        return true;
    } catch (error) {
        console.log('⚠️ Ping test failed (this is OK if ICMP is blocked)');
        console.log('   Testing TCP connection instead...');

        try {
            // Test TCP connection using node
            const net = await import('net');
            const socket = new net.Socket();

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    socket.destroy();
                    reject(new Error('TCP connection timeout'));
                }, 5000);

                socket.connect(parseInt(port), host, () => {
                    clearTimeout(timeout);
                    socket.destroy();
                    resolve();
                });

                socket.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
            });

            console.log('✅ Proxy server TCP port is reachable');
            return true;
        } catch (tcpError) {
            console.log('❌ Proxy server is NOT reachable:');
            console.log(`   ${tcpError.message}`);
            return false;
        }
    }
}

async function main() {
    console.log('🔧 Telegram Proxy Diagnostics Tool');
    console.log('='.repeat(50));

    const directOk = await testDirectConnection();
    const proxyReachable = await testProxyReachability();
    const proxyOk = await testProxyConnection();

    console.log('\n' + '='.repeat(50));
    console.log('📊 DIAGNOSIS SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Direct connection:  ${directOk ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`Proxy reachable:    ${proxyReachable ? '✅ YES' : '❌ NO'}`);
    console.log(`Proxy connection:   ${proxyOk ? '✅ WORKING' : '❌ FAILED'}`);

    console.log('\n💡 RECOMMENDATIONS:');
    if (directOk && !proxyOk) {
        console.log('   - Direct connection works, but proxy fails');
        console.log('   - Check proxy credentials and server status');
        console.log('   - Verify proxy URL format: protocol://user:pass@host:port');
        console.log('   - Try using direct connection (remove TELEGRAM_PROXY from .env)');
    } else if (!directOk && proxyOk) {
        console.log('   - Proxy is required in your region');
        console.log('   - Proxy is working correctly');
        console.log('   - Keep TELEGRAM_PROXY configured');
    } else if (!directOk && !proxyOk) {
        console.log('   - Neither direct nor proxy connections work');
        console.log('   - Check your internet connection');
        console.log('   - Verify Telegram API is accessible from your network');
        console.log('   - Try different proxy server');
    } else {
        console.log('   - Both connections working');
        console.log('   - You can use either direct or proxy connection');
    }
    console.log('='.repeat(50));
}

main().catch(console.error);
