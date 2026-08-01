"""Database configuration and models."""

import os
import uuid
from datetime import datetime, timezone
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL, echo=True)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()


# User model
class User(Base):
    """User model representing a participant in a board."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    board_id = Column(Integer, ForeignKey("boards.id"), nullable=False)
    name = Column(String, nullable=False)
    session_token = Column(String(36), unique=True, nullable=False, index=True, default=lambda: str(uuid.uuid4()))
    role = Column(String, nullable=False)  # "admin" or "user"


# Board model
class Board(Base):
    """Board model representing a retrospective board."""

    __tablename__ = "boards"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False, index=True)
    short_code = Column(String(6), unique=True, nullable=True, index=True)
    link_expires_at = Column(DateTime(timezone=True), nullable=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)


# BoardColumn model
class BoardColumn(Base):
    """Column belonging to a board."""

    __tablename__ = "columns"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    board_id = Column(Integer, ForeignKey("boards.id"), nullable=False)
    name = Column(String, nullable=False)
    position = Column(Integer, nullable=False)


# Template model
class Template(Base):
    """Predefined board template, defining a fixed set of columns."""

    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    columns = relationship(
        "TemplateColumn",
        order_by="TemplateColumn.position",
        cascade="all, delete-orphan",
    )


# TemplateColumn model
class TemplateColumn(Base):
    """Column belonging to a template."""

    __tablename__ = "template_columns"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=False)
    name = Column(String, nullable=False)
    position = Column(Integer, nullable=False)


# Card model
class Card(Base):
    """Card belonging to a column."""

    __tablename__ = "cards"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    column_id = Column(Integer, ForeignKey("columns.id"), nullable=False)
    content = Column(String, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    votes = Column(Integer, nullable=False, default=0)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False)
    
    author_user = relationship("User")
    
    @property
    def author(self):
        return self.author_user.name if self.author_user else ""


# Dependency to get DB session
def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DEFAULT_TEMPLATES = [
    ("Basic Retro", ["Went Well", "To Improve", "Action Items"]),
    ("Start Stop Continue", ["Start", "Stop", "Continue"]),
    ("4Ls", ["Liked", "Learned", "Lacked", "Longed For"]),
]


def seed_default_templates(db):
    """Insert the default templates if the templates table is empty."""
    if db.query(Template).first():
        return
    for name, columns in DEFAULT_TEMPLATES:
        template = Template(name=name)
        db.add(template)
        db.flush()
        for position, col_name in enumerate(columns, start=1):
            db.add(TemplateColumn(template_id=template.id, name=col_name, position=position))
    db.commit()


def init_db():
    """Initialize database tables and seed default templates."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_default_templates(db)
    finally:
        db.close()
