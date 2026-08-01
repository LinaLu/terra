from database import BoardColumn
from tests.conftest import create_template


def test_create_board_copies_template_columns(client, db):
    template_id = create_template(client, columns=["Went Well", "To Improve"])
    response = client.post("/api/boards", json={"name": "Sprint 42", "template_id": template_id})
    assert response.status_code == 201
    board_id = response.json()["id"]

    columns = (
        db.query(BoardColumn)
        .filter_by(board_id=board_id)
        .order_by(BoardColumn.position)
        .all()
    )
    assert [c.name for c in columns] == ["Went Well", "To Improve"]


def test_create_board_copies_template_column_color_and_icon(client):
    template = client.post(
        "/api/templates",
        json={"name": "Basic Retro", "columns": [{"name": "Went Well", "color": "#86efac", "icon": "smile"}]},
    ).json()
    board_id = client.post("/api/boards", json={"name": "Sprint 42", "template_id": template["id"]}).json()["id"]

    columns = client.get(f"/api/boards/{board_id}/columns").json()
    assert columns[0]["color"] == "#86efac"
    assert columns[0]["icon"] == "smile"


def test_create_board_missing_template_returns_404(client):
    response = client.post("/api/boards", json={"name": "Sprint 42", "template_id": 9999})
    assert response.status_code == 404


def test_get_board_by_id(client):
    template_id = create_template(client)
    post = client.post("/api/boards", json={"name": "My Board", "template_id": template_id})
    board_id = post.json()["id"]

    response = client.get(f"/api/boards/{board_id}")
    assert response.status_code == 200
    assert response.json() == {
        "id": board_id,
        "name": "My Board",
        "short_code": None,
        "link_expires_at": None,
        "admin_id": None,
    }


def test_get_board_not_found(client):
    response = client.get("/api/boards/99999")
    assert response.status_code == 404
