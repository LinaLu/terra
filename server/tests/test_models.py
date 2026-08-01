from datetime import datetime, timezone
from database import Board, BoardColumn, Card, User, Template, TemplateColumn, seed_default_templates
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

    user = User(board_id=board.id, name="Alice", role="admin", session_token="token-123")
    db.add(user)
    db.flush()

    col = BoardColumn(board_id=board.id, name="Good", position=1)
    db.add(col)
    db.flush()

    card = Card(
        column_id=col.id,
        content="Deployments are fast",
        author_id=user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(card)
    db.commit()

    fetched = db.query(Card).filter_by(id=card.id).first()
    assert fetched.content == "Deployments are fast"
    assert fetched.author == "Alice"
    assert fetched.column_id == col.id
    db.close()


def test_template_model():
    db = TestingSessionLocal()
    template = Template(name="Basic Retro")
    db.add(template)
    db.flush()
    col = TemplateColumn(template_id=template.id, name="Went Well", position=1)
    db.add(col)
    db.commit()

    fetched = db.query(Template).filter_by(id=template.id).first()
    assert fetched.name == "Basic Retro"
    assert len(fetched.columns) == 1
    assert fetched.columns[0].name == "Went Well"
    db.close()


def test_template_columns_ordered_by_position():
    db = TestingSessionLocal()
    template = Template(name="Start Stop Continue")
    db.add(template)
    db.flush()
    db.add(TemplateColumn(template_id=template.id, name="Continue", position=3))
    db.add(TemplateColumn(template_id=template.id, name="Start", position=1))
    db.add(TemplateColumn(template_id=template.id, name="Stop", position=2))
    db.commit()

    fetched = db.query(Template).filter_by(id=template.id).first()
    assert [c.name for c in fetched.columns] == ["Start", "Stop", "Continue"]
    db.close()


def test_seed_default_templates_creates_three_templates():
    db = TestingSessionLocal()
    seed_default_templates(db)

    templates = db.query(Template).all()
    assert len(templates) == 3
    names = {t.name for t in templates}
    assert names == {"Basic Retro", "Start Stop Continue", "4Ls"}

    basic_retro = next(t for t in templates if t.name == "Basic Retro")
    assert [c.name for c in basic_retro.columns] == ["Went Well", "To Improve", "Action Items"]
    db.close()


def test_seed_default_templates_is_idempotent():
    db = TestingSessionLocal()
    seed_default_templates(db)
    seed_default_templates(db)

    assert db.query(Template).count() == 3
    db.close()
