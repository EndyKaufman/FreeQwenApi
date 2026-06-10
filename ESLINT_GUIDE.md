# ESLint Configuration Guide

## Overview

This project uses ESLint for static code analysis to catch errors, bugs, and code quality issues.

## Quick Commands

```bash
# Check all JS files for errors
npm run lint

# Auto-fix common issues (formatting, unused vars, etc.)
npm run lint:fix
```

## Configuration

ESLint is configured in `eslint.config.js` using the new flat config format.

### Browser Globals

Since this project uses Puppeteer to execute code in browser context (`page.evaluate()`), many browser APIs are defined as globals:

- `window`, `document`, `fetch`
- `localStorage`, `sessionStorage`
- `navigator`
- `URL`, `URLSearchParams`
- `TextDecoder`, `TextEncoder`
- `Blob`, `atob`, `btoa`
- `EventTarget`, `Event`, `HTMLElement`
- `HTMLCanvasElement`, `HTMLInputElement`, `HTMLFormElement`
- `AbortSignal`, `AbortController`
- `ReadableStream`, `Response`, `Request`, `Headers`, `FormData`

**No errors will be reported for these browser APIs.**

### Error Levels

- **error** - Must fix (blocks execution)
- **warn** - Should fix (doesn't block)
- **off** - Disabled

### Critical Rules (error level)

Only these issues will block:

- `no-undef` - Undefined variables (real bugs)
- `no-const-assign` - Reassigning const
- `no-dupe-keys` - Duplicate object keys
- `no-func-assign` - Reassigning functions
- `no-invalid-regexp` - Invalid regular expressions
- `import/export` - Export issues

### Downgraded Rules (warn level)

These are warnings, not errors:

- `no-unused-vars` - Unused variables (prefix with `_` to ignore)
- `require-await` - Async functions without await
- `no-promise-executor-return` - Return in Promise executor
- `no-redeclare` - Redeclaring variables
- `no-var` - Using var instead of let/const
- All formatting rules (indentation, quotes, etc.)

## Common Issues

### 1. Using `require()` in ESM

**Problem:**
```javascript
const fs = require('fs'); // Error: 'require' is not defined
```

**Solution:**
```javascript
import fs from 'fs'; // Use ESM import
```

### 2. Unused Variables

**Problem:**
```javascript
const { used, unused } = obj; // Warning: 'unused' is defined but never used
```

**Solution A - Remove it:**
```javascript
const { used } = obj;
```

**Solution B - Prefix with underscore:**
```javascript
const { used, _unused } = obj; // ESLint will ignore it
```

### 3. Missing Imports

**Problem:**
```javascript
const result = SOME_CONST + 1; // Error: 'SOME_CONST' is not defined
```

**Solution:**
```javascript
import { SOME_CONST } from './config.js';

const result = SOME_CONST + 1;
```

### 4. Duplicate Object Keys

**Problem:**
```javascript
const models = {
  'qwen-plus': 'Qwen Plus',
  'qwen-plus': 'Qwen Plus V2' // Error: Duplicate key
};
```

**Solution:**
```javascript
const models = {
  'qwen-plus': 'Qwen Plus V2' // Remove duplicate
};
```

## Ignoring Files

The following directories are automatically ignored:

- `node_modules/`
- `session/`
- `session_backup/`
- `logs/`
- `uploads/`
- `temp/`

## Legacy Scripts

Some old scripts in `scripts/` directory still use CommonJS (`require`). These should be migrated to ESM:

- `scripts/test_direct_qwen.js` - Uses require()
- `scripts/run_tests.js` - Uses require()

To run these temporarily, you can:
1. Add them to ESLint ignore
2. Or convert to ESM imports

## Adding New Browser Globals

If you need to use a browser API that ESLint complains about, add it to `eslint.config.js`:

```javascript
globals: {
    // ... existing globals
    NewBrowserAPI: 'readonly',
}
```

## Best Practices

1. **Run `npm run lint:fix` before committing** - Auto-fixes formatting and style issues
2. **Fix all errors** - Warnings are OK, but errors must be fixed
3. **Prefix unused vars with `_`** - Tells ESLint you intentionally didn't use it
4. **Use ESM imports** - Don't use `require()` in new code
5. **Check browser code carefully** - Code inside `page.evaluate()` runs in browser, not Node.js

## Current Status

- **Total problems**: ~214
- **Errors**: 13 (must fix)
- **Warnings**: 201 (should fix)

Most warnings are:
- Unused variables (easy to fix)
- Async functions without await (sometimes intentional)
- Promise executor returns (minor issue)

## Migration Plan

1. ✅ Configure ESLint with browser globals
2. ✅ Downgrade non-critical rules to warnings
3. ⏳ Fix remaining 13 errors
4. ⏳ Convert CommonJS scripts to ESM
5. ⏳ Reduce warnings to zero
