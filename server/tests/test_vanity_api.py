import time

import pytest

from tests.conftest import create_board


def test_create_board_returns_null_link_fields(client):
    data = create_board(client, name="Test")
    assert data["short_code"] is None
    assert data["link_expires_at"] is None


def test_generate_link_sets_short_code(client):
    board_id = create_board(client, name="Test")["id"]
    response = client.post(f"/api/boards/{board_id}/link")
    assert response.status_code == 200
    data = response.json()
    assert len(data["short_code"]) == 6
    assert data["link_expires_at"] is not None


def test_generate_link_for_missing_board_returns_404(client):
    response = client.post("/api/boards/9999/link")
    assert response.status_code == 404


def test_get_board_by_code_returns_board(client):
    board_id = create_board(client, name="Shared")["id"]
    code = client.post(f"/api/boards/{board_id}/link").json()["short_code"]
    response = client.get(f"/b/{code}")
    assert response.status_code == 200
    assert response.json()["name"] == "Shared"


def test_get_board_by_unknown_code_returns_404(client):
    response = client.get("/b/xxxxxx")
    assert response.status_code == 404
    assert response.json()["detail"] == "Link expired or not found"


def test_get_board_by_expired_code_returns_404(client, monkeypatch):
    monkeypatch.setenv("LINK_EXPIRY_SECONDS", "1")
    board_id = create_board(client, name="Expiring")["id"]
    code = client.post(f"/api/boards/{board_id}/link").json()["short_code"]
    time.sleep(2)
    response = client.get(f"/b/{code}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Link expired or not found"


def test_regenerate_link_old_code_stops_working(client):
    board_id = create_board(client, name="Regen")["id"]
    old_code = client.post(f"/api/boards/{board_id}/link").json()["short_code"]
    new_code = client.post(f"/api/boards/{board_id}/link").json()["short_code"]
    assert client.get(f"/b/{new_code}").status_code == 200
    assert client.get(f"/b/{old_code}").status_code == 404


def test_list_boards_includes_link_fields(client):
    board_id = create_board(client, name="Listed")["id"]
    client.post(f"/api/boards/{board_id}/link")
    boards = client.get("/api/boards").json()
    listed = next(b for b in boards if b["id"] == board_id)
    assert "short_code" in listed
    assert "link_expires_at" in listed
    assert listed["short_code"] is not None
