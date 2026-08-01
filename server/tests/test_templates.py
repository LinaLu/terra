def test_create_template(client):
    response = client.post(
        "/api/templates",
        json={"name": "Basic Retro", "columns": [{"name": "Went Well"}, {"name": "To Improve"}, {"name": "Action Items"}]},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Basic Retro"
    assert [c["name"] for c in data["columns"]] == ["Went Well", "To Improve", "Action Items"]
    assert [c["position"] for c in data["columns"]] == [1, 2, 3]


def test_create_template_with_color_and_icon(client):
    response = client.post(
        "/api/templates",
        json={
            "name": "Basic Retro",
            "columns": [
                {"name": "Went Well", "color": "#86efac", "icon": "smile"},
                {"name": "To Improve", "color": "#fca5a5", "icon": "frown"},
            ],
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert [c["color"] for c in data["columns"]] == ["#86efac", "#fca5a5"]
    assert [c["icon"] for c in data["columns"]] == ["smile", "frown"]


def test_create_template_color_and_icon_are_optional(client):
    response = client.post(
        "/api/templates",
        json={"name": "Basic Retro", "columns": [{"name": "Went Well"}]},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["columns"][0]["color"] is None
    assert data["columns"][0]["icon"] is None


def test_create_template_empty_name_rejected(client):
    response = client.post("/api/templates", json={"name": "  ", "columns": [{"name": "A"}]})
    assert response.status_code == 422


def test_create_template_no_columns_rejected(client):
    response = client.post("/api/templates", json={"name": "Empty", "columns": []})
    assert response.status_code == 422


def test_create_template_blank_columns_filtered_and_rejected_if_all_blank(client):
    response = client.post("/api/templates", json={"name": "Blank", "columns": [{"name": "  "}, {"name": ""}]})
    assert response.status_code == 422


def test_list_templates(client):
    client.post("/api/templates", json={"name": "T1", "columns": [{"name": "A"}]})
    client.post("/api/templates", json={"name": "T2", "columns": [{"name": "B"}, {"name": "C"}]})

    response = client.get("/api/templates")
    assert response.status_code == 200
    names = {t["name"] for t in response.json()}
    assert {"T1", "T2"}.issubset(names)


def test_update_template_replaces_columns(client):
    template_id = client.post("/api/templates", json={"name": "T1", "columns": [{"name": "A"}, {"name": "B"}]}).json()["id"]

    response = client.put(
        f"/api/templates/{template_id}",
        json={"name": "T1 renamed", "columns": [{"name": "X"}, {"name": "Y"}, {"name": "Z"}]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "T1 renamed"
    assert [c["name"] for c in data["columns"]] == ["X", "Y", "Z"]


def test_update_template_does_not_affect_existing_boards(client, db):
    from database import BoardColumn

    template_id = client.post("/api/templates", json={"name": "T1", "columns": [{"name": "A"}, {"name": "B"}]}).json()["id"]
    board_id = client.post("/api/boards", json={"name": "Board 1", "template_id": template_id}).json()["id"]

    client.put(f"/api/templates/{template_id}", json={"name": "T1", "columns": [{"name": "X"}]})

    columns = db.query(BoardColumn).filter_by(board_id=board_id).order_by(BoardColumn.position).all()
    assert [c.name for c in columns] == ["A", "B"]


def test_update_missing_template_returns_404(client):
    response = client.put("/api/templates/9999", json={"name": "X", "columns": [{"name": "A"}]})
    assert response.status_code == 404


def test_delete_template(client):
    template_id = client.post("/api/templates", json={"name": "T1", "columns": [{"name": "A"}]}).json()["id"]

    response = client.delete(f"/api/templates/{template_id}")
    assert response.status_code == 204
    assert client.get("/api/templates").json() == [
        t for t in client.get("/api/templates").json() if t["id"] != template_id
    ]


def test_delete_template_does_not_affect_existing_boards(client, db):
    from database import BoardColumn

    template_id = client.post("/api/templates", json={"name": "T1", "columns": [{"name": "A"}, {"name": "B"}]}).json()["id"]
    board_id = client.post("/api/boards", json={"name": "Board 1", "template_id": template_id}).json()["id"]

    client.delete(f"/api/templates/{template_id}")

    columns = db.query(BoardColumn).filter_by(board_id=board_id).order_by(BoardColumn.position).all()
    assert [c.name for c in columns] == ["A", "B"]


def test_delete_missing_template_returns_404(client):
    response = client.delete("/api/templates/9999")
    assert response.status_code == 404
