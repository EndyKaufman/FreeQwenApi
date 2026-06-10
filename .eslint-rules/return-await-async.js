/**
 * Custom ESLint rule to detect missing await when returning async function calls
 *
 * Rule: return-await-async
 * Description: Requires 'await' when returning the result of a function that returns Promise
 *
 * This rule detects functions that return Promise in two ways:
 * 1. Functions declared with 'async' keyword
 * 2. Functions that return Promise objects (e.g., return fetch(...), return new Promise(...))
 *
 * It does NOT check imported functions to avoid false positives.
 *
 * Bad:  return asyncFunction();
 * Good: return await asyncFunction();
 *
 * Bad:  return fetch(url);
 * Good: return await fetch(url);
 */

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'Require await when returning async function calls',
            category: 'Possible Errors',
            recommended: true
        },
        fixable: 'code',
        schema: [],
        messages: {
            missingAwait: "Missing 'await' when returning async function '{{funcName}}'. Use 'return await {{funcName}}(...)' instead."
        }
    },
    create(context) {
        // Track all async functions defined in the current file
        const asyncFunctions = new Set();
        // Track functions that return Promise (even without async keyword)
        const promiseReturningFunctions = new Set();

        return {
            // Track async function declarations
            FunctionDeclaration(node) {
                if (node.async && node.id) {
                    asyncFunctions.add(node.id.name);
                }
            },

            // Track async function expressions assigned to variables
            VariableDeclarator(node) {
                if (node.init &&
                    (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression') &&
                    node.init.async &&
                    node.id.type === 'Identifier') {
                    asyncFunctions.add(node.id.name);
                }
            },

            // Dual-purpose handler: track Promise-returning functions AND check for missing await
            ReturnStatement(node) {
                const argument = node.argument;
                if (!argument) {return;}

                // === PART 1: Track functions that return Promise ===
                if (argument.type === 'CallExpression') {
                    const calleeName = argument.callee.type === 'Identifier'
                        ? argument.callee.name
                        : argument.callee.type === 'MemberExpression'
                            ? argument.callee.property.name
                            : null;

                    if (calleeName === 'fetch' || calleeName?.includes('fetch')) {
                        // Find the enclosing function
                        let enclosingFunc = node.parent;
                        while (enclosingFunc) {
                            if (enclosingFunc.type === 'FunctionDeclaration' ||
                                enclosingFunc.type === 'FunctionExpression' ||
                                enclosingFunc.type === 'ArrowFunctionExpression') {
                                if (enclosingFunc.id) {
                                    promiseReturningFunctions.add(enclosingFunc.id.name);
                                }
                                break;
                            }
                            enclosingFunc = enclosingFunc.parent;
                        }
                    }

                    // Check for: return new Promise(...)
                    if (argument.callee.type === 'NewExpression' &&
                        argument.callee.callee.type === 'Identifier' &&
                        argument.callee.callee.name === 'Promise') {
                        let enclosingFunc = node.parent;
                        while (enclosingFunc) {
                            if (enclosingFunc.type === 'FunctionDeclaration' ||
                                enclosingFunc.type === 'FunctionExpression' ||
                                enclosingFunc.type === 'ArrowFunctionExpression') {
                                if (enclosingFunc.id) {
                                    promiseReturningFunctions.add(enclosingFunc.id.name);
                                }
                                break;
                            }
                            enclosingFunc = enclosingFunc.parent;
                        }
                    }
                }

                // === PART 2: Check for missing await ===
                // Skip if we already awaited
                if (argument.type === 'AwaitExpression') {
                    return;
                }

                // Only check function calls
                if (argument.type !== 'CallExpression') {
                    return;
                }

                // Get the function name
                let funcName = '';
                if (argument.callee.type === 'Identifier') {
                    funcName = argument.callee.name;
                } else if (argument.callee.type === 'MemberExpression') {
                    if (argument.callee.object.type === 'Identifier') {
                        funcName = `${argument.callee.object.name}.${argument.callee.property.name}`;
                    }
                }

                if (!funcName) {return;}

                // Check if function is async or returns Promise
                const isDefinedAsync = asyncFunctions.has(funcName);
                const returnsPromise = promiseReturningFunctions.has(funcName);

                if (isDefinedAsync || returnsPromise) {
                    context.report({
                        node: argument,
                        messageId: 'missingAwait',
                        data: { funcName },
                        fix(fixer) {
                            const sourceCode = context.getSourceCode();
                            const callText = sourceCode.getText(argument);
                            return fixer.replaceText(argument, `await ${callText}`);
                        }
                    });
                }
            }
        };
    }
};
