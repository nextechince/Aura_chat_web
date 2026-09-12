# aura-bot

> Official AURA Bot API client for Python — build bots for the AURA chat platform.

[![PyPI version](https://img.shields.io/pypi/v/aura-bot.svg)](https://pypi.org/project/aura-bot/)
[![Python versions](https://img.shields.io/pypi/pyversions/aura-bot.svg)](https://pypi.org/project/aura-bot/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Install

```bash
pip install aura-bot
```

## Quick Start

1. Open **@BotCreator** in the AURA app → `/newbot` → copy your token.
2. Create `bot.py`:

```python
from aura_bot import Bot

bot = Bot("YOUR_TOKEN_HERE")

@bot.message()
def handle(msg):
    bot.send_message(msg["chat"]["id"], f"Echo: {msg['text']}")

if __name__ == "__main__":
    bot.run()
```

3. Run it: `python bot.py`
4. Open your bot in AURA → tap **Start** → send a message.

## API Reference

### `Bot(token, base_url=..., timeout=30, debug=False)`

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `get_me()` | dict | Bot profile |
| `send_message(chat_id, text, parse_mode="Markdown")` | dict | Send text |
| `send_photo(chat_id, photo_url, caption="")` | dict | Send photo |
| `set_webhook(url)` | bool | Register webhook |
| `delete_webhook()` | bool | Remove webhook |
| `get_updates(offset=None)` | list | Manual fetch |
| `run(poll_interval=1.0)` | None | Start polling (blocking) |
| `stop()` | None | Stop polling |

### Decorators

```python
@bot.message()            # every message
@bot.message("/start")    # messages starting with /start
```

## Examples

```python
# Commands bot
@bot.message("/start")
def cmd_start(msg):
    bot.send_message(msg["chat"]["id"], "👋 Welcome!")

@bot.message("/ping")
def cmd_ping(msg):
    bot.send_message(msg["chat"]["id"], "🏓 Pong!")

@bot.message()
def fallback(msg):
    bot.send_message(msg["chat"]["id"], "Unknown command. Try /help")
```

## Versioning

Follows [Semantic Versioning](https://semver.org):

- **MAJOR** — breaking changes
- **MINOR** — new features (backwards compatible)
- **PATCH** — bug fixes

Current: **0.1.0**

## License

MIT © AURA
