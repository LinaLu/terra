import pytest


def test_join_board_first_user_is_admin(client):
    board = client.post("/api/boards", json={"name": "Retro 1"}).json()
    board_id = board["id"]

    res = client.post(f"/api/boards/{board_id}/join", json={"name": "Alice"})
    assert res.status_code == 200
    data = res.json()
    assert "session_token" in data
    assert data["user"]["name"] == "Alice"
    assert data["user"]["role"] == "admin"
    assert data["user"]["board_id"] == board_id


def test_join_board_second_user_is_regular_user(client):
    board_id = client.post("/api/boards", json={"name": "Retro 1"}).json()["id"]

    alice = client.post(f"/api/boards/{board_id}/join", json={"name": "Alice"}).json()
    assert alice["user"]["role"] == "admin"

    bob = client.post(f"/api/boards/{board_id}/join", json={"name": "Bob"}).json()
    assert bob["user"]["role"] == "user"


def test_join_board_duplicate_name_rejected(client):
    board_id = client.post("/api/boards", json={"name": "Retro 1"}).json()["id"]

    res1 = client.post(f"/api/boards/{board_id}/join", json={"name": "Alice"})
    assert res1.status_code == 200

    res2 = client.post(f"/api/boards/{board_id}/join", json={"name": "Alice"})
    assert res2.status_code == 400
    assert "already taken" in res2.json()["detail"].lower()


def test_join_board_same_name_different_board_allowed(client):
    board1_id = client.post("/api/boards", json={"name": "Retro 1"}).json()["id"]
    board2_id = client.post("/api/boards", json={"name": "Retro 2"}).json()["id"]

    res1 = client.post(f"/api/boards/{board1_id}/join", json={"name": "Alice"})
    assert res1.status_code == 200

    res2 = client.post(f"/api/boards/{board2_id}/join", json={"name": "Alice"})
    assert res2.status_code == 200


def test_get_me(client):
    board_id = client.post("/api/boards", json={"name": "Retro"}).json()["id"]

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


def test_column_admin_authorization(client):
    board_id = client.post("/api/boards", json={"name": "Retro"}).json()["id"]

    alice = client.post(f"/api/boards/{board_id}/join", json={"name": "Alice"}).json()
    admin_token = alice["session_token"]

    bob = client.post(f"/api/boards/{board_id}/join", json={"name": "Bob"}).json()
    user_token = bob["session_token"]

    # 1. Non-admin attempts to create column -> 403
    col_res_user = client.post(
        f"/api/boards/{board_id}/columns",
        json={"name": "Good"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert col_res_user.status_code == 403

    # 2. Admin creates column -> 201
    col_res_admin = client.post(
        f"/api/boards/{board_id}/columns",
        json={"name": "Good"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert col_res_admin.status_code == 201
    col_id = col_res_admin.json()["id"]

    # 3. Non-admin attempts to update column -> 403
    update_res_user = client.put(
        f"/api/boards/{board_id}/columns/{col_id}",
        json={"name": "Went Well"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert update_res_user.status_code == 403

    # 4. Admin updates column -> 200
    update_res_admin = client.put(
        f"/api/boards/{board_id}/columns/{col_id}",
        json={"name": "Went Well"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert update_res_admin.status_code == 200
    assert update_res_admin.json()["name"] == "Went Well"

    # 5. Non-admin attempts to delete column -> 403
    del_res_user = client.delete(
        f"/api/boards/{board_id}/columns/{col_id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert del_res_user.status_code == 403

    # 6. Admin deletes column -> 204
    del_res_admin = client.delete(
        f"/api/boards/{board_id}/columns/{col_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert del_res_admin.status_code == 204


def test_card_creation_author_from_session(client):
    board_id = client.post("/api/boards", json={"name": "Retro"}).json()["id"]

    alice = client.post(f"/api/boards/{board_id}/join", json={"name": "Alice"}).json()
    admin_token = alice["session_token"]

    bob = client.post(f"/api/boards/{board_id}/join", json={"name": "Bob"}).json()
    user_token = bob["session_token"]

    # Admin creates column
    col_id = client.post(
        f"/api/boards/{board_id}/columns",
        json={"name": "Good"},
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()["id"]

    # Unauthenticated card creation -> 401
    unauth_res = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": col_id, "content": "Hello"},
    )
    assert unauth_res.status_code == 401

    # Bob (regular user) creates card -> 201, author = Bob
    bob_card_res = client.post(
        f"/api/boards/{board_id}/cards",
        json={"column_id": col_id, "content": "Great teamwork!"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert bob_card_res.status_code == 201
    card_data = bob_card_res.json()
    assert card_data["author"] == "Bob"
    assert card_data["content"] == "Great teamwork!"
