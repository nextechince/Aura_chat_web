"""AURA Bot client implementation."""

import time
import logging
from typing import Callable, Optional, Dict, Any, List

import requests

from .exceptions import AuraBotError, NetworkError, InvalidTokenError

logger = logging.getLogger("aura_bot")

DEFAULT_BASE = "https://aura-chat-web-green.vercel.app/api/bot"
VERSION = "0.1.0"


class Bot:
    """
    Synchronous AURA bot client.

    Args:
        token: Bot token from @BotCreator.
        base_url: API base URL (override for self-hosted).
        timeout: HTTP timeout in seconds.
        debug: Enable debug logging.
    """

    def __init__(
        self,
        token: str,
        base_url: str = DEFAULT_BASE,
        timeout: int = 30,
        debug: bool = False,
    ):
        if not token or not isinstance(token, str):
            raise InvalidTokenError("Bot token required")

        self.token = token
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.debug = debug
        self.offset = 0
        self._handlers: Dict[str, Callable] = {}
        self._running = False
        self.version = VERSION

        if debug:
            logging.basicConfig(level=logging.DEBUG)

    # ═══════════════════════════════════════════════════════════
    # LOW-LEVEL
    # ═══════════════════════════════════════════════════════════
    def _url(self, action: str) -> str:
        return f"{self.base_url}/{self.token}/{action}"

    def _call(self, action: str, params: Optional[dict] = None, is_post: bool = False) -> Any:
        url = self._url(action)
        headers = {"User-Agent": f"aura-bot/{VERSION}"}

        if self.debug:
            logger.debug("%s %s %s", "POST" if is_post else "GET", url, params or {})

        try:
            if is_post:
                headers["Content-Type"] = "application/json"
                r = requests.post(url, json=params or {}, headers=headers, timeout=self.timeout)
            else:
                r = requests.get(url, params=params or {}, headers=headers, timeout=self.timeout)
        except requests.RequestException as e:
            raise NetworkError(f"Network error: {e}")

        try:
            body = r.json()
        except ValueError:
            raise AuraBotError(f"Invalid JSON (HTTP {r.status_code})", status=r.status_code)

        if not body.get("ok"):
            msg = body.get("error", f"HTTP {r.status_code}")
            if r.status_code == 401:
                raise InvalidTokenError(msg)
            raise AuraBotError(msg, status=r.status_code)

        return body.get("result")

    # ═══════════════════════════════════════════════════════════
    # API METHODS
    # ═══════════════════════════════════════════════════════════
    def get_me(self) -> dict:
        """Get this bot's profile."""
        return self._call("getMe")

    def send_message(self, chat_id: str, text: str, parse_mode: str = "Markdown") -> dict:
        """Send a text message."""
        if not chat_id:
            raise AuraBotError("chat_id required")
        if text is None:
            raise AuraBotError("text required")
        return self._call("sendMessage", {
            "chat_id": chat_id,
            "text": str(text),
            "parse_mode": parse_mode,
        }, is_post=True)

    def send_photo(self, chat_id: str, photo_url: str, caption: str = "") -> dict:
        """Send a photo by URL."""
        if not chat_id or not photo_url:
            raise AuraBotError("chat_id and photo_url required")
        return self._call("sendPhoto", {
            "chat_id": chat_id,
            "photo_url": photo_url,
            "caption": caption,
        }, is_post=True)

    def set_webhook(self, url: str) -> bool:
        """Register a webhook URL."""
        if not url or not url.startswith("https://"):
            raise AuraBotError("HTTPS url required")
        return self._call("setWebhook", {"url": url}, is_post=True)

    def delete_webhook(self) -> bool:
        """Remove webhook (return to polling)."""
        return self._call("deleteWebhook", {}, is_post=True)

    def get_updates(self, offset: Optional[int] = None) -> List[dict]:
        """Manually fetch updates (rarely needed)."""
        return self._call("getUpdates", {
            "offset": offset if offset is not None else self.offset,
        })

    # ═══════════════════════════════════════════════════════════
    # HANDLERS
    # ═══════════════════════════════════════════════════════════
    def message(self, command: Optional[str] = None):
        """
        Decorator — register a message handler.

        @bot.message()               → fires for every message
        @bot.message("/start")       → fires for messages starting with /start
        """
        def decorator(fn: Callable):
            key = command or "__any__"
            self._handlers[key] = fn
            return fn
        return decorator

    # ═══════════════════════════════════════════════════════════
    # POLLING
    # ═══════════════════════════════════════════════════════════
    def run(self, poll_interval: float = 1.0) -> None:
        """Start polling. Blocks until stop() is called or Ctrl+C."""
        self._running = True
        logger.info("AURA bot running — polling every %ss", poll_interval)

        while self._running:
            try:
                updates = self.get_updates(self.offset)
                for u in updates:
                    msg = u.get("message")
                    if not msg:
                        continue
                    self.offset = max(self.offset, msg.get("date", 0))
                    self._dispatch(msg)
            except AuraBotError as e:
                logger.warning("Bot error: %s", e)
            except KeyboardInterrupt:
                break
            time.sleep(poll_interval)

    def _dispatch(self, msg: dict) -> None:
        text = (msg.get("text") or "").strip()

        # Command-specific handlers first
        for cmd, fn in self._handlers.items():
            if cmd == "__any__":
                continue
            if text.startswith(cmd):
                try:
                    fn(msg)
                except Exception as e:
                    logger.exception("Handler error for %s: %s", cmd, e)
                return

        # Fallback
        if "__any__" in self._handlers:
            try:
                self._handlers["__any__"](msg)
            except Exception as e:
                logger.exception("Handler error: %s", e)

    def stop(self) -> None:
        """Stop the polling loop."""
        self._running = False


class AsyncBot(Bot):
    """Async variant — reserved for v0.4.0."""
    pass
