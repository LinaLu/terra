from tests.conftest import create_board


def test_get_columns_returns_board_columns_from_template(client):
    board_id = create_board(client, name="Sprint 1", columns=["Good"])["id"]

    response = client.get(f"/api/boards/{board_id}/columns")
    assert response.status_code == 200
    columns = response.json()
    assert [c["name"] for c in columns] == ["Good"]


def test_get_columns_unknown_board_returns_404(client):
    response = client.get("/api/boards/99999/columns")
    assert response.status_code == 404


def test_column_mutation_endpoints_are_gone(client):
    board_id = create_board(client, name="Sprint 1", columns=["Good"])["id"]
    col_id = client.get(f"/api/boards/{board_id}/columns").json()[0]["id"]
    assert client.post(f"/api/boards/{board_id}/columns", json={"name": "X"}).status_code == 405
    assert client.put(f"/api/boards/{board_id}/columns/{col_id}", json={"name": "X"}).status_code == 404
    assert client.delete(f"/api/boards/{board_id}/columns/{col_id}").status_code == 404
