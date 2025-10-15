#!/usr/bin/env python3
"""
Database Cleanup Script
Run from backend directory: uv run python scripts/cleanup_db.py
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from pathlib import Path
import os

print("🧹 Database Cleanup Script")
print("=" * 60)

# Create engine using environment variable
database_url = os.environ.get("DATABASE_URL")
if not database_url:
    print("❌ DATABASE_URL environment variable not found")
    exit(1)

engine = create_engine(database_url)
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
    """Apply thumbnail migrations"""
    migration_paths = [
        Path(__file__).parent.parent / "migrations" / "001_add_thumbnail_s3_key.sql",
        Path(__file__).parent.parent / "migrations" / "002_ensure_thumbnail_consistency.sql"
    ]
    
    print("\n📋 Applying thumbnail migrations...")
    
    with Session() as session:
        for migration_path in migration_paths:
            if not migration_path.exists():
                print(f"⚠️  Migration file not found: {migration_path.name}, skipping...")
                continue
                
            print(f"  📄 Applying {migration_path.name}...")
            with open(migration_path, 'r') as f:
                migration_sql = f.read()
            
            try:
                # Split by semicolon and execute each statement
                statements = [s.strip() for s in migration_sql.split(';') if s.strip()]
                for statement in statements:
                    if statement and not statement.startswith('--') and not statement.startswith('COMMENT'):
                        try:
                            session.execute(text(statement))
                        except Exception as e:
                            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                                print(f"    ⚠️  Skipping: {statement[:50]}... (already exists)")
                            else:
                                raise
                session.commit()
                print(f"    ✅ {migration_path.name} applied successfully")
            except Exception as e:
                print(f"    ⚠️  Migration note for {migration_path.name}: {e}")

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
        print("✅ Database cleanup complete!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit(main() or 0)

