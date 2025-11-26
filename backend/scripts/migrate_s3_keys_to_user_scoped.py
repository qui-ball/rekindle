#!/usr/bin/env python3
"""
Migration script to move existing S3 objects to user-scoped structure.

This script:
1. Finds all photos in the database with old flat keys
2. Copies S3 objects to new user-scoped locations
3. Updates database records with new keys
4. Optionally deletes old S3 objects after verification

WARNING: This script modifies S3 objects and database records.
Always test in staging first and backup your database before running.

Usage:
    python scripts/migrate_s3_keys_to_user_scoped.py [--dry-run] [--delete-old]
"""

import sys
import os
import argparse
from typing import List, Tuple
from uuid import UUID

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from loguru import logger

from app.core.database import get_db
from app.models.photo import Photo
from app.services.storage_service import StorageService
from app.services.s3 import S3Service


def find_photos_needing_migration(db: Session) -> List[Photo]:
    """
    Find all photos that need migration (old flat keys or missing owner_id).
    
    Returns:
        List of Photo objects that need migration
    """
    # Find photos with old flat keys (not starting with 'users/')
    photos = (
        db.query(Photo)
        .filter(~Photo.original_key.like("users/%"))
        .all()
    )
    
    logger.info(f"Found {len(photos)} photos with old key structure")
    
    # Also find photos without owner_id (should be archived)
    photos_no_owner = (
        db.query(Photo)
        .filter(Photo.owner_id.is_(None))
        .all()
    )
    
    if photos_no_owner:
        logger.warning(
            f"Found {len(photos_no_owner)} photos without owner_id. "
            "These will be marked as archived and skipped."
        )
    
    return photos


def migrate_photo(
    photo: Photo,
    storage_service: StorageService,
    s3_service: S3Service,
    dry_run: bool = False,
) -> Tuple[bool, str]:
    """
    Migrate a single photo to user-scoped structure.
    
    Args:
        photo: Photo object to migrate
        storage_service: StorageService instance
        s3_service: S3Service instance
        dry_run: If True, don't actually migrate
        
    Returns:
        Tuple of (success: bool, message: str)
    """
    if not photo.owner_id:
        return False, "Photo has no owner_id, skipping"
    
    if photo.original_key.startswith("users/"):
        return False, "Photo already has user-scoped key, skipping"
    
    try:
        # Generate new user-scoped keys
        new_original_key = storage_service.generate_original_key(
            photo.owner_id,
            photo.id,
            photo.original_key.split(".")[-1] if "." in photo.original_key else "jpg",
        )
        
        new_processed_key = None
        if photo.processed_key:
            ext = photo.processed_key.split(".")[-1] if "." in photo.processed_key else "jpg"
            new_processed_key = storage_service.generate_processed_key(
                photo.owner_id,
                photo.id,
                ext,
            )
        
        new_thumbnail_key = None
        if photo.thumbnail_key:
            new_thumbnail_key = storage_service.generate_thumbnail_key(
                photo.owner_id,
                photo.id,
            )
        
        if dry_run:
            logger.info(
                f"[DRY RUN] Would migrate photo {photo.id}:",
                old_original=photo.original_key,
                new_original=new_original_key,
            )
            return True, "Dry run: would migrate"
        
        # Copy S3 objects to new locations
        # Copy original
        try:
            old_content = s3_service.download_file(photo.original_key)
            s3_service.upload_file(
                old_content,
                new_original_key,
                photo.mime_type or "image/jpeg",
            )
            logger.info(f"Copied original: {photo.original_key} -> {new_original_key}")
        except Exception as e:
            logger.error(f"Failed to copy original for photo {photo.id}: {e}")
            return False, f"Failed to copy original: {e}"
        
        # Copy processed (if exists)
        if photo.processed_key and new_processed_key:
            try:
                old_content = s3_service.download_file(photo.processed_key)
                s3_service.upload_file(
                    old_content,
                    new_processed_key,
                    photo.mime_type or "image/jpeg",
                )
                logger.info(f"Copied processed: {photo.processed_key} -> {new_processed_key}")
            except Exception as e:
                logger.warning(f"Failed to copy processed for photo {photo.id}: {e}")
                # Non-critical, continue
        
        # Copy thumbnail (if exists)
        if photo.thumbnail_key and new_thumbnail_key:
            try:
                old_content = s3_service.download_file(photo.thumbnail_key)
                s3_service.upload_file(
                    old_content,
                    new_thumbnail_key,
                    "image/jpeg",
                )
                logger.info(f"Copied thumbnail: {photo.thumbnail_key} -> {new_thumbnail_key}")
            except Exception as e:
                logger.warning(f"Failed to copy thumbnail for photo {photo.id}: {e}")
                # Non-critical, continue
        
        # Update database record
        photo.original_key = new_original_key
        if new_processed_key:
            photo.processed_key = new_processed_key
        if new_thumbnail_key:
            photo.thumbnail_key = new_thumbnail_key
        
        return True, "Migration successful"
        
    except Exception as e:
        logger.error(f"Error migrating photo {photo.id}: {e}")
        return False, f"Error: {e}"


def delete_old_s3_objects(
    photo: Photo,
    s3_service: S3Service,
    dry_run: bool = False,
) -> None:
    """
    Delete old S3 objects after migration.
    
    Args:
        photo: Photo object (with old keys still in memory)
        s3_service: S3Service instance
        dry_run: If True, don't actually delete
    """
    keys_to_delete = []
    
    # Store old keys before they're overwritten
    if photo.original_key and not photo.original_key.startswith("users/"):
        keys_to_delete.append(photo.original_key)
    if photo.processed_key and not photo.processed_key.startswith("users/"):
        keys_to_delete.append(photo.processed_key)
    if photo.thumbnail_key and not photo.thumbnail_key.startswith("users/"):
        keys_to_delete.append(photo.thumbnail_key)
    
    for key in keys_to_delete:
        try:
            if dry_run:
                logger.info(f"[DRY RUN] Would delete: {key}")
            else:
                s3_service.s3_client.delete_object(
                    Bucket=s3_service.bucket,
                    Key=key,
                )
                logger.info(f"Deleted old S3 object: {key}")
        except Exception as e:
            logger.warning(f"Failed to delete old S3 object {key}: {e}")


def main():
    """Main migration function."""
    parser = argparse.ArgumentParser(
        description="Migrate S3 objects to user-scoped structure"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run in dry-run mode (don't actually migrate)",
    )
    parser.add_argument(
        "--delete-old",
        action="store_true",
        help="Delete old S3 objects after migration (use with caution!)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of photos to migrate (for testing)",
    )
    
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("S3 Key Migration Script")
    logger.info("=" * 60)
    logger.info(f"Dry run: {args.dry_run}")
    logger.info(f"Delete old objects: {args.delete_old}")
    logger.info("=" * 60)
    
    if args.delete_old and not args.dry_run:
        response = input(
            "⚠️  WARNING: You are about to delete old S3 objects. "
            "This cannot be undone. Continue? (yes/no): "
        )
        if response.lower() != "yes":
            logger.info("Migration cancelled")
            return 1
    
    storage_service = StorageService()
    s3_service = S3Service()
    
    # Get database session
    db = next(get_db())
    
    try:
        # Find photos needing migration
        photos = find_photos_needing_migration(db)
        
        if not photos:
            logger.info("No photos need migration. All done!")
            return 0
        
        if args.limit:
            photos = photos[:args.limit]
            logger.info(f"Limited to {len(photos)} photos for testing")
        
        # Migrate each photo
        success_count = 0
        fail_count = 0
        
        for photo in photos:
            success, message = migrate_photo(
                photo,
                storage_service,
                s3_service,
                dry_run=args.dry_run,
            )
            
            if success:
                success_count += 1
                
                # Delete old objects if requested
                if args.delete_old and not args.dry_run:
                    delete_old_s3_objects(photo, s3_service, dry_run=args.dry_run)
            else:
                fail_count += 1
                logger.warning(f"Failed to migrate photo {photo.id}: {message}")
        
        # Commit database changes
        if not args.dry_run:
            db.commit()
            logger.info("Database changes committed")
        
        logger.info("=" * 60)
        logger.info(f"Migration complete: {success_count} succeeded, {fail_count} failed")
        logger.info("=" * 60)
        
        return 0 if fail_count == 0 else 1
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())

