def test_create_card(client):
    board_id = client.post("/api/boards", json={"name": "Retro"}).json()["id"]
    columns = client.get(f"/api/boards/{board_id}/columns").json()
    good_column_id = next(c["id"] for c in columns if c["name"] == "Good")

    response = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": good_column_id, "content": "CI is fast", "author": "Alice"},
    )
    assert response.status_code == 201
    card = response.json()
    assert card["column_id"] == good_column_id
    assert card["content"] == "CI is fast"
    assert card["author"] == "Alice"
    assert "id" in card
    assert "created_at" in card


def test_get_cards_returns_cards_ordered_by_created_at(client):
    board_id = client.post("/api/boards", json={"name": "Retro"}).json()["id"]
    columns = client.get(f"/api/boards/{board_id}/columns").json()
    col_id = columns[0]["id"]

    client.post(f"/api/boards/{board_id}/cards", json={"column_id": col_id, "content": "First", "author": "A"})
    client.post(f"/api/boards/{board_id}/cards", json={"column_id": col_id, "content": "Second", "author": "B"})

    response = client.get(f"/api/boards/{board_id}/cards")
    assert response.status_code == 200
    cards = response.json()
    assert len(cards) == 2
    assert cards[0]["content"] == "First"
    assert cards[1]["content"] == "Second"


def test_get_cards_only_returns_cards_for_requested_board(client):
    board_a = client.post("/api/boards", json={"name": "Board A"}).json()["id"]
    board_b = client.post("/api/boards", json={"name": "Board B"}).json()["id"]
    col_a = client.get(f"/api/boards/{board_a}/columns").json()[0]["id"]

    client.post(f"/api/boards/{board_a}/cards", json={"column_id": col_a, "content": "Only in A", "author": "X"})

    response = client.get(f"/api/boards/{board_b}/cards")
    assert response.status_code == 200
    cards_b = response.json()
    assert cards_b == []


def test_create_card_unknown_board_returns_404(client):
    response = client.post(
        "/api/boards/99999/cards",
        json={"column_id": 1, "content": "x", "author": "y"},
    )
    assert response.status_code == 404


def test_create_card_column_from_different_board_returns_404(client):
    board_a = client.post("/api/boards", json={"name": "Board A"}).json()["id"]
    board_b = client.post("/api/boards", json={"name": "Board B"}).json()["id"]
    col_a_id = client.get(f"/api/boards/{board_a}/columns").json()[0]["id"]

    response = client.post(
        f"/api/boards/{board_b}/cards",
        json={"column_id": col_a_id, "content": "sneaky", "author": "hacker"},
    )
    assert response.status_code == 404


def test_get_cards_unknown_board_returns_404(client):
    response = client.get("/api/boards/99999/cards")
    assert response.status_code == 404
