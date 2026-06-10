import importPlugin from 'eslint-plugin-import';
import stylistic from '@stylistic/eslint-plugin';
import returnAwaitAsync from './.eslint-rules/return-await-async.js';

export default [
    {
        files: ['**/*.js'],
        ignores: [
            'node_modules/**',
            'session/**',
            'session_backup/**',
            'logs/**',
            'uploads/**',
            'temp/**'
        ],
        plugins: {
            import: importPlugin,
            '@stylistic': stylistic,
            'custom': {
                rules: {
                    'return-await-async': returnAwaitAsync
                }
            }
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Node.js globals
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                global: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                setImmediate: 'readonly',
                clearImmediate: 'readonly',
                // Browser globals (for puppeteer page.evaluate)
                window: 'readonly',
                document: 'readonly',
                fetch: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                navigator: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                TextDecoder: 'readonly',
                TextEncoder: 'readonly',
                Blob: 'readonly',
                atob: 'readonly',
                btoa: 'readonly',
                EventTarget: 'readonly',
                Event: 'readonly',
                HTMLElement: 'readonly',
                HTMLCanvasElement: 'readonly',
                HTMLInputElement: 'readonly',
                HTMLFormElement: 'readonly',
                AbortSignal: 'readonly',
                AbortController: 'readonly',
                ReadableStream: 'readonly',
                Response: 'readonly',
                Request: 'readonly',
                Headers: 'readonly',
                FormData: 'readonly'
            }
        },
        rules: {
            // === ERRORS (must fix) ===
            'no-undef': 'error', // Undefined variables
            'no-unused-vars': ['warn', {
                'argsIgnorePattern': '^_',
                'varsIgnorePattern': '^_'
            }], // Unused variables (downgraded to warn)
            'no-unreachable': 'warn', // Unreachable code (downgraded to warn)
            'no-const-assign': 'error', // Reassigning const
            'no-class-assign': 'error', // Reassigning class
            'no-dupe-keys': 'error', // Duplicate object keys
            'no-duplicate-case': 'error', // Duplicate case in switch
            'no-ex-assign': 'error', // Reassigning catch error
            'no-func-assign': 'error', // Reassigning function
            'no-invalid-regexp': 'error', // Invalid RegExp
            'no-irregular-whitespace': 'warn', // Irregular whitespace (downgraded)
            'no-sparse-arrays': 'warn', // Sparse arrays [,,] (downgraded)
            'no-template-curly-in-string': 'error', // ${} in regular strings
            'no-unexpected-multiline': 'warn', // Unexpected multiline (downgraded)
            'no-unsafe-negation': 'error', // ! in instanceof
            'valid-typeof': 'error', // Invalid typeof

            // === BEST PRACTICES ===
            'no-console': 'off', // Allow console.log
            'no-debugger': 'warn', // debugger statements
            'no-alert': 'off', // alert/confirm/prompt (used in browser code)
            'no-eval': 'warn', // eval() (sometimes needed)
            'no-implied-eval': 'warn', // string in setTimeout
            'no-iterator': 'error', // __iterator__
            'no-lone-blocks': 'warn', // Unnecessary blocks
            'no-multi-str': 'warn', // Multiline strings with \ (downgraded)
            'no-native-reassign': 'error', // Reassigning native objects
            'no-new-func': 'warn', // new Function() (downgraded)
            'no-new-wrappers': 'warn', // new String/Number/Boolean (downgraded)
            'no-proto': 'error', // __proto__
            'no-redeclare': 'warn', // Redeclaring variables (downgraded)
            'no-self-assign': 'warn', // x = x (downgraded)
            'no-self-compare': 'warn', // x === x
            'no-sequences': 'warn', // Comma operator
            'no-throw-literal': 'warn', // throw "string" (downgraded)
            'no-useless-call': 'warn', // Unnecessary call/apply
            'no-useless-concat': 'warn', // Unnecessary concatenation
            'no-useless-escape': 'warn', // Unnecessary escapes
            'no-useless-return': 'warn', // Unnecessary return
            'no-var': 'warn', // Use let/const instead of var (downgraded)
            'no-with': 'error', // with statement

            // === ESM SPECIFIC ===
            'import/no-unresolved': 'warn', // Unresolved imports
            'import/named': 'warn', // Named imports exist (downgraded)
            'import/default': 'warn', // Default imports exist (downgraded)
            'import/namespace': 'warn', // Namespace imports exist (downgraded)
            'import/export': 'error', // Export issues

            // === CODE QUALITY ===
            'curly': ['error', 'all'], // Always use curly braces
            'eqeqeq': ['error', 'always'], // Use === instead of ==
            'no-empty': 'warn', // Empty blocks
            'no-multi-spaces': 'error', // Multiple spaces
            'no-multiple-empty-lines': ['error', { 'max': 3 }],
            'no-trailing-spaces': 'error',
            'semi': ['error', 'always'],
            'quotes': ['error', 'single', { 'avoidEscape': true }],
            'indent': ['error', 4],
            'comma-dangle': ['warn', 'never'],
            'arrow-parens': ['warn', 'always'],

            // === POTENTIAL BUGS ===
            'require-await': 'warn', // async without await (downgraded)
            'custom/return-await-async': 'error', // Require await when returning async function calls
            'no-promise-executor-return': 'warn', // Return in Promise executor (downgraded)
            'no-unmodified-loop-condition': 'warn', // Loop condition never changes
            'no-unreachable-loop': 'warn', // Loop that only runs once
            'getter-return': 'warn', // Getter without return (downgraded)
            'no-async-promise-executor': 'warn', // async in Promise executor (downgraded)
            'no-await-in-loop': 'warn' // await in loop (performance)
        }
    }
];
