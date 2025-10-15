#!/usr/bin/env python3
"""
Database Cleanup Script
Clears all data from the database and applies migrations
"""

import os
import sys
from pathlib import Path

# Add parent directory to path to import from backend
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / "backend" / ".env"
load_dotenv(env_path)

# Get database URL
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment")
    sys.exit(1)

print("🧹 Database Cleanup Script")
print("=" * 60)

# Create engine
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

def get_table_counts():
    """Get current record counts"""
    with Session() as session:
        result = session.execute(text("""
            SELECT 
                'jobs' as table_name, COUNT(*) as count FROM jobs
            UNION ALL
            SELECT 
                'restore_attempts', COUNT(*) FROM restore_attempts
            UNION ALL
            SELECT 
                'animation_attempts', COUNT(*) FROM animation_attempts
        """))
        return list(result)

def truncate_tables():
    """Clear all data from tables"""
    with Session() as session:
        print("\n🗑️  Truncating tables...")
        session.execute(text("TRUNCATE jobs, restore_attempts, animation_attempts CASCADE"))
        session.commit()
        print("✅ All tables cleared")

def apply_migration():
    """Apply thumbnail migration"""
    migration_path = Path(__file__).parent.parent / "backend" / "migrations" / "001_add_thumbnail_s3_key.sql"
    
    if not migration_path.exists():
        print("⚠️  Migration file not found, skipping...")
        return
    
    print("\n📋 Applying thumbnail migration...")
    with open(migration_path, 'r') as f:
        migration_sql = f.read()
    
    with Session() as session:
        try:
            # Split by semicolon and execute each statement
            statements = [s.strip() for s in migration_sql.split(';') if s.strip()]
            for statement in statements:
                if statement and not statement.startswith('--'):
                    session.execute(text(statement))
            session.commit()
            print("✅ Migration applied successfully")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("⚠️  Migration already applied (this is okay)")
            else:
                print(f"⚠️  Migration error: {e}")

def main():
    try:
        # Show current state
        print("\n📊 Current database state:")
        print("-" * 60)
        counts = get_table_counts()
        for table_name, count in counts:
            print(f"  {table_name:25} {count:>10} records")
        
        # Confirm
        print("\n" + "=" * 60)
        confirm = input("\n⚠️  This will DELETE ALL data. Continue? (y/N): ")
        if confirm.lower() != 'y':
            print("❌ Cleanup cancelled")
            return
        
        # Truncate tables
        truncate_tables()
        
        # Apply migration
        apply_migration()
        
        # Show final state
        print("\n📊 Final database state:")
        print("-" * 60)
        counts = get_table_counts()
        for table_name, count in counts:
            print(f"  {table_name:25} {count:>10} records")
        
        print("\n" + "=" * 60)
        print("✅ Cleanup complete!")
        print("\n📝 Next steps:")
        print("  1. Clean up S3 storage (see instructions below)")
        print("  2. Open the app and upload a photo")
        print("  3. Check that thumbnail is generated automatically")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

