"""Main FastAPI application."""

from datetime import datetime, timezone
from typing import Dict, List, Optional
import uuid

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.encoders import jsonable_encoder
from sqlalchemy.exc import OperationalError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import Base, engine, get_db, init_db, Board, BoardColumn, Card, User, Template, TemplateColumn
from links import create_board_link, is_link_active

app = FastAPI(title="Terra API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Security & Auth ---

security = HTTPBearer(auto_error=False)

def get_current_user(board_id: int, db: Session = Depends(get_db), credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = credentials.credentials
    user = db.query(User).filter(User.session_token == token, User.board_id == board_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session token or user not in this board")
    return user


# --- WebSocket Manager ---

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, board_id: int, websocket: WebSocket):
        await websocket.accept()
        if board_id not in self.active_connections:
            self.active_connections[board_id] = []
        self.active_connections[board_id].append(websocket)

    def disconnect(self, board_id: int, websocket: WebSocket):
        if board_id in self.active_connections:
            if websocket in self.active_connections[board_id]:
                self.active_connections[board_id].remove(websocket)
            if not self.active_connections[board_id]:
                del self.active_connections[board_id]

    async def broadcast(self, board_id: int, message: dict):
        if board_id in self.active_connections:
            for connection in list(self.active_connections[board_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    pass


manager = ConnectionManager()


# --- Pydantic models ---

class UserCreate(BaseModel):
    name: str

class UserResponse(BaseModel):
    id: int
    board_id: int
    name: str
    role: str

    class Config:
        from_attributes = True

class JoinResponse(BaseModel):
    user: UserResponse
    session_token: str

class BoardCreate(BaseModel):
    name: str
    template_id: int


class BoardResponse(BaseModel):
    id: int
    name: str
    short_code: Optional[str] = None
    link_expires_at: Optional[datetime] = None
    admin_id: Optional[int] = None

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


class TemplateCreate(BaseModel):
    name: str
    columns: List[str]


class TemplateColumnResponse(BaseModel):
    id: int
    name: str
    position: int

    class Config:
        from_attributes = True


class TemplateResponse(BaseModel):
    id: int
    name: str
    columns: List[TemplateColumnResponse]

    class Config:
        from_attributes = True


class CardCreate(BaseModel):
    column_id: int
    content: str
    position: Optional[int] = None

class CardUpdate(BaseModel):
    content: str


class CardResponse(BaseModel):
    id: int
    column_id: int
    content: str
    author: str
    votes: int = 0
    position: int
    created_at: datetime

    class Config:
        from_attributes = True


class CardReorderRequest(BaseModel):
    id: int
    column_id: int
    position: int

class ReorderCardsRequest(BaseModel):
    cards: List[CardReorderRequest]

# --- Lifecycle ---

@app.on_event("startup")
def startup_event():
    init_db()
    print("Database initialized successfully")


# --- Endpoints ---

@app.get("/")
def root():
    return {"message": "Terra API"}


@app.websocket("/ws/boards/{board_id}")
async def websocket_endpoint(websocket: WebSocket, board_id: int):
    await manager.connect(board_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.disconnect(board_id, websocket)


@app.get("/api/boards", response_model=List[BoardResponse])
def get_boards(db: Session = Depends(get_db)):
    return db.query(Board).all()


@app.post("/api/boards", response_model=BoardResponse, status_code=201)
def create_board(board: BoardCreate, db: Session = Depends(get_db)):
    template = db.query(Template).filter(Template.id == board.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    db_board = Board(name=board.name)
    db.add(db_board)
    db.flush()
    for template_column in template.columns:
        db.add(BoardColumn(board_id=db_board.id, name=template_column.name, position=template_column.position))
    db.commit()
    db.refresh(db_board)
    return db_board


@app.post("/api/boards/{board_id}/join", response_model=JoinResponse)
def join_board(board_id: int, join_request: UserCreate, db: Session = Depends(get_db)):
    board = db.query(Board).filter(Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Check if this user name already exists in this board
    existing_user = db.query(User).filter(User.board_id == board_id, User.name == join_request.name).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Name already taken in this board")
        
    # Check if this is the first user
    user_count = db.query(User).filter(User.board_id == board_id).count()
    role = "admin" if user_count == 0 else "user"
    
    new_user = User(
        board_id=board_id,
        name=join_request.name,
        role=role,
        session_token=str(uuid.uuid4())
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    if role == "admin":
        board.admin_id = new_user.id
        db.commit()
        
    return {
        "user": new_user,
        "session_token": new_user.session_token
    }


@app.get("/api/boards/{board_id}/me", response_model=UserResponse)
def get_me(board_id: int, current_user: User = Depends(get_current_user)):
    return current_user


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


def _validate_template_input(payload: TemplateCreate) -> tuple[str, List[str]]:
    name = payload.name.strip()
    columns = [c.strip() for c in payload.columns if c.strip()]
    if not name:
        raise HTTPException(status_code=422, detail="Template name is required")
    if not columns:
        raise HTTPException(status_code=422, detail="At least one column is required")
    return name, columns


@app.get("/api/templates", response_model=List[TemplateResponse])
def get_templates(db: Session = Depends(get_db)):
    return db.query(Template).all()


@app.post("/api/templates", response_model=TemplateResponse, status_code=201)
def create_template(payload: TemplateCreate, db: Session = Depends(get_db)):
    name, columns = _validate_template_input(payload)
    db_template = Template(name=name)
    db.add(db_template)
    db.flush()
    for position, col_name in enumerate(columns, start=1):
        db.add(TemplateColumn(template_id=db_template.id, name=col_name, position=position))
    db.commit()
    db.refresh(db_template)
    return db_template


@app.put("/api/templates/{template_id}", response_model=TemplateResponse)
def update_template(template_id: int, payload: TemplateCreate, db: Session = Depends(get_db)):
    name, columns = _validate_template_input(payload)
    db_template = db.query(Template).filter(Template.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")

    db_template.name = name
    db.query(TemplateColumn).filter(TemplateColumn.template_id == template_id).delete()
    db.flush()
    for position, col_name in enumerate(columns, start=1):
        db.add(TemplateColumn(template_id=template_id, name=col_name, position=position))
    db.commit()
    db.refresh(db_template)
    return db_template


@app.delete("/api/templates/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    db_template = db.query(Template).filter(Template.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(db_template)
    db.commit()
    return None


@app.get("/api/boards/{board_id}/cards", response_model=List[CardResponse])
def get_cards(board_id: int, db: Session = Depends(get_db)):
    if not db.query(Board).filter(Board.id == board_id).first():
        raise HTTPException(status_code=404, detail="Board not found")
    return (
        db.query(Card)
        .join(BoardColumn, Card.column_id == BoardColumn.id)
        .filter(BoardColumn.board_id == board_id)
        .order_by(Card.position, Card.created_at)
        .all()
    )


@app.post("/api/boards/{board_id}/cards", response_model=CardResponse, status_code=201)
async def create_card(board_id: int, card: CardCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not db.query(Board).filter(Board.id == board_id).first():
        raise HTTPException(status_code=404, detail="Board not found")
    column = (
        db.query(BoardColumn)
        .filter(BoardColumn.id == card.column_id, BoardColumn.board_id == board_id)
        .first()
    )
    if column is None:
        raise HTTPException(status_code=404, detail="Column not found")

    if card.position is not None:
        position = card.position
    else:
        max_pos = db.query(func.max(Card.position)).filter(Card.column_id == card.column_id).scalar()
        position = (max_pos or 0) + 1

    db_card = Card(
        column_id=card.column_id,
        content=card.content,
        author_id=current_user.id,
        position=position,
        created_at=datetime.now(timezone.utc),
    )
    db.add(db_card)
    db.commit()
    db.refresh(db_card)
    card_data = jsonable_encoder(CardResponse.model_validate(db_card))
    await manager.broadcast(board_id, {"type": "card_created", "data": card_data})
    return db_card


@app.put("/api/boards/{board_id}/cards/{card_id}", response_model=CardResponse)
async def update_card(board_id: int, card_id: int, card_update: CardUpdate, db: Session = Depends(get_db)):
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
    card.content = card_update.content
    db.commit()
    db.refresh(card)
    card_data = jsonable_encoder(CardResponse.model_validate(card))
    await manager.broadcast(board_id, {"type": "card_updated", "data": card_data})
    return card


@app.delete("/api/boards/{board_id}/cards/{card_id}", status_code=204)
async def delete_card(board_id: int, card_id: int, db: Session = Depends(get_db)):
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
    
    column_id = card.column_id
    db.delete(card)
    db.commit()
    
    await manager.broadcast(board_id, {"type": "card_deleted", "data": {"id": card_id, "column_id": column_id}})
    return None


@app.post("/api/boards/{board_id}/cards/{card_id}/upvote", response_model=CardResponse)
async def upvote_card(board_id: int, card_id: int, db: Session = Depends(get_db)):
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
    card_data = jsonable_encoder(CardResponse.model_validate(card))
    await manager.broadcast(board_id, {"type": "card_updated", "data": card_data})
    return card


@app.put("/api/boards/{board_id}/cards/reorder")
async def reorder_cards(board_id: int, req: ReorderCardsRequest, db: Session = Depends(get_db)):
    if not db.query(Board).filter(Board.id == board_id).first():
        raise HTTPException(status_code=404, detail="Board not found")
    
    # We update all affected cards in one transaction
    # Since we need to make sure cards belong to the board, we could verify each card, 
    # but since the UI sends only valid cards, we can do it optimistically.
    card_updates = []
    
    for c_req in req.cards:
        card = db.query(Card).join(BoardColumn, Card.column_id == BoardColumn.id).filter(Card.id == c_req.id, BoardColumn.board_id == board_id).first()
        if card:
            card.column_id = c_req.column_id
            card.position = c_req.position
            card_updates.append(card)
            
    db.commit()
    
    # Broadcast an event
    await manager.broadcast(board_id, {"type": "cards_reordered", "data": [jsonable_encoder(CardResponse.model_validate(c)) for c in card_updates]})
    return {"message": "Cards reordered successfully"}


@app.post("/api/boards/{board_id}/cards/{card_id}/downvote", response_model=CardResponse)
async def downvote_card(board_id: int, card_id: int, db: Session = Depends(get_db)):
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
    card_data = jsonable_encoder(CardResponse.model_validate(card))
    await manager.broadcast(board_id, {"type": "card_updated", "data": card_data})
    return card
