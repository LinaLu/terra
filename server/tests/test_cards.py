from tests.conftest import create_board


def test_create_card(client):
    board_id = create_board(client, name="Retro", columns=["Good"])["id"]
    token = client.post(f"/api/boards/{board_id}/join", json={"name": "Alice"}).json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    good_column_id = client.get(f"/api/boards/{board_id}/columns").json()[0]["id"]

    response = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": good_column_id, "content": "CI is fast"},
        headers=headers,
    )
    assert response.status_code == 201
    card = response.json()
    assert card["column_id"] == good_column_id
    assert card["content"] == "CI is fast"
    assert card["author"] == "Alice"
    assert "id" in card
    assert "created_at" in card


def test_get_cards_returns_cards_ordered_by_created_at(client):
    board_id = create_board(client, name="Retro", columns=["Good"])["id"]
    token_a = client.post(f"/api/boards/{board_id}/join", json={"name": "A"}).json()["session_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    token_b = client.post(f"/api/boards/{board_id}/join", json={"name": "B"}).json()["session_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    col_id = client.get(f"/api/boards/{board_id}/columns").json()[0]["id"]

    client.post(f"/api/boards/{board_id}/cards", json={"column_id": col_id, "content": "First"}, headers=headers_a)
    client.post(f"/api/boards/{board_id}/cards", json={"column_id": col_id, "content": "Second"}, headers=headers_b)

    response = client.get(f"/api/boards/{board_id}/cards")
    assert response.status_code == 200
    cards = response.json()
    assert len(cards) == 2
    assert cards[0]["content"] == "First"
    assert cards[1]["content"] == "Second"


def test_get_cards_only_returns_cards_for_requested_board(client):
    board_a = create_board(client, name="Board A", columns=["Good"])["id"]
    board_b = create_board(client, name="Board B", columns=["Good"])["id"]

    token_a = client.post(f"/api/boards/{board_a}/join", json={"name": "X"}).json()["session_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    col_a = client.get(f"/api/boards/{board_a}/columns").json()[0]["id"]

    client.post(f"/api/boards/{board_a}/cards", json={"column_id": col_a, "content": "Only in A"}, headers=headers_a)

    response = client.get(f"/api/boards/{board_b}/cards")
    assert response.status_code == 200
    cards_b = response.json()
    assert cards_b == []


def test_create_card_unknown_board_returns_404(client):
    board_id = create_board(client, name="Retro")["id"]
    token = client.post(f"/api/boards/{board_id}/join", json={"name": "Alice"}).json()["session_token"]

    response = client.post(
        "/api/boards/99999/cards",
        json={"column_id": 1, "content": "x"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 401


def test_create_card_column_from_different_board_returns_404(client):
    board_a = create_board(client, name="Board A", columns=["Good"])["id"]
    board_b = create_board(client, name="Board B", columns=["Good"])["id"]

    token_a = client.post(f"/api/boards/{board_a}/join", json={"name": "Alice"}).json()["session_token"]
    token_b = client.post(f"/api/boards/{board_b}/join", json={"name": "Bob"}).json()["session_token"]

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    col_a_id = client.get(f"/api/boards/{board_a}/columns").json()[0]["id"]

    response = client.post(
        f"/api/boards/{board_b}/cards",
        json={"column_id": col_a_id, "content": "sneaky"},
        headers=headers_b,
    )
    assert response.status_code == 404


def test_get_cards_unknown_board_returns_404(client):
    response = client.get("/api/boards/99999/cards")
    assert response.status_code == 404


def test_upvote_card(client):
    board_id = create_board(client, name="Retro", columns=["Good"])["id"]
    token = client.post(f"/api/boards/{board_id}/join", json={"name": "Alice"}).json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    col_id = client.get(f"/api/boards/{board_id}/columns").json()[0]["id"]

    card = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": col_id, "content": "Upvote me"},
        headers=headers,
    ).json()
    assert card["votes"] == 0

    upvoted = client.post(f"/api/boards/{board_id}/cards/{card['id']}/upvote")
    assert upvoted.status_code == 200
    assert upvoted.json()["votes"] == 1

    upvoted_again = client.post(f"/api/boards/{board_id}/cards/{card['id']}/upvote")
    assert upvoted_again.status_code == 200
    assert upvoted_again.json()["votes"] == 2


def test_downvote_card(client):
    board_id = create_board(client, name="Retro", columns=["Good"])["id"]
    token = client.post(f"/api/boards/{board_id}/join", json={"name": "Bob"}).json()["session_token"]
    headers = {"Authorization": f"Bearer {token}"}

    col_id = client.get(f"/api/boards/{board_id}/columns").json()[0]["id"]

    card = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": col_id, "content": "Downvote me"},
        headers=headers,
    ).json()
    assert card["votes"] == 0

    downvoted = client.post(f"/api/boards/{board_id}/cards/{card['id']}/downvote")
    assert downvoted.status_code == 200
    assert downvoted.json()["votes"] == 0

    upvoted = client.post(f"/api/boards/{board_id}/cards/{card['id']}/upvote")
    assert upvoted.status_code == 200
    assert upvoted.json()["votes"] == 1

    downvoted_again = client.post(f"/api/boards/{board_id}/cards/{card['id']}/downvote")
    assert downvoted_again.status_code == 200
    assert downvoted_again.json()["votes"] == 0


def test_downvote_card_not_found(client):
    board_id = create_board(client, name="Retro")["id"]
    response = client.post(f"/api/boards/{board_id}/cards/99999/downvote")
    assert response.status_code == 404
