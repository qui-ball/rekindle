#!/usr/bin/env python3
"""
Script to identify and optionally delete photos with legacy job-based keys.

Usage:
    # Dry run (just list photos)
    python cleanup_legacy_photos.py
    
    # Actually delete them
    python cleanup_legacy_photos.py --delete
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import SessionLocal
from app.models.photo import Photo
from sqlalchemy import or_

def find_legacy_photos(db):
    """Find photos with legacy job-based keys."""
    all_photos = db.query(Photo).all()
    legacy_photos = []
    
    for photo in all_photos:
        has_legacy_key = False
        if photo.processed_key and not photo.processed_key.startswith("users/"):
            has_legacy_key = True
        if photo.thumbnail_key and not photo.thumbnail_key.startswith("users/"):
            has_legacy_key = True
        
        if has_legacy_key:
            legacy_photos.append(photo)
    
    return legacy_photos

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Clean up photos with legacy job-based keys")
    parser.add_argument("--delete", action="store_true", help="Actually delete the photos (default is dry run)")
    args = parser.parse_args()
    
    db = SessionLocal()
    try:
        legacy_photos = find_legacy_photos(db)
        
        if not legacy_photos:
            print("✅ No photos with legacy job-based keys found.")
            return
        
        print(f"Found {len(legacy_photos)} photos with legacy job-based keys:")
        for photo in legacy_photos:
            print(f"  - Photo {photo.id} (owner: {photo.owner_id})")
            if photo.processed_key and not photo.processed_key.startswith("users/"):
                print(f"    processed_key: {photo.processed_key}")
            if photo.thumbnail_key and not photo.thumbnail_key.startswith("users/"):
                print(f"    thumbnail_key: {photo.thumbnail_key}")
        
        if args.delete:
            print(f"\n🗑️  Deleting {len(legacy_photos)} legacy photos...")
            for photo in legacy_photos:
                db.delete(photo)
            db.commit()
            print(f"✅ Deleted {len(legacy_photos)} legacy photos.")
        else:
            print(f"\n💡 This was a dry run. Use --delete to actually delete these photos.")
            print(f"   Run: python cleanup_legacy_photos.py --delete")
    
    finally:
        db.close()

if __name__ == "__main__":
    main()

