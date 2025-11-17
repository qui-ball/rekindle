#!/usr/bin/env python3
"""
Script to delete all photos except the most recent one with a working restoration.

This script:
1. Finds all photos
2. Identifies the most recent photo with a working restoration (user-scoped s3_key)
3. Deletes all other photos
"""

import sys
import os
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import SessionLocal
from app.models.photo import Photo
from app.models.jobs import Job, RestoreAttempt
from sqlalchemy import desc

def find_most_recent_working_photo(db):
    """Find the most recent photo with a working restoration."""
    all_photos = db.query(Photo).order_by(desc(Photo.created_at)).all()
    
    for photo in all_photos:
        # Check if this photo has a job with working restore attempts
        job = db.query(Job).filter(Job.id == photo.id).first()
        if job:
            # Check for restore attempts with user-scoped keys
            working_restores = db.query(RestoreAttempt).filter(
                RestoreAttempt.job_id == photo.id,
                RestoreAttempt.s3_key.like('users/%')
            ).all()
            
            if working_restores:
                return photo
    
    # If no photo with working restoration, return the most recent photo
    if all_photos:
        return all_photos[0]
    
    return None

def main():
    db = SessionLocal()
    try:
        # Find the photo to keep
        keep_photo = find_most_recent_working_photo(db)
        
        if not keep_photo:
            print("No photos found.")
            return
        
        print(f"Keeping photo: {keep_photo.id}")
        print(f"  Created: {keep_photo.created_at}")
        print(f"  Owner: {keep_photo.owner_id}")
        print(f"  Status: {keep_photo.status}")
        
        # Get all photos except the one to keep
        all_photos = db.query(Photo).all()
        photos_to_delete = [p for p in all_photos if p.id != keep_photo.id]
        
        if not photos_to_delete:
            print("\n✅ No photos to delete. Only one photo exists.")
            return
        
        print(f"\n📋 Found {len(photos_to_delete)} photos to delete:")
        for photo in photos_to_delete:
            print(f"  - {photo.id} (created: {photo.created_at})")
        
        # Confirm deletion
        response = input(f"\n⚠️  Delete {len(photos_to_delete)} photos? (yes/no): ")
        if response.lower() != 'yes':
            print("❌ Cancelled.")
            return
        
        # Delete photos
        print(f"\n🗑️  Deleting {len(photos_to_delete)} photos...")
        for photo in photos_to_delete:
            # Also delete associated job and restore attempts
            job = db.query(Job).filter(Job.id == photo.id).first()
            if job:
                db.query(RestoreAttempt).filter(RestoreAttempt.job_id == photo.id).delete()
                db.delete(job)
            db.delete(photo)
        
        db.commit()
        print(f"✅ Deleted {len(photos_to_delete)} photos.")
        print(f"✅ Kept photo: {keep_photo.id}")
    
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()

