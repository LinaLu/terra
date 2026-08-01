def test_get_columns_returns_empty_list_for_new_board(client):
    post = client.post("/api/boards", json={"name": "Sprint 1"})
    board_id = post.json()["id"]

    response = client.get(f"/api/boards/{board_id}/columns")
    assert response.status_code == 200
    columns = response.json()
    assert len(columns) == 0


def test_get_columns_unknown_board_returns_404(client):
    response = client.get("/api/boards/99999/columns")
    assert response.status_code == 404
