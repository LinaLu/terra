from database import BoardColumn


def test_create_board_has_no_columns(client, db):
    response = client.post("/api/boards", json={"name": "Sprint 42"})
    assert response.status_code == 201
    board_id = response.json()["id"]

    columns = (
        db.query(BoardColumn)
        .filter_by(board_id=board_id)
        .order_by(BoardColumn.position)
        .all()
    )

    assert len(columns) == 0


def test_get_board_by_id(client):
    post = client.post("/api/boards", json={"name": "My Board"})
    board_id = post.json()["id"]

    response = client.get(f"/api/boards/{board_id}")
    assert response.status_code == 200
    assert response.json() == {
        "id": board_id,
        "name": "My Board",
        "short_code": None,
        "link_expires_at": None,
    }


def test_get_board_not_found(client):
    response = client.get("/api/boards/99999")
    assert response.status_code == 404
