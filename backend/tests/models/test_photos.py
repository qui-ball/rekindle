"""
Tests for the Photo model
"""

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.photo import Photo


class TestPhotoModel:
    """Validate core Photo model behaviour."""

    def test_photo_creation(self, photo_factory):
        photo = photo_factory()

        assert photo.id is not None
        assert photo.owner_id == "test_user_123"
        assert photo.original_key == "users/test_user_123/raw/test.jpg"
        assert photo.status == "uploaded"
        assert photo.storage_bucket == "rekindle-uploads"
        assert len(photo.checksum_sha256) == 64
        assert photo.created_at is not None
        assert photo.updated_at is not None

    def test_unique_original_key_per_owner(self, test_db_session):
        photo1 = Photo(
            owner_id="user_one",
            original_key="users/user_one/raw/image.jpg",
            checksum_sha256="b" * 64,
        )
        photo2 = Photo(
            owner_id="user_one",
            original_key="users/user_one/raw/image.jpg",
            checksum_sha256="c" * 64,
        )

        test_db_session.add(photo1)
        test_db_session.commit()

        test_db_session.add(photo2)
        with pytest.raises(IntegrityError):
            test_db_session.commit()
        test_db_session.rollback()

        # Different owner should succeed
        photo3 = Photo(
            owner_id="user_two",
            original_key="users/user_one/raw/image.jpg",
            checksum_sha256="d" * 64,
        )
        test_db_session.add(photo3)
        test_db_session.commit()
        assert photo3.id is not None

    def test_status_constraint(self, test_db_session):
        photo = Photo(
            owner_id="user_three",
            original_key="users/user_three/raw/bad-status.jpg",
            checksum_sha256="e" * 64,
            status="invalid_status",
        )

        test_db_session.add(photo)
        with pytest.raises(IntegrityError):
            test_db_session.commit()
        test_db_session.rollback()


