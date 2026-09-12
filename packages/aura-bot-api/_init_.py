"""
aura-bot — Official AURA Bot API client for Python.

Example:
    from aura_bot import Bot

    bot = Bot("YOUR_API_TOKEN")

    @bot.message()
    def handle(msg):
        bot.send_message(msg["chat"]["id"], "Hi!")

    bot.run()
"""

from .client import Bot, AsyncBot
from .exceptions import AuraBotError, NetworkError, InvalidTokenError
from .types import BotProfile, Message, Update

__version__ = "0.1.0"
__author__ = "AURA Team"
__license__ = "MIT"

__all__ = [
    "Bot",
    "AsyncBot",
    "AuraBotError",
    "NetworkError",
    "InvalidTokenError",
    "BotProfile",
    "Message",
    "Update",
    "__version__",
]
