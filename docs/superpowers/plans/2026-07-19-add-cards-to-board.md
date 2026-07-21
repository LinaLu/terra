# Add Cards to Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a board detail page with three dynamically-loaded columns (Good, Bad, Actions) where users can add cards with content, author, and a server-assigned timestamp.

**Architecture:** Columns are stored in a `columns` table and seeded automatically on board creation; cards reference a column by foreign key. The frontend adds react-router-dom for routing, a `BoardPage` that owns all state, a `Column` component per database column, and an inline-expanding `CardForm` per column.

**Tech Stack:** Python 3 / FastAPI / SQLAlchemy / PostgreSQL (backend); React 18 / TypeScript / Vite / react-router-dom / axios (frontend); pytest for backend tests.

## Global Constraints

- Backend: Python 3, FastAPI 0.115.0, SQLAlchemy 2.0.36, psycopg 3.2.10
- Frontend: React 18, TypeScript 5, Vite 6, axios 1.x
- No card editing or deletion in this iteration
- Columns are read-only in this iteration (seeded on board creation, cannot be renamed or reordered)
- Author is a free-text field — no authentication
- `created_at` is always set server-side; clients never send it

---

### Task 1: Backend test infrastructure

**Files:**
- Modify: `server/requirements.txt`
- Create: `server/tests/__init__.py`
- Create: `server/tests/conftest.py`

**Interfaces:**
- Produces: `client` pytest fixture (FastAPI `TestClient` with SQLite in-memory DB and mocked startup) available to all test files in `server/tests/`

- [ ] **Step 1: Add test dependencies to requirements.txt**

Replace `server/requirements.txt` with:

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
sqlalchemy==2.0.36
psycopg[binary]==3.2.10
python-dotenv==1.0.1
pytest==8.3.3
httpx==0.28.1
```

- [ ] **Step 2: Create `server/tests/__init__.py`**

Create `server/tests/__init__.py` as an empty file.

- [ ] **Step 3: Write conftest.py**

Create `server/tests/conftest.py`:

```python
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from main import app

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with patch("main.init_db"):
        with TestClient(app) as c:
            yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 4: Write a smoke test**

Create `server/tests/test_smoke.py`:

```python
def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Terra API"}
```

- [ ] **Step 5: Install test dependencies and run the smoke test**

```bash
cd server && pip install -r requirements.txt
pytest tests/test_smoke.py -v
```

Expected:
```
PASSED tests/test_smoke.py::test_root
1 passed
```

- [ ] **Step 6: Commit**

```bash
git add server/requirements.txt server/tests/
git commit -m "test: add backend test infrastructure with SQLite in-memory DB"
```

---

### Task 2: BoardColumn and Card database models

**Files:**
- Modify: `server/database.py`
- Create: `server/tests/test_models.py`

**Interfaces:**
- Produces:
  - `BoardColumn` SQLAlchemy model (`__tablename__ = "columns"`, fields: `id`, `board_id`, `name`, `position`)
  - `Card` SQLAlchemy model (`__tablename__ = "cards"`, fields: `id`, `column_id`, `content`, `author`, `created_at`)

- [ ] **Step 1: Write failing model tests**

Create `server/tests/test_models.py`:

```python
from datetime import datetime, timezone
from database import Board, BoardColumn, Card
from tests.conftest import TestingSessionLocal


def test_board_column_model():
    db = TestingSessionLocal()
    board = Board(name="Retro 1")
    db.add(board)
    db.flush()
    col = BoardColumn(board_id=board.id, name="Good", position=1)
    db.add(col)
    db.commit()

    fetched = db.query(BoardColumn).filter_by(id=col.id).first()
    assert fetched.name == "Good"
    assert fetched.position == 1
    assert fetched.board_id == board.id
    db.close()


def test_card_model():
    db = TestingSessionLocal()
    board = Board(name="Retro 1")
    db.add(board)
    db.flush()
    col = BoardColumn(board_id=board.id, name="Good", position=1)
    db.add(col)
    db.flush()
    card = Card(
        column_id=col.id,
        content="Deployments are fast",
        author="Alice",
        created_at=datetime.now(timezone.utc),
    )
    db.add(card)
    db.commit()

    fetched = db.query(Card).filter_by(id=card.id).first()
    assert fetched.content == "Deployments are fast"
    assert fetched.author == "Alice"
    assert fetched.column_id == col.id
    db.close()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && pytest tests/test_models.py -v
```

Expected: `ImportError` — `BoardColumn` and `Card` not defined yet.

- [ ] **Step 3: Add models to database.py**

Replace `server/database.py` with:

```python
"""Database configuration and models."""

import os
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Board(Base):
    """Board model representing a retrospective board."""

    __tablename__ = "boards"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False, index=True)


class BoardColumn(Base):
    """Column belonging to a board."""

    __tablename__ = "columns"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    board_id = Column(Integer, ForeignKey("boards.id"), nullable=False)
    name = Column(String, nullable=False)
    position = Column(Integer, nullable=False)


class Card(Base):
    """Card belonging to a column."""

    __tablename__ = "cards"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    column_id = Column(Integer, ForeignKey("columns.id"), nullable=False)
    content = Column(String, nullable=False)
    author = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False)


def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && pytest tests/test_models.py -v
```

Expected:
```
PASSED tests/test_models.py::test_board_column_model
PASSED tests/test_models.py::test_card_model
2 passed
```

- [ ] **Step 5: Commit**

```bash
git add server/database.py server/tests/test_models.py
git commit -m "feat: add BoardColumn and Card SQLAlchemy models"
```

---

### Task 3: Column seeding on board creation and GET /api/boards/{board_id}

**Files:**
- Modify: `server/main.py`
- Create: `server/tests/test_boards.py`

**Interfaces:**
- Consumes: `BoardColumn` from `database` (Task 2)
- Produces:
  - `POST /api/boards` now seeds 3 default columns (Good pos=1, Bad pos=2, Actions pos=3)
  - `GET /api/boards/{board_id}` → `{ id: int, name: str }` or 404

- [ ] **Step 1: Write failing tests**

Create `server/tests/test_boards.py`:

```python
def test_create_board_seeds_three_columns(client):
    from database import BoardColumn
    from tests.conftest import TestingSessionLocal

    response = client.post("/api/boards", json={"name": "Sprint 42"})
    assert response.status_code == 201
    board_id = response.json()["id"]

    db = TestingSessionLocal()
    columns = (
        db.query(BoardColumn)
        .filter_by(board_id=board_id)
        .order_by(BoardColumn.position)
        .all()
    )
    db.close()

    assert len(columns) == 3
    assert columns[0].name == "Good"
    assert columns[0].position == 1
    assert columns[1].name == "Bad"
    assert columns[1].position == 2
    assert columns[2].name == "Actions"
    assert columns[2].position == 3


def test_get_board_by_id(client):
    post = client.post("/api/boards", json={"name": "My Board"})
    board_id = post.json()["id"]

    response = client.get(f"/api/boards/{board_id}")
    assert response.status_code == 200
    assert response.json() == {"id": board_id, "name": "My Board"}


def test_get_board_not_found(client):
    response = client.get("/api/boards/99999")
    assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && pytest tests/test_boards.py -v
```

Expected: `test_create_board_seeds_three_columns` and `test_get_board_by_id` fail — seeding and endpoint not implemented yet.

- [ ] **Step 3: Update main.py**

Replace `server/main.py` with:

```python
"""Main FastAPI application."""

from datetime import datetime, timezone
from typing import List

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, init_db, Board, BoardColumn, Card

app = FastAPI(title="Terra API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_DEFAULT_COLUMNS = [
    {"name": "Good", "position": 1},
    {"name": "Bad", "position": 2},
    {"name": "Actions", "position": 3},
]


# --- Pydantic models ---

class BoardCreate(BaseModel):
    name: str


class BoardResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class ColumnResponse(BaseModel):
    id: int
    board_id: int
    name: str
    position: int

    class Config:
        from_attributes = True


class CardCreate(BaseModel):
    column_id: int
    content: str
    author: str


class CardResponse(BaseModel):
    id: int
    column_id: int
    content: str
    author: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Lifecycle ---

@app.on_event("startup")
def startup_event():
    init_db()
    print("Database initialized successfully")


# --- Endpoints ---

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
    db.flush()
    for col in _DEFAULT_COLUMNS:
        db.add(BoardColumn(board_id=db_board.id, name=col["name"], position=col["position"]))
    db.commit()
    db.refresh(db_board)
    return db_board


@app.get("/api/boards/{board_id}", response_model=BoardResponse)
def get_board(board_id: int, db: Session = Depends(get_db)):
    board = db.query(Board).filter(Board.id == board_id).first()
    if board is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


@app.get("/api/boards/{board_id}/columns", response_model=List[ColumnResponse])
def get_columns(board_id: int, db: Session = Depends(get_db)):
    if not db.query(Board).filter(Board.id == board_id).first():
        raise HTTPException(status_code=404, detail="Board not found")
    return (
        db.query(BoardColumn)
        .filter(BoardColumn.board_id == board_id)
        .order_by(BoardColumn.position)
        .all()
    )


@app.get("/api/boards/{board_id}/cards", response_model=List[CardResponse])
def get_cards(board_id: int, db: Session = Depends(get_db)):
    if not db.query(Board).filter(Board.id == board_id).first():
        raise HTTPException(status_code=404, detail="Board not found")
    return (
        db.query(Card)
        .join(BoardColumn, Card.column_id == BoardColumn.id)
        .filter(BoardColumn.board_id == board_id)
        .order_by(Card.created_at)
        .all()
    )


@app.post("/api/boards/{board_id}/cards", response_model=CardResponse, status_code=201)
def create_card(board_id: int, card: CardCreate, db: Session = Depends(get_db)):
    if not db.query(Board).filter(Board.id == board_id).first():
        raise HTTPException(status_code=404, detail="Board not found")
    column = (
        db.query(BoardColumn)
        .filter(BoardColumn.id == card.column_id, BoardColumn.board_id == board_id)
        .first()
    )
    if column is None:
        raise HTTPException(status_code=404, detail="Column not found")
    db_card = Card(
        column_id=card.column_id,
        content=card.content,
        author=card.author,
        created_at=datetime.now(timezone.utc),
    )
    db.add(db_card)
    db.commit()
    db.refresh(db_card)
    return db_card
```

- [ ] **Step 4: Run board tests**

```bash
cd server && pytest tests/test_boards.py -v
```

Expected:
```
PASSED tests/test_boards.py::test_create_board_seeds_three_columns
PASSED tests/test_boards.py::test_get_board_by_id
PASSED tests/test_boards.py::test_get_board_not_found
3 passed
```

- [ ] **Step 5: Commit**

```bash
git add server/main.py server/tests/test_boards.py
git commit -m "feat: seed columns on board creation and add GET /api/boards/{id}"
```

---

### Task 4: Column and card API endpoints (tests)

**Files:**
- Create: `server/tests/test_columns.py`
- Create: `server/tests/test_cards.py`

**Interfaces:**
- Consumes: all endpoints from Task 3's `main.py`

Note: The endpoint implementations are already in `main.py` from Task 3. This task writes the tests to verify them and locks in the contracts.

- [ ] **Step 1: Write column endpoint tests**

Create `server/tests/test_columns.py`:

```python
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
```

- [ ] **Step 2: Write card endpoint tests**

Create `server/tests/test_cards.py`:

```python
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

    cards_b = client.get(f"/api/boards/{board_b}/cards").json()
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
```

- [ ] **Step 3: Run all backend tests**

```bash
cd server && pytest tests/ -v
```

Expected: all tests pass. Count should be 14 (1 smoke + 2 model + 3 board + 2 column + 6 card).

- [ ] **Step 4: Commit**

```bash
git add server/tests/test_columns.py server/tests/test_cards.py
git commit -m "test: add column and card endpoint tests"
```

---

### Task 5: Frontend routing

**Files:**
- Modify: `client/package.json` (install step only — no manual edit)
- Modify: `client/src/main.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/BoardList.tsx`

**Interfaces:**
- Produces: `/` renders the existing home view; `/boards/:id` renders a placeholder `<div>Board page coming soon</div>` (replaced in Task 9). `BoardList` board names are `<Link>` elements to `/boards/:id`.

- [ ] **Step 1: Install react-router-dom**

```bash
cd client && npm install react-router-dom
```

Expected: `react-router-dom` appears in `client/package.json` dependencies.

- [ ] **Step 2: Wrap app in BrowserRouter**

Replace `client/src/main.tsx` with:

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

- [ ] **Step 3: Add Routes to App.tsx**

Replace `client/src/App.tsx` with:

```tsx
import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import BoardForm from './components/BoardForm';
import BoardList from './components/BoardList';
import { boardApi, Board } from './services/api';

function Home() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadBoards(); }, []);

  const loadBoards = async () => {
    try {
      setError(null);
      const data = await boardApi.getBoards();
      setBoards(data);
    } catch (err) {
      console.error('Error loading boards:', err);
      setError('Failed to load boards. Make sure the server is running.');
    }
  };

  const handleCreateBoard = async (name: string) => {
    try {
      setLoading(true);
      setError(null);
      const newBoard = await boardApi.createBoard({ name });
      setBoards([...boards, newBoard]);
    } catch (err) {
      console.error('Error creating board:', err);
      setError('Failed to create board. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div style={{ padding: '10px', margin: '20px', backgroundColor: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb', borderRadius: '4px' }}>
          {error}
        </div>
      )}
      <BoardForm onSubmit={handleCreateBoard} loading={loading} />
      <BoardList boards={boards} />
    </>
  );
}

function App() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ padding: '20px', backgroundColor: '#007bff', color: 'white' }}>
        <h1 style={{ margin: 0 }}>Terra - Team Retrospective Board</h1>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/boards/:id" element={<div style={{ padding: '20px' }}>Board page coming soon</div>} />
      </Routes>
    </div>
  );
}

export default App;
```

- [ ] **Step 4: Add Link to BoardList**

Replace `client/src/components/BoardList.tsx` with:

```tsx
import { Link } from 'react-router-dom';
import { Board } from '../services/api';

interface BoardListProps {
  boards: Board[];
}

export default function BoardList({ boards }: BoardListProps) {
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
        {boards.map((board) => (
          <li key={board.id} style={{ padding: '10px', margin: '10px 0', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
            <Link to={`/boards/${board.id}`} style={{ fontWeight: 'bold', color: '#007bff', textDecoration: 'none' }}>
              {board.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Verify in the browser**

```bash
cd client && npm run dev
```

Open `http://localhost:5173`. Verify:
- Board list loads and board names are clickable links
- Clicking a board navigates to `/boards/:id` showing "Board page coming soon"
- Browser back button returns to the list

- [ ] **Step 6: Commit**

```bash
git add client/src/main.tsx client/src/App.tsx client/src/components/BoardList.tsx client/package.json client/package-lock.json
git commit -m "feat: add react-router-dom routing and board list links"
```

---

### Task 6: api.ts additions

**Files:**
- Modify: `client/src/services/api.ts`

**Interfaces:**
- Produces:
  - `Column` interface: `{ id: number; board_id: number; name: string; position: number }`
  - `Card` interface: `{ id: number; column_id: number; content: string; author: string; created_at: string }`
  - `CreateCardRequest` interface: `{ column_id: number; content: string; author: string }`
  - `boardApi.getBoardById(id: number): Promise<Board>`
  - `columnApi.getColumns(boardId: number): Promise<Column[]>`
  - `cardApi.getCards(boardId: number): Promise<Card[]>`
  - `cardApi.createCard(boardId: number, card: CreateCardRequest): Promise<Card>`

- [ ] **Step 1: Replace api.ts with updated version**

Replace `client/src/services/api.ts` with:

```ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

export interface Board {
  id: number;
  name: string;
}

export interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
}

export interface Card {
  id: number;
  column_id: number;
  content: string;
  author: string;
  created_at: string;
}

export interface CreateBoardRequest {
  name: string;
}

export interface CreateCardRequest {
  column_id: number;
  content: string;
  author: string;
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
  getBoardById: async (id: number): Promise<Board> => {
    const response = await api.get<Board>(`/api/boards/${id}`);
    return response.data;
  },
};

export const columnApi = {
  getColumns: async (boardId: number): Promise<Column[]> => {
    const response = await api.get<Column[]>(`/api/boards/${boardId}/columns`);
    return response.data;
  },
};

export const cardApi = {
  getCards: async (boardId: number): Promise<Card[]> => {
    const response = await api.get<Card[]>(`/api/boards/${boardId}/cards`);
    return response.data;
  },
  createCard: async (boardId: number, card: CreateCardRequest): Promise<Card> => {
    const response = await api.post<Card>(`/api/boards/${boardId}/cards`, card);
    return response.data;
  },
};

export default api;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/services/api.ts
git commit -m "feat: add Column, Card interfaces and API methods to api.ts"
```

---

### Task 7: CardForm component

**Files:**
- Create: `client/src/components/CardForm.tsx`

**Interfaces:**
- Consumes: `cardApi.createCard(boardId, { column_id, content, author })` → `Promise<Card>` (Task 6)
- Produces: `CardForm` component with props `{ boardId: number; columnId: number; onCardCreated: (card: Card) => void }`

- [ ] **Step 1: Create CardForm.tsx**

Create `client/src/components/CardForm.tsx`:

```tsx
import { useState, FormEvent } from 'react';
import { cardApi, Card } from '../services/api';

interface CardFormProps {
  boardId: number;
  columnId: number;
  onCardCreated: (card: Card) => void;
}

export default function CardForm({ boardId, columnId, onCardCreated }: CardFormProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !author.trim()) return;
    try {
      setSubmitting(true);
      const newCard = await cardApi.createCard(boardId, {
        column_id: columnId,
        content: content.trim(),
        author: author.trim(),
      });
      onCardCreated(newCard);
      setContent('');
      setAuthor('');
      setOpen(false);
    } catch (err) {
      console.error('Failed to create card:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setOpen(false);
    setContent('');
    setAuthor('');
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ width: '100%', padding: '8px', marginTop: '8px', backgroundColor: 'transparent', border: '1px dashed #aaa', borderRadius: '4px', cursor: 'pointer', color: '#666', fontSize: '0.875rem' }}
      >
        + Add a card
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your mind?"
        rows={3}
        style={{ width: '100%', padding: '6px', fontSize: '0.875rem', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', boxSizing: 'border-box' }}
      />
      <input
        type="text"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Your name"
        style={{ width: '100%', padding: '6px', fontSize: '0.875rem', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          type="submit"
          disabled={submitting || !content.trim() || !author.trim()}
          style={{ flex: 1, padding: '6px', backgroundColor: submitting ? '#ccc' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}
        >
          {submitting ? 'Adding...' : 'Add card'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          style={{ flex: 1, padding: '6px', backgroundColor: 'transparent', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/CardForm.tsx
git commit -m "feat: add CardForm component with inline expand/collapse"
```

---

### Task 8: Column component

**Files:**
- Create: `client/src/components/Column.tsx`

**Interfaces:**
- Consumes: `CardForm` (Task 7); `Column` interface, `Card` interface from `api.ts` (Task 6)
- Produces: `Column` component with props `{ column: Column; cards: Card[]; boardId: number; onCardCreated: (card: Card) => void }`

- [ ] **Step 1: Create Column.tsx**

Create `client/src/components/Column.tsx`:

```tsx
import { Column as ColumnType, Card } from '../services/api';
import CardForm from './CardForm';

interface ColumnProps {
  column: ColumnType;
  cards: Card[];
  boardId: number;
  onCardCreated: (card: Card) => void;
}

export default function Column({ column, cards, boardId, onCardCreated }: ColumnProps) {
  return (
    <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', border: '1px solid #ddd', borderRadius: '4px', padding: '12px', backgroundColor: '#f9f9f9' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 'bold', borderBottom: '2px solid #007bff', paddingBottom: '6px' }}>
        {column.name}
      </h3>
      <div style={{ flex: 1 }}>
        {cards.map((card) => (
          <div key={card.id} style={{ padding: '8px', marginBottom: '8px', backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
            <p style={{ margin: '0 0 6px 0', fontSize: '0.9rem', lineHeight: '1.4' }}>{card.content}</p>
            <span style={{ fontSize: '0.75rem', color: '#888' }}>
              {card.author} · {new Date(card.created_at).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
      <CardForm boardId={boardId} columnId={column.id} onCardCreated={onCardCreated} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Column.tsx
git commit -m "feat: add Column component"
```

---

### Task 9: BoardPage component

**Files:**
- Create: `client/src/components/BoardPage.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `boardApi.getBoardById`, `columnApi.getColumns`, `cardApi.getCards`, `cardApi.createCard` (Task 6); `Column` component (Task 8)
- Produces: `BoardPage` component; `App.tsx` routes `/boards/:id` to `<BoardPage />`

- [ ] **Step 1: Create BoardPage.tsx**

Create `client/src/components/BoardPage.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { boardApi, columnApi, cardApi, Board, Column, Card } from '../services/api';
import ColumnComponent from './Column';

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const boardId = Number(id);

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [cardsByColumn, setCardsByColumn] = useState<Record<number, Card[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const boardData = await boardApi.getBoardById(boardId);
        setBoard(boardData);
        const [columnsData, cardsData] = await Promise.all([
          columnApi.getColumns(boardId),
          cardApi.getCards(boardId),
        ]);
        setColumns(columnsData);
        const grouped: Record<number, Card[]> = {};
        columnsData.forEach((col) => { grouped[col.id] = []; });
        cardsData.forEach((card) => {
          if (grouped[card.column_id]) {
            grouped[card.column_id].push(card);
          }
        });
        setCardsByColumn(grouped);
      } catch {
        setError('Failed to load board.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [boardId]);

  const handleCardCreated = (card: Card) => {
    setCardsByColumn((prev) => ({
      ...prev,
      [card.column_id]: [...(prev[card.column_id] ?? []), card],
    }));
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ padding: '10px', backgroundColor: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb', borderRadius: '4px', marginBottom: '12px' }}>
          {error}
        </div>
        <Link to="/" style={{ color: '#007bff', textDecoration: 'none' }}>← Back to boards</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <Link to="/" style={{ color: '#007bff', textDecoration: 'none', fontSize: '0.9rem' }}>← Back to boards</Link>
      <h2 style={{ margin: '8px 0 20px 0' }}>{board?.name}</h2>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        {columns.map((col) => (
          <ColumnComponent
            key={col.id}
            column={col}
            cards={cardsByColumn[col.id] ?? []}
            boardId={boardId}
            onCardCreated={handleCardCreated}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire BoardPage into App.tsx**

Replace the `/boards/:id` route placeholder in `client/src/App.tsx`. Change:

```tsx
import { Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import BoardForm from './components/BoardForm';
import BoardList from './components/BoardList';
import { boardApi, Board } from './services/api';
```

to:

```tsx
import { Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import BoardForm from './components/BoardForm';
import BoardList from './components/BoardList';
import BoardPage from './components/BoardPage';
import { boardApi, Board } from './services/api';
```

And change:

```tsx
        <Route path="/boards/:id" element={<div style={{ padding: '20px' }}>Board page coming soon</div>} />
```

to:

```tsx
        <Route path="/boards/:id" element={<BoardPage />} />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Test the full feature in the browser**

```bash
cd client && npm run dev
```

Open `http://localhost:5173` (ensure the backend is running with `podman compose up` or equivalent). Verify:

1. Create a new board — it appears in the list as a clickable link
2. Click the board — navigates to `/boards/:id`, shows the board name and three columns (Good, Bad, Actions)
3. Click "Add a card" in the Good column — form expands with textarea and name field
4. Fill in content and name, submit — card appears in the column, form collapses
5. Add cards to Bad and Actions columns
6. Reload the page — all cards are still there (persisted via API)
7. Click "← Back to boards" — returns to the home page

- [ ] **Step 5: Commit**

```bash
git add client/src/components/BoardPage.tsx client/src/App.tsx
git commit -m "feat: add BoardPage with column layout and card creation"
```
