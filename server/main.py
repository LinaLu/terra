"""Main FastAPI application."""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.exc import OperationalError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, init_db, SessionLocal, Board, BoardColumn, Card
from links import create_board_link

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
    short_code: Optional[str] = None
    link_expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LinkResponse(BaseModel):
    short_code: str
    link_expires_at: datetime


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
    votes: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


# --- Lifecycle ---

@app.on_event("startup")
def startup_event():
    init_db()
    db = SessionLocal()
    # Seed default columns for boards that pre-date this feature (i.e. have no columns yet).
    try:
        boards_without_columns = (
            db.query(Board)
            .outerjoin(BoardColumn, Board.id == BoardColumn.board_id)
            .filter(BoardColumn.id == None)  # noqa: E711
            .all()
        )
        for board in boards_without_columns:
            for col in _DEFAULT_COLUMNS:
                db.add(BoardColumn(board_id=board.id, name=col["name"], position=col["position"]))
        if boards_without_columns:
            db.commit()
    except OperationalError:
        # Tables may not exist yet if init_db was skipped (e.g. in tests); safe to ignore.
        db.rollback()
    finally:
        db.close()
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


@app.post("/api/boards/{board_id}/cards/{card_id}/upvote", response_model=CardResponse)
def upvote_card(board_id: int, card_id: int, db: Session = Depends(get_db)):
    if not db.query(Board).filter(Board.id == board_id).first():
        raise HTTPException(status_code=404, detail="Board not found")
    card = (
        db.query(Card)
        .join(BoardColumn, Card.column_id == BoardColumn.id)
        .filter(Card.id == card_id, BoardColumn.board_id == board_id)
        .first()
    )
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    card.votes = (card.votes or 0) + 1
    db.commit()
    db.refresh(card)
    return card


@app.post("/api/boards/{board_id}/cards/{card_id}/downvote", response_model=CardResponse)
def downvote_card(board_id: int, card_id: int, db: Session = Depends(get_db)):
    if not db.query(Board).filter(Board.id == board_id).first():
        raise HTTPException(status_code=404, detail="Board not found")
    card = (
        db.query(Card)
        .join(BoardColumn, Card.column_id == BoardColumn.id)
        .filter(Card.id == card_id, BoardColumn.board_id == board_id)
        .first()
    )
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    card.votes = max(0, (card.votes or 0) - 1)
    db.commit()
    db.refresh(card)
    return card
