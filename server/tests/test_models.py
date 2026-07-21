from datetime import datetime, timezone
from database import Board, BoardColumn, Card
from tests.conftest import TestingSessionLocal


def test_board_column_model():
    db = TestingSessionLocal()
    board = Board(name="Retro 1")
    db.add(board)
    db.flush()
    col = BoardColumn(board_id=board.id, name="Good", position=1)
    db.add(col)
    db.commit()

    fetched = db.query(BoardColumn).filter_by(id=col.id).first()
    assert fetched.name == "Good"
    assert fetched.position == 1
    assert fetched.board_id == board.id
    db.close()


def test_card_model():
    db = TestingSessionLocal()
    board = Board(name="Retro 1")
    db.add(board)
    db.flush()
    col = BoardColumn(board_id=board.id, name="Good", position=1)
    db.add(col)
    db.flush()
    card = Card(
        column_id=col.id,
        content="Deployments are fast",
        author="Alice",
        created_at=datetime.now(timezone.utc),
    )
    db.add(card)
    db.commit()

    fetched = db.query(Card).filter_by(id=card.id).first()
    assert fetched.content == "Deployments are fast"
    assert fetched.author == "Alice"
    assert fetched.column_id == col.id
    db.close()
