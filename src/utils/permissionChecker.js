#!/usr/bin/env node

/**
 * Permission Checker
 *
 * Checks write permissions for all project directories and files at startup.
 * Provides helpful commands to fix any permission issues.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logWarn, logError } from '../logger/index.js';
import { SESSION_DIR, UPLOADS_DIR, LOGS_DIR } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../..');

/**
 * Define all directories and files that need write access
 */
const PATHS_TO_CHECK = [
    // Main directories
    { path: SESSION_DIR, type: 'directory', recursive: true },
    { path: path.join(SESSION_DIR, 'accounts'), type: 'directory', recursive: true },
    { path: path.join(SESSION_DIR, 'history'), type: 'directory', recursive: true },
    { path: UPLOADS_DIR, type: 'directory', recursive: false },
    { path: LOGS_DIR, type: 'directory', recursive: false },
    { path: 'temp', type: 'directory', recursive: false },
    { path: 'session_backup', type: 'directory', recursive: false },

    // Important files
    { path: path.join(SESSION_DIR, 'tokens.json'), type: 'file', optional: true },
    { path: path.join(SESSION_DIR, 'auth_token.txt'), type: 'file', optional: true },
    { path: path.join(SESSION_DIR, 'bot_settings.json'), type: 'file', optional: true },
    { path: '.env', type: 'file', optional: true }
];

/**
 * Test if a path is writable
 */
function testWritePermission(testPath, type) {
    try {
        if (type === 'directory') {
            // Test directory writability by checking if we can create/delete a temp file
            const tempFile = path.join(testPath, '.write_test_' + Date.now());
            fs.writeFileSync(tempFile, 'test');
            fs.unlinkSync(tempFile);
            return { writable: true, error: null };
        } else if (type === 'file') {
            // For files, test if parent directory is writable
            const parentDir = path.dirname(testPath);
            if (!fs.existsSync(parentDir)) {
                return { writable: false, error: `Parent directory does not exist: ${parentDir}` };
            }
            // Try to read if file exists
            if (fs.existsSync(testPath)) {
                fs.accessSync(testPath, fs.constants.R_OK | fs.constants.W_OK);
            }
            return { writable: true, error: null };
        }
    } catch (error) {
        return { writable: false, error: error.message };
    }
}

/**
 * Generate fix commands for a path
 */
function generateFixCommands(testPath, type) {
    const absolutePath = path.isAbsolute(testPath) ? testPath : path.join(ROOT_DIR, testPath);
    const commands = [];

    if (type === 'directory' || (type === 'file' && fs.existsSync(testPath))) {
    // Fix ownership
        commands.push(`sudo chown -R $USER:$USER "${absolutePath}"`);
        // Fix permissions
        if (type === 'directory') {
            commands.push(`sudo chmod -R 755 "${absolutePath}"`);
        } else {
            commands.push(`sudo chmod 644 "${absolutePath}"`);
        }
    } else if (type === 'file' && !fs.existsSync(testPath)) {
    // File doesn't exist, fix parent directory
        const parentDir = path.dirname(absolutePath);
        commands.push(`sudo chown -R $USER:$USER "${parentDir}"`);
        commands.push(`sudo chmod -R 755 "${parentDir}"`);
    }

    return commands;
}

/**
 * Check all paths and report issues
 */
export async function checkPermissions() {
    logInfo('🔍 Проверка прав доступа к директориям и файлам...');

    const issues = [];
    const allCommands = new Set();

    for (const { path: relativePath, type, optional, recursive } of PATHS_TO_CHECK) {
        const absolutePath = path.isAbsolute(relativePath) ? relativePath : path.join(ROOT_DIR, relativePath);

        // Skip optional paths that don't exist
        if (optional && !fs.existsSync(absolutePath)) {
            continue;
        }

        // For directories, check if they exist
        if (type === 'directory' && !fs.existsSync(absolutePath)) {
            // Try to create it
            try {
                fs.mkdirSync(absolutePath, { recursive: true });
                logInfo(`  ✅ Создана директория: ${relativePath}`);
            } catch (error) {
                issues.push({
                    path: relativePath,
                    absolutePath,
                    type,
                    error: `Cannot create directory: ${error.message}`,
                    commands: generateFixCommands(path.dirname(absolutePath), 'directory')
                });
            }
            continue;
        }

        // Test write permission
        const result = testWritePermission(absolutePath, type);

        if (!result.writable) {
            issues.push({
                path: relativePath,
                absolutePath,
                type,
                error: result.error,
                commands: generateFixCommands(absolutePath, type)
            });
        }
    }

    // Report results
    if (issues.length === 0) {
        logInfo('✅ Все директории и файлы доступны для записи');
        return true;
    }

    // Report issues
    logError(`❌ Обнаружены проблемы с правами доступа (${issues.length}):`);
    console.error('');

    for (const issue of issues) {
        logError(`  📁 ${issue.path} (${issue.type})`);
        logError(`     Ошибка: ${issue.error}`);
        logError('     Решение:');
        for (const cmd of issue.commands) {
            console.error(`       ${cmd}`);
            allCommands.add(cmd);
        }
        console.error('');
    }

    // Show combined fix command
    if (allCommands.size > 0) {
        console.error('═'.repeat(70));
        console.error('🔧 Быстрое решение (скопируйте и выполните в терминале):');
        console.error('═'.repeat(70));
        console.error('');
        console.error('  ⚡ ОДНОЙ СТРОКОЙ (рекомендуется):');
        console.error('  ' + '─'.repeat(68));

        // Group by parent directory for cleaner output
        const dirsToFix = new Set();
        for (const issue of issues) {
            if (issue.type === 'directory') {
                dirsToFix.add(issue.absolutePath);
            } else {
                dirsToFix.add(path.dirname(issue.absolutePath));
            }
        }

        const allPaths = Array.from(dirsToFix).join(' ');
        console.error('');
        console.error(`  sudo chown -R $USER:$USER ${allPaths}`);
        console.error(`  sudo chmod -R 755 ${allPaths}`);
        console.error('');

        console.error('  📦 ИЛИ исправить все основные директории проекта:');
        console.error('  ' + '─'.repeat(68));
        const mainDirs = [
            path.join(ROOT_DIR, SESSION_DIR),
            path.join(ROOT_DIR, UPLOADS_DIR),
            path.join(ROOT_DIR, LOGS_DIR),
            path.join(ROOT_DIR, 'temp'),
            path.join(ROOT_DIR, 'session_backup')
        ].join(' ');
        console.error(`  sudo chown -R $USER:$USER ${mainDirs}`);
        console.error(`  sudo chmod -R 755 ${mainDirs}`);
        console.error('');
        console.error('═'.repeat(70));
        console.error('');
    }

    return false;
}
