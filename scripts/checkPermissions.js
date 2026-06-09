#!/usr/bin/env node

/**
 * Standalone Permission Checker
 * 
 * Run this script at any time to check directory/file permissions:
 *   npm run check-permissions
 *   or
 *   node scripts/checkPermissions.js
 */

import { checkPermissions } from '../src/utils/permissionChecker.js';

// Run the check
checkPermissions()
  .then(ok => {
    if (ok) {
      console.log('\n✅ Все проверки пройдены успешно!');
      process.exit(0);
    } else {
      console.log('\n❌ Обнаружены проблемы с правами доступа');
      console.log('Выполните команды, указанные выше, для исправления');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Ошибка при проверке прав доступа:', error);
    process.exit(1);
  });
