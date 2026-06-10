# Fix: Chat Reuse Issue with OpenAI SDK

## Problem

When using the OpenAI SDK client to call `this.openai.chat.completions.create`, the service was reusing the same chat instead of creating new chats, even when passing a random `x-chat-id` header.

## Root Causes

### 1. Incorrect Header Passing in OpenAI SDK

The OpenAI SDK does **NOT** support custom headers via the `headers` option. You must use `extraHeaders` instead:

**❌ Wrong:**
```javascript
await openai.chat.completions.create({
    messages: [...],
    model: 'qwen-max-latest'
}, {
    headers: { 'x-chat-id': 'random-value' }  // This doesn't work!
});
```

**✅ Correct:**
```javascript
await openai.chat.completions.create({
    messages: [...],
    model: 'qwen-max-latest'
}, {
    extraHeaders: { 'x-chat-id': 'random-value' }  // This works!
});
```

### 2. Logic Bug in Force New Chat Handling

When `FORCE_NEW_CHAT_PER_REQUEST=true` AND an explicit `chatId` was provided, the code would:
- Generate a new internal chatId (good)
- BUT still try to restore from session mapping (bad)

This caused the service to reuse existing Qwen chats even when a new chat was requested.

## What Was Fixed

### 1. Updated Chat Creation Logic (`src/api/routes.js`)

Modified the force new chat logic to properly handle explicit chat IDs:

**Before:**
```javascript
if (forceNewChat && !explicitChatId && !isMeta) {
    effectiveChatId = `chat_${crypto.randomBytes(8).toString('hex')}`;
    effectiveParentId = null;
}
```

**After:**
```javascript
if (forceNewChat && !isMeta) {
    if (!explicitChatId) {
        // Generate new chatId
        effectiveChatId = `chat_${crypto.randomBytes(8).toString('hex')}`;
        effectiveParentId = null;
    } else {
        // Use provided chatId but reset parent (no session restore)
        effectiveParentId = null;
    }
}
```

This ensures that when you provide a custom `x-chat-id`, it won't restore from previous sessions.

### 2. Updated Documentation

- Fixed all examples to use `extraHeaders` instead of `headers`
- Added alternative method using `chat_id` in body
- Added warning about OpenAI SDK header requirements

### 3. Created Test Examples

New file: `examples/openai-sdk/new-chat-example.js` demonstrating:
- Using `extraHeaders` with `x-chat-id`
- Using `chat_id` in request body
- Using `newChat: true` flag
- Using `FORCE_NEW_CHAT_PER_REQUEST` mode

## How to Use

### Method 1: Use `extraHeaders` (Recommended for OpenAI SDK)

```javascript
const randomChatId = `conv-${Date.now()}-${Math.random()}`;

const response = await this.openai.chat.completions.create({
    messages: [{ role: 'user', content: 'Hello!' }],
    model: 'qwen-max-latest'
}, {
    extraHeaders: {
        'x-chat-id': randomChatId
    }
});
```

### Method 2: Use `chat_id` in Body

```javascript
const response = await this.openai.chat.completions.create({
    messages: [{ role: 'user', content: 'Hello!' }],
    model: 'qwen-max-latest',
    chat_id: `conv-${Date.now()}`
});
```

### Method 3: Use `newChat` Flag

```javascript
const response = await this.openai.chat.completions.create({
    messages: [{ role: 'user', content: 'Hello!' }],
    model: 'qwen-max-latest',
    newChat: true
});
```

### Method 4: Enable Global Force New Chat Mode

Add to `.env`:
```env
FORCE_NEW_CHAT_PER_REQUEST=true
```

Then every request automatically creates a new chat (like standard OpenAI API behavior).

## About Qwen Chat Memory

Qwen recently introduced a "Chat Memory" feature for the web interface that automatically persists context across conversations. However:

1. This feature is **NOT** enabled via the API when using `chat_mode: 'normal'`
2. Your service explicitly uses `chat_mode: 'normal'` in both chat creation and message sending
3. The memory feature is a web UI enhancement, not an API parameter

If you're still seeing context leakage after applying these fixes, it's likely due to:
- Reusing the same `chatId` (either intentionally or via session restore)
- Not passing unique identifiers for each new conversation

## Testing

Run the test example:
```bash
node examples/openai-sdk/new-chat-example.js
```

This will verify that:
- Each request with a unique `x-chat-id` creates a separate chat
- Chats with the same `x-chat-id` share context (as expected)
- The `newChat` flag works correctly
- `FORCE_NEW_CHAT_PER_REQUEST` mode works when enabled

## Files Modified

1. `src/api/routes.js` - Fixed force new chat logic (both `/chat/completions` and `/v1/chat/completions` endpoints)
2. `docs/CONVERSATION_MANAGEMENT.md` - Updated examples with correct OpenAI SDK usage
3. `examples/openai-sdk/new-chat-example.js` - New comprehensive test file

## Verification Checklist

- [x] Force new chat logic updated for both API endpoints
- [x] Documentation corrected with `extraHeaders` usage
- [x] Test example created
- [x] No breaking changes to existing functionality
- [x] Backward compatible with existing clients
