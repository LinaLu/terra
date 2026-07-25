import os
import random
import string
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from database import Board

CHARS = string.ascii_lowercase + string.digits
CODE_LENGTH = 6
MAX_RETRIES = 5


def generate_short_code(db: Session) -> str:
    for _ in range(MAX_RETRIES):
        code = "".join(random.choices(CHARS, k=CODE_LENGTH))
        if not db.query(Board).filter(Board.short_code == code).first():
            return code
    raise RuntimeError("Failed to generate unique short code after 5 attempts")


def create_board_link(board: Board, db: Session) -> None:
    expiry_seconds = int(os.getenv("LINK_EXPIRY_SECONDS", "86400"))
    board.short_code = generate_short_code(db)
    board.link_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expiry_seconds)
    db.commit()
    db.refresh(board)


def is_link_active(board: Board) -> bool:
    if not board.short_code or board.link_expires_at is None:
        return False
    expires = board.link_expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return expires > datetime.now(timezone.utc)
