"""
Tests for the photo service helpers
"""

import pytest
from sqlalchemy.exc import IntegrityError

from app.services.photo_service import photo_service


def test_create_photo_success(test_db_session):
    checksum = "f" * 64
    photo = photo_service.create_photo(
        test_db_session,
        owner_id="owner_1",
        original_key="users/owner_1/raw/photo.jpg",
        checksum_sha256=checksum,
        size_bytes=1024,
        mime_type="image/jpeg",
    )

    assert photo.id is not None
    assert photo.owner_id == "owner_1"
    assert photo.original_key == "users/owner_1/raw/photo.jpg"
    assert photo.status == "uploaded"
    assert photo.size_bytes == 1024
    assert photo.mime_type == "image/jpeg"


def test_create_photo_duplicate_key_same_owner(test_db_session):
    checksum1 = "0" * 64
    checksum2 = "1" * 64
    photo_service.create_photo(
        test_db_session,
        owner_id="owner_dup",
        original_key="users/owner_dup/raw/photo.jpg",
        checksum_sha256=checksum1,
    )

    with pytest.raises(IntegrityError):
        photo_service.create_photo(
            test_db_session,
            owner_id="owner_dup",
            original_key="users/owner_dup/raw/photo.jpg",
            checksum_sha256=checksum2,
        )


def test_create_photo_duplicate_key_different_owner(test_db_session):
    checksum1 = "2" * 64
    checksum2 = "3" * 64
    photo_service.create_photo(
        test_db_session,
        owner_id="owner_a",
        original_key="shared/raw/photo.jpg",
        checksum_sha256=checksum1,
    )

    photo = photo_service.create_photo(
        test_db_session,
        owner_id="owner_b",
        original_key="shared/raw/photo.jpg",
        checksum_sha256=checksum2,
    )

    assert photo.owner_id == "owner_b"


def test_list_photos_scoped_by_owner(test_db_session):
    # Create photos for multiple owners
    checksums = ["4" * 64, "5" * 64, "6" * 64]
    for idx, checksum in enumerate(checksums):
        photo_service.create_photo(
            test_db_session,
            owner_id="owner_list",
            original_key=f"users/owner_list/raw/photo_{idx}.jpg",
            checksum_sha256=checksum,
        )
    photo_service.create_photo(
        test_db_session,
        owner_id="other_owner",
        original_key="users/other_owner/raw/photo.jpg",
        checksum_sha256="7" * 64,
    )

    photos = photo_service.list_photos(test_db_session, owner_id="owner_list")

    assert len(photos) == 3
    assert all(photo.owner_id == "owner_list" for photo in photos)


def test_get_photo_enforces_owner(test_db_session):
    created = photo_service.create_photo(
        test_db_session,
        owner_id="owner_get",
        original_key="users/owner_get/raw/up.jpg",
        checksum_sha256="8" * 64,
    )

    found = photo_service.get_photo(
        test_db_session, owner_id="owner_get", photo_id=created.id
    )
    assert found is not None

    not_found = photo_service.get_photo(
        test_db_session, owner_id="other_owner", photo_id=created.id
    )
    assert not_found is None


def test_update_photo_status(test_db_session):
    created = photo_service.create_photo(
        test_db_session,
        owner_id="owner_update",
        original_key="users/owner_update/raw/up.jpg",
        checksum_sha256="9" * 64,
    )

    updated = photo_service.update_photo_status(
        test_db_session,
        owner_id="owner_update",
        photo_id=created.id,
        status="ready",
        processed_key="users/owner_update/processed/up.jpg",
    )

    assert updated is not None
    assert updated.status == "ready"
    assert updated.processed_key == "users/owner_update/processed/up.jpg"

    # Attempt another owner's update
    result = photo_service.update_photo_status(
        test_db_session,
        owner_id="someone_else",
        photo_id=created.id,
        status="archived",
    )
    assert result is None


def test_delete_photo_marks_status_deleted(test_db_session):
    photo = photo_service.create_photo(
        test_db_session,
        owner_id="owner_delete",
        original_key="users/owner_delete/raw/delete.jpg",
        checksum_sha256="a" * 64,
    )

    deleted = photo_service.delete_photo(
        test_db_session, owner_id="owner_delete", photo_id=photo.id
    )
    assert deleted is True

    refetched = photo_service.get_photo(
        test_db_session, owner_id="owner_delete", photo_id=photo.id
    )
    assert refetched is not None
    assert refetched.status == "deleted"


def test_invalid_status_raises_value_error(test_db_session):
    with pytest.raises(ValueError):
        photo_service.create_photo(
            test_db_session,
            owner_id="owner_invalid",
            original_key="users/owner_invalid/raw/photo.jpg",
            checksum_sha256="b" * 64,
            status="bad",
        )

    created = photo_service.create_photo(
        test_db_session,
        owner_id="owner_invalid",
        original_key="users/owner_invalid/raw/photo2.jpg",
        checksum_sha256="c" * 64,
    )

    with pytest.raises(ValueError):
        photo_service.update_photo_status(
            test_db_session,
            owner_id="owner_invalid",
            photo_id=created.id,
            status="unknown",
        )

