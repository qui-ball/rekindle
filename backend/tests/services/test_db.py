"""
Basic database connectivity test
"""

import os
import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.core.database import engine
from app.core.config import settings


def test_db_ping():
    """Test basic database connectivity"""
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            assert result.scalar() == 1
            print("✓ Database ping successful")
    except OperationalError as e:
        pytest.fail(f"Failed to connect to database: {e}")


def test_db_version():
    """Test database version query (adapts to SQLite or PostgreSQL)"""
    try:
        with engine.connect() as connection:
            # Check if we're using PostgreSQL or SQLite
            if "postgresql" in settings.DATABASE_URL or "postgres" in settings.DATABASE_URL:
                result = connection.execute(text("SELECT version()"))
                version = result.scalar()
                assert version is not None
                assert "PostgreSQL" in version
                print(f"✓ PostgreSQL version: {version[:50]}...")
            else:
                # SQLite
                result = connection.execute(text("SELECT sqlite_version()"))
                version = result.scalar()
                assert version is not None
                print(f"✓ SQLite version: {version}")
    except OperationalError as e:
        pytest.fail(f"Failed to query database version: {e}")


def test_db_info():
    """Test database info query (adapts to SQLite or PostgreSQL)"""
    try:
        with engine.connect() as connection:
            # Check if we're using PostgreSQL or SQLite
            if "postgresql" in settings.DATABASE_URL or "postgres" in settings.DATABASE_URL:
                result = connection.execute(text("SELECT current_database()"))
                db_name = result.scalar()
                assert db_name is not None
                print(f"✓ Connected to PostgreSQL database: {db_name}")
            else:
                # SQLite
                result = connection.execute(text("PRAGMA database_list"))
                databases = result.fetchall()
                assert len(databases) > 0
                print(f"✓ Connected to SQLite with {len(databases)} database(s)")
    except OperationalError as e:
        pytest.fail(f"Failed to query database info: {e}")