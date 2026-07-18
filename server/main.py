"""Main FastAPI application."""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from database import get_db, init_db, Board

# Initialize FastAPI app
app = FastAPI(title="Terra API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default dev server port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request/response
class BoardCreate(BaseModel):
    """Model for creating a board."""
    name: str


class BoardResponse(BaseModel):
    """Model for board response."""
    id: int
    name: str
    
    class Config:
        from_attributes = True


@app.on_event("startup")
def startup_event():
    """Initialize database on startup."""
    init_db()
    print("Database initialized successfully")


@app.get("/")
def root():
    """Root endpoint."""
    return {"message": "Terra API"}


@app.get("/api/boards", response_model=List[BoardResponse])
def get_boards(db: Session = Depends(get_db)):
    """Get all boards."""
    boards = db.query(Board).all()
    return boards


@app.post("/api/boards", response_model=BoardResponse, status_code=201)
def create_board(board: BoardCreate, db: Session = Depends(get_db)):
    """Create a new board."""
    db_board = Board(name=board.name)
    db.add(db_board)
    db.commit()
    db.refresh(db_board)
    return db_board
