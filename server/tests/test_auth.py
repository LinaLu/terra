import pytest

from tests.conftest import create_board


def test_join_board_first_user_is_admin(client):
    board = create_board(client, name="Retro 1")
    board_id = board["id"]

    res = client.post(f"/api/boards/{board_id}/join", json={"name": "Alice"})
    assert res.status_code == 200
    data = res.json()
    assert "session_token" in data
    assert data["user"]["name"] == "Alice"
    assert data["user"]["role"] == "admin"
    assert data["user"]["board_id"] == board_id


def test_join_board_second_user_is_regular_user(client):
    board_id = create_board(client, name="Retro 1")["id"]

    alice = client.post(f"/api/boards/{board_id}/join", json={"name": "Alice"}).json()
    assert alice["user"]["role"] == "admin"

    bob = client.post(f"/api/boards/{board_id}/join", json={"name": "Bob"}).json()
    assert bob["user"]["role"] == "user"


def test_join_board_duplicate_name_rejected(client):
    board_id = create_board(client, name="Retro 1")["id"]

    res1 = client.post(f"/api/boards/{board_id}/join", json={"name": "Alice"})
    assert res1.status_code == 200

    res2 = client.post(f"/api/boards/{board_id}/join", json={"name": "Alice"})
    assert res2.status_code == 400
    assert "already taken" in res2.json()["detail"].lower()


def test_join_board_same_name_different_board_allowed(client):
    board1_id = create_board(client, name="Retro 1")["id"]
    board2_id = create_board(client, name="Retro 2")["id"]

    res1 = client.post(f"/api/boards/{board1_id}/join", json={"name": "Alice"})
    assert res1.status_code == 200

    res2 = client.post(f"/api/boards/{board2_id}/join", json={"name": "Alice"})
    assert res2.status_code == 200


def test_get_me(client):
    board_id = create_board(client, name="Retro")["id"]

    join_data = client.post(f"/api/boards/{board_id}/join", json={"name": "Alice"}).json()
    token = join_data["session_token"]

    # Valid token
    me_res = client.get(
        f"/api/boards/{board_id}/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["name"] == "Alice"
    assert me_res.json()["role"] == "admin"

    # Missing token
    invalid_res = client.get(f"/api/boards/{board_id}/me")
    assert invalid_res.status_code == 401

    # Bad token
    bad_token_res = client.get(
        f"/api/boards/{board_id}/me",
        headers={"Authorization": "Bearer fake-token-12345"},
    )
    assert bad_token_res.status_code == 401


def test_card_creation_author_from_session(client):
    board_id = create_board(client, name="Retro", columns=["Good"])["id"]

    bob = client.post(f"/api/boards/{board_id}/join", json={"name": "Bob"}).json()
    user_token = bob["session_token"]

    col_id = client.get(f"/api/boards/{board_id}/columns").json()[0]["id"]

    unauth_res = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": col_id, "content": "Hello"},
    )
    assert unauth_res.status_code == 401

    bob_card_res = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": col_id, "content": "Great teamwork!"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert bob_card_res.status_code == 201
    card_data = bob_card_res.json()
    assert card_data["author"] == "Bob"
    assert card_data["content"] == "Great teamwork!"
