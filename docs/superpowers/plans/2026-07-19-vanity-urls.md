# Vanity URLs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auto-generated 6-character short-code URLs to boards so they can be shared via Slack; links expire after 24 hours, the board persists.

**Architecture:** Two nullable columns (`short_code`, `link_expires_at`) are added to the existing `boards` table. A new `links.py` module handles code generation and expiry logic. Three new FastAPI endpoints expose link generation and resolution; the existing board list endpoint is extended to return link status. The React frontend gains React Router, a per-board link UI in the board list, and a public board view at `/b/:code`.

**Tech Stack:** Python 3 / FastAPI / SQLAlchemy / PostgreSQL (backend); React 18 / TypeScript / React Router v6 / Axios (frontend); pytest + httpx (backend tests).

## Global Constraints

- Short codes: 6 characters, `[a-z0-9]`, randomly generated, collision-checked against all existing codes.
- Link lifetime: controlled by `LINK_EXPIRY_SECONDS` env var, default `86400` (24 h). Read at **call time** — not import time — so tests can override it with `monkeypatch.setenv`.
- Expiry check: `link_expires_at > now(UTC)`. Expired rows are never cleared; presence check always re-evaluates the timestamp.
- Code collision retry: up to 5 attempts, then `RuntimeError`.
- 404 message for expired/unknown code: `"Link expired or not found"` — same message for both to avoid leaking board existence.
- All datetime values stored and compared as UTC.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `server/requirements.txt` | Add pytest, httpx |
| Create | `server/conftest.py` | Shared test fixtures (in-memory SQLite DB + TestClient) |
| Modify | `server/database.py` | Add `short_code` and `link_expires_at` columns to `Board` |
| Create | `server/links.py` | `generate_short_code(db)`, `create_board_link(board, db)`, `is_link_active(board)` |
| Create | `server/test_links.py` | Unit tests for link generation logic |
| Modify | `server/main.py` | New endpoints, updated `BoardResponse` Pydantic model |
| Create | `server/test_api.py` | Integration tests for all new endpoints |
| Modify | `client/package.json` | Add `react-router-dom` |
| Modify | `client/src/main.tsx` | Wrap app in `BrowserRouter` |
| Modify | `client/src/App.tsx` | Add `Routes`/`Route`, `handleGenerateLink` callback |
| Modify | `client/src/services/api.ts` | Update `Board` interface; add `generateLink`, `getBoardByCode` |
| Modify | `client/src/components/BoardList.tsx` | Link status display + "Generate link" button per card |
| Create | `client/src/components/BoardView.tsx` | Public board view loaded by short code |

---

### Task 1: Backend test infrastructure

**Files:**
- Modify: `server/requirements.txt`
- Create: `server/conftest.py`

**Interfaces:**
- Produces: `client` fixture (FastAPI `TestClient` with in-memory SQLite) and `db` fixture (SQLAlchemy `Session`) for all subsequent test files.

- [ ] **Step 1: Add test dependencies to requirements.txt**

Replace the contents of `server/requirements.txt` with:

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
sqlalchemy==2.0.36
psycopg[binary]==3.2.10
python-dotenv==1.0.1
pytest==8.3.4
httpx==0.27.2
```

- [ ] **Step 2: Create server/conftest.py**

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 3: Install dependencies and verify pytest runs**

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest --collect-only
```

Expected: `no tests ran` (no test files yet) — confirm no import errors.

- [ ] **Step 4: Commit**

```bash
git add server/requirements.txt server/conftest.py
git commit -m "test: add backend test infrastructure (pytest + httpx + conftest)"
```

---

### Task 2: Database model changes

**Files:**
- Modify: `server/database.py`

**Interfaces:**
- Produces: `Board.short_code` (`String(6)`, unique, nullable), `Board.link_expires_at` (`DateTime(timezone=True)`, nullable).

- [ ] **Step 1: Update the Board model in server/database.py**

Replace the `Board` class with:

```python
from sqlalchemy import create_engine, Column, Integer, String, DateTime
```

(Add `DateTime` to the existing import.)

Replace the `Board` class body:

```python
class Board(Base):
    """Board model representing a retrospective board."""

    __tablename__ = "boards"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False, index=True)
    short_code = Column(String(6), unique=True, nullable=True, index=True)
    link_expires_at = Column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 2: Reset the local database so the new columns are created**

The existing `init_db()` uses `create_all`, which only creates missing **tables** — it won't add columns to an existing table. Drop and recreate the database container:

```bash
# From project root
podman-compose down -v   # -v removes the named volume with PostgreSQL data
podman-compose up -d
```

If using docker-compose:
```bash
docker-compose down -v
docker-compose up -d
```

- [ ] **Step 3: Verify the server still starts**

```bash
cd server
source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Expected: `Database initialized successfully` with no errors. Check `GET http://localhost:8000/api/boards` returns `[]`. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add server/database.py
git commit -m "feat: add short_code and link_expires_at columns to Board model"
```

---

### Task 3: Link generation module + unit tests

**Files:**
- Create: `server/links.py`
- Create: `server/test_links.py`

**Interfaces:**
- Consumes: `Board` model from `database.py`; `Session` from SQLAlchemy.
- Produces:
  - `generate_short_code(db: Session) -> str` — returns a unique 6-char code or raises `RuntimeError`.
  - `create_board_link(board: Board, db: Session) -> None` — sets `short_code` and `link_expires_at` on `board` and commits.
  - `is_link_active(board: Board) -> bool` — returns `True` if `short_code` is set and `link_expires_at` is in the future.

- [ ] **Step 1: Write the failing unit tests in server/test_links.py**

```python
import os
import time
from datetime import datetime, timezone
from unittest.mock import patch

import pytest

from database import Board
from links import create_board_link, generate_short_code, is_link_active


def test_generate_short_code_returns_six_chars(db):
    code = generate_short_code(db)
    assert len(code) == 6
    assert code.isalnum()
    assert code == code.lower()


def test_generate_short_code_avoids_collision(db):
    board = Board(name="existing", short_code="aaaaaa")
    db.add(board)
    db.commit()

    codes = list("aaaaaa")
    call_count = {"n": 0}
    original_choices = __import__("random").choices

    def mock_choices(population, k):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return codes  # collide first time
        return original_choices(population, k=k)

    with patch("links.random.choices", side_effect=mock_choices):
        code = generate_short_code(db)

    assert code != "aaaaaa"
    assert call_count["n"] == 2


def test_generate_short_code_raises_after_max_retries(db):
    board = Board(name="blocker", short_code="aaaaaa")
    db.add(board)
    db.commit()

    with patch("links.random.choices", return_value=list("aaaaaa")):
        with pytest.raises(RuntimeError, match="Failed to generate unique short code"):
            generate_short_code(db)


def test_create_board_link_sets_fields(db, monkeypatch):
    monkeypatch.setenv("LINK_EXPIRY_SECONDS", "3600")
    board = Board(name="My Board")
    db.add(board)
    db.commit()

    before = datetime.now(timezone.utc)
    create_board_link(board, db)
    after = datetime.now(timezone.utc)

    assert board.short_code is not None
    assert len(board.short_code) == 6
    assert board.link_expires_at is not None
    expires = board.link_expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    assert before.timestamp() + 3590 < expires.timestamp() < after.timestamp() + 3610


def test_is_link_active_true_for_active_link(db, monkeypatch):
    monkeypatch.setenv("LINK_EXPIRY_SECONDS", "3600")
    board = Board(name="Active")
    db.add(board)
    db.commit()
    create_board_link(board, db)
    assert is_link_active(board) is True


def test_is_link_active_false_for_expired_link(db, monkeypatch):
    monkeypatch.setenv("LINK_EXPIRY_SECONDS", "1")
    board = Board(name="Expiring")
    db.add(board)
    db.commit()
    create_board_link(board, db)
    time.sleep(2)
    assert is_link_active(board) is False


def test_is_link_active_false_when_no_link(db):
    board = Board(name="No link")
    db.add(board)
    db.commit()
    assert is_link_active(board) is False
```

- [ ] **Step 2: Run the tests — verify they all fail**

```bash
cd server && pytest test_links.py -v
```

Expected: `ImportError: No module named 'links'` or similar — confirms tests are wired up.

- [ ] **Step 3: Implement server/links.py**

```python
import os
import random
import string
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from database import Board

CHARS = string.ascii_lowercase + string.digits
CODE_LENGTH = 6
MAX_RETRIES = 5


def generate_short_code(db: Session) -> str:
    for _ in range(MAX_RETRIES):
        code = "".join(random.choices(CHARS, k=CODE_LENGTH))
        if not db.query(Board).filter(Board.short_code == code).first():
            return code
    raise RuntimeError("Failed to generate unique short code after 5 attempts")


def create_board_link(board: Board, db: Session) -> None:
    expiry_seconds = int(os.getenv("LINK_EXPIRY_SECONDS", "86400"))
    board.short_code = generate_short_code(db)
    board.link_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expiry_seconds)
    db.commit()
    db.refresh(board)


def is_link_active(board: Board) -> bool:
    if not board.short_code or board.link_expires_at is None:
        return False
    expires = board.link_expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return expires > datetime.now(timezone.utc)
```

- [ ] **Step 4: Run the tests — verify they all pass**

```bash
cd server && pytest test_links.py -v
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/links.py server/test_links.py
git commit -m "feat: add link generation module with expiry logic and unit tests"
```

---

### Task 4: API endpoints + integration tests

**Files:**
- Modify: `server/main.py`
- Create: `server/test_api.py`

**Interfaces:**
- Consumes: `create_board_link`, `is_link_active` from `links.py`; `Board` from `database.py`.
- Produces:
  - `POST /api/boards/{board_id}/link` → `LinkResponse { short_code: str, link_expires_at: datetime }`
  - `GET /b/{code}` → `BoardResponse` or 404
  - `GET /api/boards/{board_id}` → `BoardResponse` or 404
  - `GET /api/boards` → `List[BoardResponse]` (extended with `short_code`, `link_expires_at`)

- [ ] **Step 1: Write the failing integration tests in server/test_api.py**

```python
import time

import pytest


def test_create_board_returns_null_link_fields(client):
    response = client.post("/api/boards", json={"name": "Test"})
    assert response.status_code == 201
    data = response.json()
    assert data["short_code"] is None
    assert data["link_expires_at"] is None


def test_generate_link_sets_short_code(client):
    board_id = client.post("/api/boards", json={"name": "Test"}).json()["id"]
    response = client.post(f"/api/boards/{board_id}/link")
    assert response.status_code == 200
    data = response.json()
    assert len(data["short_code"]) == 6
    assert data["link_expires_at"] is not None


def test_generate_link_for_missing_board_returns_404(client):
    response = client.post("/api/boards/9999/link")
    assert response.status_code == 404


def test_get_board_by_code_returns_board(client):
    board_id = client.post("/api/boards", json={"name": "Shared"}).json()["id"]
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
    board_id = client.post("/api/boards", json={"name": "Expiring"}).json()["id"]
    code = client.post(f"/api/boards/{board_id}/link").json()["short_code"]
    time.sleep(2)
    response = client.get(f"/b/{code}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Link expired or not found"


def test_regenerate_link_old_code_stops_working(client):
    board_id = client.post("/api/boards", json={"name": "Regen"}).json()["id"]
    old_code = client.post(f"/api/boards/{board_id}/link").json()["short_code"]
    new_code = client.post(f"/api/boards/{board_id}/link").json()["short_code"]
    assert client.get(f"/b/{new_code}").status_code == 200
    # Old code no longer matches the board's current short_code
    assert client.get(f"/b/{old_code}").status_code == 404


def test_get_board_by_id(client):
    board_id = client.post("/api/boards", json={"name": "Direct"}).json()["id"]
    response = client.get(f"/api/boards/{board_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Direct"


def test_get_board_by_id_missing_returns_404(client):
    response = client.get("/api/boards/9999")
    assert response.status_code == 404


def test_list_boards_includes_link_fields(client):
    board_id = client.post("/api/boards", json={"name": "Listed"}).json()["id"]
    client.post(f"/api/boards/{board_id}/link")
    boards = client.get("/api/boards").json()
    listed = next(b for b in boards if b["id"] == board_id)
    assert "short_code" in listed
    assert "link_expires_at" in listed
    assert listed["short_code"] is not None
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd server && pytest test_api.py -v
```

Expected: failures on missing endpoints / missing response fields.

- [ ] **Step 3: Update server/main.py**

Replace the full file contents:

```python
"""Main FastAPI application."""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, init_db, Board
from links import create_board_link, is_link_active

app = FastAPI(title="Terra API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BoardCreate(BaseModel):
    name: str


class BoardResponse(BaseModel):
    id: int
    name: str
    short_code: Optional[str] = None
    link_expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LinkResponse(BaseModel):
    short_code: str
    link_expires_at: datetime


@app.on_event("startup")
def startup_event():
    init_db()
    print("Database initialized successfully")


@app.get("/")
def root():
    return {"message": "Terra API"}


@app.get("/api/boards", response_model=List[BoardResponse])
def get_boards(db: Session = Depends(get_db)):
    return db.query(Board).all()


@app.post("/api/boards", response_model=BoardResponse, status_code=201)
def create_board(board: BoardCreate, db: Session = Depends(get_db)):
    db_board = Board(name=board.name)
    db.add(db_board)
    db.commit()
    db.refresh(db_board)
    return db_board


@app.get("/api/boards/{board_id}", response_model=BoardResponse)
def get_board(board_id: int, db: Session = Depends(get_db)):
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


@app.post("/api/boards/{board_id}/link", response_model=LinkResponse)
def generate_link(board_id: int, db: Session = Depends(get_db)):
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    create_board_link(board, db)
    return {"short_code": board.short_code, "link_expires_at": board.link_expires_at}


@app.get("/b/{code}", response_model=BoardResponse)
def get_board_by_code(code: str, db: Session = Depends(get_db)):
    board = db.query(Board).filter(Board.short_code == code).first()
    if not board:
        raise HTTPException(status_code=404, detail="Link expired or not found")
    expires = board.link_expires_at
    if expires is None:
        raise HTTPException(status_code=404, detail="Link expired or not found")
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= datetime.now(timezone.utc):
        raise HTTPException(status_code=404, detail="Link expired or not found")
    return board
```

- [ ] **Step 4: Run all backend tests — verify they all pass**

```bash
cd server && pytest -v
```

Expected: all tests in `test_links.py` and `test_api.py` pass.

- [ ] **Step 5: Commit**

```bash
git add server/main.py server/test_api.py
git commit -m "feat: add link generation and resolution API endpoints"
```

---

### Task 5: Frontend routing setup

**Files:**
- Modify: `client/package.json` (install step)
- Modify: `client/src/main.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Produces: React Router `BrowserRouter` wrapping the app; `/` route renders the existing board list UI; `/b/:code` route placeholder renders `<div>Board view coming soon</div>` (replaced in Task 7).

- [ ] **Step 1: Install react-router-dom**

```bash
cd client && npm install react-router-dom@6
```

Expected: `react-router-dom` appears in `dependencies` in `package.json`.

- [ ] **Step 2: Wrap the app in BrowserRouter in client/src/main.tsx**

Replace the file contents:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
```

- [ ] **Step 3: Add Routes to client/src/App.tsx**

Replace the return statement in `App` with:

```tsx
import { Routes, Route } from 'react-router-dom';
```

(Add to imports at the top of the file.)

Replace the `return (...)` block:

```tsx
  return (
    <Routes>
      <Route
        path="/"
        element={
          <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
            <header style={{ padding: '20px', backgroundColor: '#007bff', color: 'white' }}>
              <h1 style={{ margin: 0 }}>Terra - Team Retrospective Board</h1>
            </header>
            {error && (
              <div
                style={{
                  padding: '10px',
                  margin: '20px',
                  backgroundColor: '#f8d7da',
                  color: '#721c24',
                  border: '1px solid #f5c6cb',
                  borderRadius: '4px',
                }}
              >
                {error}
              </div>
            )}
            <BoardForm onSubmit={handleCreateBoard} loading={loading} />
            <BoardList boards={boards} onGenerateLink={() => {}} />
          </div>
        }
      />
      <Route path="/b/:code" element={<div style={{ padding: '40px', fontFamily: 'Arial, sans-serif' }}>Board view coming soon</div>} />
    </Routes>
  );
```

- [ ] **Step 4: Update BoardList props signature temporarily**

`BoardList` currently doesn't accept `onGenerateLink`. Add the prop as optional so TypeScript doesn't block compilation:

In `client/src/components/BoardList.tsx`, change the interface:

```tsx
interface BoardListProps {
  boards: Board[];
  onGenerateLink: (boardId: number) => void;
}
```

And update the function signature:

```tsx
export default function BoardList({ boards, onGenerateLink }: BoardListProps) {
```

(`onGenerateLink` is wired up fully in Task 6.)

- [ ] **Step 5: Start the dev server and verify routing works**

```bash
cd client && npm run dev
```

Open `http://localhost:5173` — board list renders. Navigate to `http://localhost:5173/b/test` — shows "Board view coming soon". No TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/main.tsx client/src/App.tsx client/src/components/BoardList.tsx client/package.json client/package-lock.json
git commit -m "feat: add React Router with / and /b/:code routes"
```

---

### Task 6: Frontend API layer + BoardList link UI

**Files:**
- Modify: `client/src/services/api.ts`
- Modify: `client/src/components/BoardList.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `POST /api/boards/{id}/link` → `{ short_code, link_expires_at }`; `GET /b/{code}` → `Board`.
- Produces:
  - `boardApi.generateLink(boardId: number): Promise<LinkResponse>`
  - `boardApi.getBoardByCode(code: string): Promise<Board>`
  - `BoardList` shows share URL + copy button when link is active; "Generate link" button otherwise.

- [ ] **Step 1: Update client/src/services/api.ts**

Replace the file contents:

```typescript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

export interface Board {
  id: number;
  name: string;
  short_code: string | null;
  link_expires_at: string | null;
}

export interface CreateBoardRequest {
  name: string;
}

export interface LinkResponse {
  short_code: string;
  link_expires_at: string;
}

export const boardApi = {
  getBoards: async (): Promise<Board[]> => {
    const response = await api.get<Board[]>('/api/boards');
    return response.data;
  },

  createBoard: async (board: CreateBoardRequest): Promise<Board> => {
    const response = await api.post<Board>('/api/boards', board);
    return response.data;
  },

  generateLink: async (boardId: number): Promise<LinkResponse> => {
    const response = await api.post<LinkResponse>(`/api/boards/${boardId}/link`);
    return response.data;
  },

  getBoardByCode: async (code: string): Promise<Board> => {
    const response = await api.get<Board>(`/b/${code}`);
    return response.data;
  },
};

export default api;
```

- [ ] **Step 2: Update client/src/App.tsx to wire up handleGenerateLink**

Add the following function inside `App`, after `handleCreateBoard`:

```tsx
  const handleGenerateLink = async (boardId: number) => {
    try {
      const linkData = await boardApi.generateLink(boardId);
      setBoards(boards.map((b) =>
        b.id === boardId
          ? { ...b, short_code: linkData.short_code, link_expires_at: linkData.link_expires_at }
          : b
      ));
    } catch (err) {
      console.error('Error generating link:', err);
      setError('Failed to generate link. Please try again.');
    }
  };
```

Replace the `onGenerateLink={() => {}}` prop in the Route with:

```tsx
<BoardList boards={boards} onGenerateLink={handleGenerateLink} />
```

- [ ] **Step 3: Update client/src/components/BoardList.tsx**

Replace the file contents:

```tsx
import { Board } from '../services/api';

interface BoardListProps {
  boards: Board[];
  onGenerateLink: (boardId: number) => void;
}

function isLinkActive(board: Board): boolean {
  if (!board.short_code || !board.link_expires_at) return false;
  return new Date(board.link_expires_at) > new Date();
}

export default function BoardList({ boards, onGenerateLink }: BoardListProps) {
  if (boards.length === 0) {
    return (
      <div style={{ padding: '20px', color: '#666' }}>
        No boards yet. Create your first board above!
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Boards</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {boards.map((board) => {
          const active = isLinkActive(board);
          const shareUrl = active
            ? `${window.location.origin}/b/${board.short_code}`
            : null;

          return (
            <li
              key={board.id}
              style={{
                padding: '10px',
                margin: '10px 0',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: '#f9f9f9',
              }}
            >
              <strong>{board.name}</strong>
              <span style={{ marginLeft: '10px', color: '#666', fontSize: '0.9em' }}>
                (ID: {board.id})
              </span>
              <div style={{ marginTop: '8px' }}>
                {active && shareUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85em', color: '#555', fontFamily: 'monospace' }}>
                      {shareUrl}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(shareUrl)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.8em',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Copy
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onGenerateLink(board.id)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.8em',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Generate link
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Manual test — board list link UI**

With the dev server running (`npm run dev` in `client/`) and the backend running (`uvicorn main:app --reload` in `server/`):

1. Open `http://localhost:5173`.
2. Create a board — the card shows a "Generate link" button.
3. Click "Generate link" — the card now shows a `localhost:5173/b/<code>` URL and a "Copy" button.
4. Click "Copy" — URL is in clipboard.
5. Refresh the page — the board reloads; if the link is still valid (<24 h) the URL shows; otherwise the button reappears.

- [ ] **Step 5: Commit**

```bash
git add client/src/services/api.ts client/src/components/BoardList.tsx client/src/App.tsx
git commit -m "feat: add link generation UI to board list"
```

---

### Task 7: Frontend BoardView

**Files:**
- Create: `client/src/components/BoardView.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `boardApi.getBoardByCode(code)` from `api.ts`; `useParams` from React Router.
- Produces: `/b/:code` renders the board name on success; "This link has expired or is invalid" on 404.

- [ ] **Step 1: Create client/src/components/BoardView.tsx**

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { boardApi, Board } from '../services/api';

export default function BoardView() {
  const { code } = useParams<{ code: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!code) return;
    boardApi
      .getBoardByCode(code)
      .then(setBoard)
      .catch(() => setExpired(true));
  }, [code]);

  if (expired) {
    return (
      <div
        style={{
          maxWidth: '800px',
          margin: '60px auto',
          padding: '40px',
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
        }}
      >
        <h2>This link has expired or is invalid</h2>
        <p style={{ color: '#666' }}>Ask your team to generate a new link for this board.</p>
      </div>
    );
  }

  if (!board) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px', fontFamily: 'Arial, sans-serif' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ padding: '20px', backgroundColor: '#007bff', color: 'white' }}>
        <h1 style={{ margin: 0 }}>{board.name}</h1>
      </header>
      <div style={{ padding: '20px', color: '#444' }}>
        <p>You are viewing this board via a shared link.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire BoardView into the /b/:code route in client/src/App.tsx**

Add the import at the top of `App.tsx`:

```tsx
import BoardView from './components/BoardView';
```

Replace the `/b/:code` route element:

```tsx
<Route path="/b/:code" element={<BoardView />} />
```

- [ ] **Step 3: Manual test — BoardView**

With both servers running:

1. Generate a link from the board list.
2. Open the copied URL in a new tab — the board name renders in a blue header.
3. Navigate to `http://localhost:5173/b/xxxxxx` (invalid code) — "This link has expired or is invalid" message renders.
4. Open the browser console — no unhandled errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/BoardView.tsx client/src/App.tsx
git commit -m "feat: add public board view for shared links"
```

---

## Done

All backend tests pass (`cd server && pytest -v`). Frontend manually verified: link generation in board list, copy to clipboard, public board view on valid code, expired-link message on invalid/expired code.
