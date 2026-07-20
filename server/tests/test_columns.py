def test_get_columns_returns_three_default_columns(client):
    post = client.post("/api/boards", json={"name": "Sprint 1"})
    board_id = post.json()["id"]

    response = client.get(f"/api/boards/{board_id}/columns")
    assert response.status_code == 200
    columns = response.json()
    assert len(columns) == 3
    assert [c["name"] for c in columns] == ["Good", "Bad", "Actions"]
    assert [c["position"] for c in columns] == [1, 2, 3]
    for col in columns:
        assert col["board_id"] == board_id
        assert "id" in col


def test_get_columns_unknown_board_returns_404(client):
    response = client.get("/api/boards/99999/columns")
    assert response.status_code == 404
