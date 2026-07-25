import time
from datetime import datetime, timezone
from unittest.mock import patch

import pytest

from database import Board
from links import create_board_link, generate_short_code, is_link_active


def test_generate_short_code_returns_six_chars(db):
    code = generate_short_code(db)
    assert len(code) == 6
    assert code.isalnum()
    assert code == code.lower()


def test_generate_short_code_avoids_collision(db):
    board = Board(name="existing", short_code="aaaaaa")
    db.add(board)
    db.commit()

    codes = list("aaaaaa")
    call_count = {"n": 0}
    original_choices = __import__("random").choices

    def mock_choices(population, k):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return codes
        return original_choices(population, k=k)

    with patch("links.random.choices", side_effect=mock_choices):
        code = generate_short_code(db)

    assert code != "aaaaaa"
    assert call_count["n"] == 2


def test_generate_short_code_raises_after_max_retries(db):
    board = Board(name="blocker", short_code="aaaaaa")
    db.add(board)
    db.commit()

    with patch("links.random.choices", return_value=list("aaaaaa")):
        with pytest.raises(RuntimeError, match="Failed to generate unique short code"):
            generate_short_code(db)


def test_create_board_link_sets_fields(db, monkeypatch):
    monkeypatch.setenv("LINK_EXPIRY_SECONDS", "3600")
    board = Board(name="My Board")
    db.add(board)
    db.commit()

    before = datetime.now(timezone.utc)
    create_board_link(board, db)
    after = datetime.now(timezone.utc)

    assert board.short_code is not None
    assert len(board.short_code) == 6
    assert board.link_expires_at is not None
    expires = board.link_expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    assert before.timestamp() + 3590 < expires.timestamp() < after.timestamp() + 3610


def test_is_link_active_true_for_active_link(db, monkeypatch):
    monkeypatch.setenv("LINK_EXPIRY_SECONDS", "3600")
    board = Board(name="Active")
    db.add(board)
    db.commit()
    create_board_link(board, db)
    assert is_link_active(board) is True


def test_is_link_active_false_for_expired_link(db, monkeypatch):
    monkeypatch.setenv("LINK_EXPIRY_SECONDS", "1")
    board = Board(name="Expiring")
    db.add(board)
    db.commit()
    create_board_link(board, db)
    time.sleep(2)
    assert is_link_active(board) is False


def test_is_link_active_false_when_no_link(db):
    board = Board(name="No link")
    db.add(board)
    db.commit()
    assert is_link_active(board) is False
