"""Type hints (dataclasses) for aura-bot."""

from dataclasses import dataclass
from typing import Optional


@dataclass
class BotProfile:
    id: str
    username: str
    name: str
    about: str
    avatar_url: Optional[str]
    commands: list


@dataclass
class Message:
    message_id: str
    from_id: str
    from_name: str
    chat_id: str
    text: Optional[str]
    media_type: Optional[str]
    media_url: Optional[str]
    date: int


@dataclass
class Update:
    update_id: str
    message: Message
