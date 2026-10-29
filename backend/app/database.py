"""
database.py — The "connection cable" between Python and the database.

This file does three things:
  1. Reads the DATABASE_URL from the .env file.
  2. Creates an "Engine" — the low-level connection to the database.
  3. Creates a "Session" factory — each request to FastAPI gets its own session.
"""

import os  # os = Operating System module. Lets Python read environment variables.

from dotenv import load_dotenv  # Reads our .env file and loads its variables into os.environ

from sqlalchemy import create_engine  # The function that builds the Engine (connection pipe)
from sqlalchemy.orm import sessionmaker, DeclarativeBase  # Session = a single DB "conversation"

# ── Step 1: Load secrets from .env ──────────────────────────────────────────
load_dotenv()  # After this line, os.environ["DATABASE_URL"] exists.

# ── Step 2: Read the database URL from the environment ──────────────────────
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULT_DB_PATH = os.path.join(_BACKEND_DIR, "syncbill_dev.db")
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL or DATABASE_URL == "sqlite:///./syncbill_dev.db":
    DATABASE_URL = f"sqlite:///{_DEFAULT_DB_PATH.replace(os.sep, '/')}"

# ── Step 3: Create the Engine ───────────────────────────────────────────────
# The engine manages the actual database connection pool.
# connect_args={"check_same_thread": False} is ONLY needed for SQLite.
# PostgreSQL doesn't need it; it handles multi-threading natively.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=True,  # echo=True prints every SQL query to the console — great for learning!
)

# ── Step 4: Create a Session factory ────────────────────────────────────────
# SessionLocal is NOT a session yet. It's a "class" (blueprint) for making sessions.
# Each API endpoint will call SessionLocal() to get its own private DB conversation.
SessionLocal = sessionmaker(
    autocommit=False,  # Don't save automatically — we'll call session.commit() ourselves
    autoflush=False,   # Don't send SQL to DB until we explicitly flush
    bind=engine,       # Use our engine (connection) we created above
)


# ── Step 5: The Base class ──────────────────────────────────────────────────
# Every SQLAlchemy model (Firm, Item, Customer) will inherit from Base.
# This is how SQLAlchemy knows "this Python class = a database table."
class Base(DeclarativeBase):
    pass  # Empty for now. All power comes from DeclarativeBase.


# ── Step 6: A helper function for FastAPI dependency injection ───────────────
# FastAPI can automatically call get_db() for every API route that needs a DB session.
# The "yield" keyword makes this a "generator" — it gives the session to the route,
# waits for the route to finish, THEN closes the session in the "finally" block.
def get_db():
    """
    Dependency function: opens a DB session, gives it to the route,
    then closes it when the route is done (even if an error occurred).
    """
    db = SessionLocal()  # Open a new session
    try:
        yield db          # Hand the session to the route handler
    finally:
        db.close()        # Always close — prevents connection leaks
