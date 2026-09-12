# aura-bot-api

> Official AURA Bot API client for Node.js — build bots for the AURA chat platform.

[![npm version](https://img.shields.io/npm/v/aura-bot-api.svg)](https://www.npmjs.com/package/aura-bot-api)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Install

```bash
npm install aura-bot-api
```

## Quick Start

1. Open **@BotCreator** in the AURA app → `/newbot` → copy your token.
2. Create `bot.js`:

```js
const AuraBot = require('aura-bot-api');

const bot = new AuraBot('YOUR_TOKEN_HERE');

bot.on('message', async (msg) => {
  await bot.sendMessage(msg.chat.id, `Echo: ${msg.text}`);
});

bot.on('error', (e) => console.error('Bot error:', e.message));

bot.start();
console.log('Bot running...');
```

3. Run it: `node bot.js`
4. Open your bot in AURA → tap **Start** → send a message.

## API Reference

### `new AuraBot(token, options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseURL` | string | AURA API | Custom API base URL |
| `pollInterval` | number | `1000` | Polling interval (ms) |
| `debug` | boolean | `false` | Log every API call |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getMe()` | `Promise<BotProfile>` | Get bot profile |
| `sendMessage(chatId, text, opts?)` | `Promise<{message_id}>` | Send text |
| `sendPhoto(chatId, photoUrl, opts?)` | `Promise<{message_id}>` | Send photo |
| `setWebhook(url)` | `Promise<boolean>` | Register webhook |
| `deleteWebhook()` | `Promise<boolean>` | Remove webhook |
| `getUpdates(offset?)` | `Promise<Update[]>` | Manual fetch |
| `start(opts?)` | `this` | Begin polling |
| `stop()` | `this` | Stop polling |

### Events

| Event | Payload | When |
|-------|---------|------|
| `message` | `Message` | New message |
| `update` | `Update` | Any update |
| `error` | `Error` | API or handler error |

## Examples

```js
// Commands bot
const commands = {
  '/start': (msg) => bot.sendMessage(msg.chat.id, 'Welcome!'),
  '/help': (msg) => bot.sendMessage(msg.chat.id, 'Try /ping'),
  '/ping': (msg) => bot.sendMessage(msg.chat.id, 'Pong 🏓')
};

bot.on('message', (msg) => {
  const cmd = (msg.text || '').split(' ')[0];
  if (commands[cmd]) commands[cmd](msg);
  else bot.sendMessage(msg.chat.id, 'Unknown command. Try /help');
});
```

## Versioning

Follows [Semantic Versioning](https://semver.org):

- **MAJOR** — breaking changes
- **MINOR** — new features (backwards compatible)
- **PATCH** — bug fixes

Current: **0.1.0**

## License

MIT © AURA
