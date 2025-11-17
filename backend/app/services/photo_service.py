"""
Service helpers for working with Photo records.
"""

from __future__ import annotations

from typing import Iterable, List, Optional
from uuid import UUID as UUIDType

from loguru import logger
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.photo import Photo


class PhotoService:
    """
    Persistence helpers that ensure all access to Photo rows is scoped by owner.
    """

    VALID_STATUSES = {"uploaded", "processing", "ready", "archived", "deleted"}

    def create_photo(
        self,
        db: Session,
        *,
        owner_id: str,
        original_key: str,
        checksum_sha256: str,
        size_bytes: Optional[int] = None,
        mime_type: Optional[str] = None,
        storage_bucket: Optional[str] = None,
        processed_key: Optional[str] = None,
        thumbnail_key: Optional[str] = None,
        metadata: Optional[dict] = None,
        status: str = "uploaded",
        commit: bool = True,
    ) -> Photo:
        """
        Create a new photo scoped to a particular owner.
        """
        if status not in self.VALID_STATUSES:
            raise ValueError(f"Invalid photo status '{status}'")

        photo = Photo(
            owner_id=owner_id,
            original_key=original_key,
            checksum_sha256=checksum_sha256,
            size_bytes=size_bytes,
            mime_type=mime_type,
            storage_bucket=storage_bucket or "rekindle-uploads",
            processed_key=processed_key,
            thumbnail_key=thumbnail_key,
            metadata_json=metadata,
            status=status,
        )

        db.add(photo)
        try:
            if commit:
                db.commit()
                db.refresh(photo)
        except IntegrityError as exc:
            logger.warning(
                "Failed to create photo due to integrity error",
                exception=exc,
                owner_id=owner_id,
                original_key=original_key,
            )
            db.rollback()
            raise

        return photo

    def list_photos(
        self,
        db: Session,
        *,
        owner_id: str,
        statuses: Optional[Iterable[str]] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Photo]:
        """
        List photos for a user, optionally filtering by status.
        
        By default, excludes deleted photos. To include deleted photos,
        explicitly pass 'deleted' in the statuses parameter.
        """
        query = db.query(Photo).filter(Photo.owner_id == owner_id)

        if statuses:
            invalid_statuses = set(statuses) - self.VALID_STATUSES
            if invalid_statuses:
                raise ValueError(
                    f"Invalid status values: {', '.join(sorted(invalid_statuses))}"
                )
            query = query.filter(Photo.status.in_(tuple(statuses)))
        else:
            # By default, exclude deleted photos
            query = query.filter(Photo.status != "deleted")

        return (
            query.order_by(Photo.created_at.desc()).offset(offset).limit(limit).all()
        )

    def get_photo(
        self, db: Session, *, owner_id: str, photo_id: UUIDType
    ) -> Optional[Photo]:
        """
        Fetch a single photo scoped to the owner.
        """
        return (
            db.query(Photo)
            .filter(Photo.id == photo_id, Photo.owner_id == owner_id)
            .first()
        )

    def update_photo_status(
        self,
        db: Session,
        *,
        owner_id: str,
        photo_id: UUIDType,
        status: str,
        processed_key: Optional[str] = None,
        thumbnail_key: Optional[str] = None,
        metadata: Optional[dict] = None,
        commit: bool = True,
    ) -> Optional[Photo]:
        """
        Update a photo's status and related keys. Returns the updated photo or None if not found.
        """
        if status not in self.VALID_STATUSES:
            raise ValueError(f"Invalid photo status '{status}'")

        photo = self.get_photo(db, owner_id=owner_id, photo_id=photo_id)
        if not photo:
            return None

        photo.status = status
        if processed_key is not None:
            photo.processed_key = processed_key
        if thumbnail_key is not None:
            photo.thumbnail_key = thumbnail_key
        if metadata is not None:
            photo.metadata_json = metadata

        if commit:
            db.commit()
            db.refresh(photo)

        return photo

    def delete_photo(
        self, db: Session, *, owner_id: str, photo_id: UUIDType, commit: bool = True
    ) -> bool:
        """
        Soft delete a photo by marking its status as deleted.
        Returns True if the record was updated.
        """
        photo = self.get_photo(db, owner_id=owner_id, photo_id=photo_id)
        if not photo:
            return False

        photo.mark_deleted()

        if commit:
            db.commit()

        return True


# Singleton-style instance for import convenience
photo_service = PhotoService()

