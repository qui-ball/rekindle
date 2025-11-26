#!/usr/bin/env python3
"""
Script to delete failed/pending restore attempts, keeping only successful ones.

This script:
1. Finds all restore attempts for a photo
2. Identifies successful ones (user-scoped s3_key, not pending/failed)
3. Deletes all failed/pending attempts
"""

import sys
from pathlib import Path
from uuid import UUID

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import SessionLocal
from app.models.jobs import Job, RestoreAttempt

def cleanup_restore_attempts(photo_id: str):
    """Clean up restore attempts for a photo, keeping only successful ones."""
    db = SessionLocal()
    try:
        photo_uuid = UUID(photo_id)
        
        # Get the job for this photo
        job = db.query(Job).filter(Job.id == photo_uuid).first()
        if not job:
            print(f"❌ No job found for photo {photo_id}")
            return
        
        # Get all restore attempts
        all_restores = db.query(RestoreAttempt).filter(
            RestoreAttempt.job_id == photo_uuid
        ).order_by(RestoreAttempt.created_at.desc()).all()
        
        print(f"📋 Found {len(all_restores)} restore attempts for photo {photo_id}:")
        
        successful_restores = []
        failed_restores = []
        
        for restore in all_restores:
            is_successful = (
                restore.s3_key and 
                restore.s3_key.startswith('users/') and
                restore.s3_key not in ['pending', '', 'failed']
            )
            
            if is_successful:
                successful_restores.append(restore)
                print(f"  ✅ {restore.id}: {restore.s3_key[:60]}... (SUCCESS)")
            else:
                failed_restores.append(restore)
                status = restore.s3_key if restore.s3_key else 'empty'
                print(f"  ❌ {restore.id}: {status} (FAILED/PENDING)")
        
        if not successful_restores:
            print("\n⚠️  No successful restore attempts found!")
            response = input("Delete all restore attempts? (yes/no): ")
            if response.lower() != 'yes':
                print("❌ Cancelled.")
                return
            for restore in failed_restores:
                db.delete(restore)
        else:
            # Keep only the most recent successful one
            keep_restore = successful_restores[0]  # Already sorted by created_at DESC
            print(f"\n✅ Keeping restore attempt: {keep_restore.id}")
            print(f"   s3_key: {keep_restore.s3_key}")
            
            # Delete all others
            to_delete = [r for r in all_restores if r.id != keep_restore.id]
            
            if not to_delete:
                print("\n✅ No restore attempts to delete.")
                return
            
            print(f"\n📋 Will delete {len(to_delete)} restore attempts:")
            for restore in to_delete:
                status = restore.s3_key if restore.s3_key else 'empty'
                print(f"  - {restore.id}: {status}")
            
            response = input(f"\n⚠️  Delete {len(to_delete)} restore attempts? (yes/no): ")
            if response.lower() != 'yes':
                print("❌ Cancelled.")
                return
            
            for restore in to_delete:
                db.delete(restore)
            
            # Update job's selected_restore_id to the kept one
            job.selected_restore_id = keep_restore.id
        
        db.commit()
        print(f"\n✅ Cleanup complete!")
        print(f"   Kept: {len(successful_restores)} successful restore attempt(s)")
        print(f"   Deleted: {len(failed_restores)} failed/pending restore attempt(s)")
    
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Clean up restore attempts for a photo")
    parser.add_argument("photo_id", help="Photo ID (UUID)")
    args = parser.parse_args()
    
    cleanup_restore_attempts(args.photo_id)

if __name__ == "__main__":
    main()

