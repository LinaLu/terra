from database import BoardColumn


def test_create_board_seeds_three_columns(client, db):
    response = client.post("/api/boards", json={"name": "Sprint 42"})
    assert response.status_code == 201
    board_id = response.json()["id"]

    columns = (
        db.query(BoardColumn)
        .filter_by(board_id=board_id)
        .order_by(BoardColumn.position)
        .all()
    )

    assert len(columns) == 3
    assert columns[0].name == "Good"
    assert columns[0].position == 1
    assert columns[1].name == "Bad"
    assert columns[1].position == 2
    assert columns[2].name == "Actions"
    assert columns[2].position == 3


def test_get_board_by_id(client):
    post = client.post("/api/boards", json={"name": "My Board"})
    board_id = post.json()["id"]

    response = client.get(f"/api/boards/{board_id}")
    assert response.status_code == 200
    assert response.json() == {"id": board_id, "name": "My Board"}


def test_get_board_not_found(client):
    response = client.get("/api/boards/99999")
    assert response.status_code == 404
