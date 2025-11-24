"""
Database configuration and session management
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Configure engine with connection pooling to handle connection drops
# SQLite doesn't support pool_size, max_overflow, or pool_recycle
# PostgreSQL supports all pooling options
is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if is_sqlite:
    # SQLite configuration (for tests)
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False,
    )
else:
    # PostgreSQL configuration with connection pooling
    # pool_pre_ping=True: Verify connections before using them
    # pool_recycle=3600: Recycle connections after 1 hour to prevent stale connections
    # max_overflow=10: Allow 10 additional connections beyond pool_size
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,  # Verify connections before using
        pool_recycle=3600,   # Recycle connections after 1 hour
        pool_size=5,         # Base pool size
        max_overflow=10,     # Allow overflow connections
        echo=False,          # Set to True for SQL query logging
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    Database dependency for FastAPI
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
