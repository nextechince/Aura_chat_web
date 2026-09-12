"""Exception classes for aura-bot."""


class AuraBotError(Exception):
    """Base exception for AURA Bot API errors."""

    def __init__(self, message: str, status: int = 0):
        super().__init__(message)
        self.status = status


class NetworkError(AuraBotError):
    """Raised when the network request fails."""


class InvalidTokenError(AuraBotError):
    """Raised when the bot token is invalid or revoked."""
