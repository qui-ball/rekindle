"""
Supabase webhook handler for user events.

Handles webhook events from Supabase Auth:
- user.created (INSERT)
- user.updated (UPDATE)
- user.deleted (DELETE)
"""

import hmac
import hashlib
import json
from typing import Dict, Any, Optional, Tuple
from fastapi import APIRouter, Request, HTTPException, status, Depends
from loguru import logger
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.api.v1.users import (
    _determine_monthly_credits,
    _determine_storage_limit,
)

router = APIRouter()


def verify_webhook_signature(payload_body: bytes, signature_header: str, secret: str) -> bool:
    """
    Verify Supabase webhook signature using HMAC SHA256.
    
    Supabase sends the signature in the x-supabase-signature header.
    The signature is computed as: HMAC-SHA256(payload_body, secret)
    
    Args:
        payload_body: Raw request body bytes
        signature_header: Signature from x-supabase-signature header
        secret: Webhook secret from Supabase
        
    Returns:
        True if signature is valid, False otherwise
    """
    if not secret:
        logger.warning("SUPABASE_WEBHOOK_SECRET not configured - skipping signature verification")
        return True  # Allow in development if secret not set
    
    try:
        # Compute expected signature
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            payload_body,
            hashlib.sha256
        ).hexdigest()
        
        # Use constant-time comparison to prevent timing attacks
        return hmac.compare_digest(expected_signature, signature_header)
    except Exception as e:
        logger.error(f"Error verifying webhook signature: {e}")
        return False


def _extract_name_from_metadata(metadata: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    """
    Extract first_name and last_name from metadata dict.
    
    Handles multiple formats:
    - first_name/last_name fields
    - name field (split on space)
    - full_name field (split on space)
    
    Returns:
        Tuple of (first_name, last_name)
    """
    first_name = metadata.get("first_name")
    last_name = metadata.get("last_name")
    
    # If name fields not found, try splitting name/full_name
    if not first_name or not last_name:
        name_value = metadata.get("name") or metadata.get("full_name")
        if name_value and isinstance(name_value, str):
            name_parts = name_value.strip().split(maxsplit=1)
            if not first_name and len(name_parts) > 0:
                first_name = name_parts[0]
            if not last_name and len(name_parts) > 1:
                last_name = name_parts[1]
    
    return first_name, last_name


def _extract_profile_image_url(metadata: Dict[str, Any]) -> Optional[str]:
    """Extract profile image URL from metadata."""
    return metadata.get("avatar_url") or metadata.get("picture") or metadata.get("avatar")


def extract_user_data_from_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract user data from Supabase auth.users record.
    
    Supabase auth.users table structure:
    - id (UUID) -> supabase_user_id
    - email
    - email_confirmed_at -> email_verified (boolean)
    - raw_user_meta_data -> first_name, last_name, profile_image_url
    - user_metadata -> alternative location for metadata
    - created_at
    - updated_at
    
    Args:
        record: User record from Supabase webhook
        
    Returns:
        Dictionary with user data mapped to our schema
    """
    # Extract basic fields
    supabase_user_id = record.get("id")
    email = record.get("email")
    email_confirmed_at = record.get("email_confirmed_at")
    
    # Extract metadata from both possible locations
    raw_meta = record.get("raw_user_meta_data") or {}
    user_meta = record.get("user_metadata") or {}
    
    # Combine metadata (user_metadata takes precedence)
    combined_meta = {**raw_meta, **user_meta}
    
    # Extract name fields
    first_name, last_name = _extract_name_from_metadata(combined_meta)
    
    # Extract profile image URL
    profile_image_url = _extract_profile_image_url(combined_meta)
    
    return {
        "supabase_user_id": supabase_user_id,
        "email": email,
        "email_verified": bool(email_confirmed_at),
        "first_name": first_name,
        "last_name": last_name,
        "profile_image_url": profile_image_url,
    }


@router.post("/supabase", status_code=200)
async def handle_supabase_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Handle Supabase webhook events for auth.users table.
    
    Expected events:
    - INSERT: New user created
    - UPDATE: User updated (email, metadata, etc.)
    - DELETE: User deleted
    
    Webhook signature verification:
    - Signature sent in x-supabase-signature header
    - Computed as HMAC-SHA256(payload_body, SUPABASE_WEBHOOK_SECRET)
    
    Payload structure:
    {
        "type": "INSERT" | "UPDATE" | "DELETE",
        "table": "users",
        "schema": "auth",
        "record": { ... },  # New/updated record
        "old_record": { ... }  # Previous record (UPDATE/DELETE only)
    }
    """
    # Get raw body for signature verification
    # Note: request.body() can only be read once, so we parse JSON from bytes
    body_bytes = await request.body()
    
    # Verify webhook signature
    signature_header = request.headers.get("x-supabase-signature", "")
    if not verify_webhook_signature(body_bytes, signature_header, settings.SUPABASE_WEBHOOK_SECRET):
        logger.warning(
            f"Invalid webhook signature: signature_header={signature_header[:20]}..."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature"
        )
    
    # Parse JSON payload from body bytes (since request.body() can only be read once)
    try:
        payload = json.loads(body_bytes.decode('utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        logger.error(f"Failed to parse webhook JSON: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )
    
    # Extract and validate event details
    event_type = payload.get("type")
    table = payload.get("table")
    schema = payload.get("schema")
    record = payload.get("record", {})
    old_record = payload.get("old_record")
    
    # Validate payload structure
    if not event_type:
        logger.error("Missing 'type' field in webhook payload")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required field: type"
        )
    
    if event_type not in ["INSERT", "UPDATE", "DELETE"]:
        logger.warning(f"Unknown event type: {event_type}")
        return {"status": "ignored", "reason": f"Unknown event type: {event_type}"}
    
    logger.info(
        f"Received Supabase webhook: type={event_type}, table={table}, schema={schema}"
    )
    
    # Validate this is an auth.users event
    if schema != "auth" or table != "users":
        logger.warning(
            f"Ignoring webhook for non-users table: schema={schema}, table={table}"
        )
        return {"status": "ignored", "reason": "Not a users table event"}
    
    # Validate record presence based on event type
    if event_type == "INSERT" and not record:
        logger.error("Missing 'record' field in INSERT event")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required field: record"
        )
    
    if event_type == "UPDATE" and not record:
        logger.error("Missing 'record' field in UPDATE event")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required field: record"
        )
    
    if event_type == "DELETE" and not old_record:
        logger.error("Missing 'old_record' field in DELETE event")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required field: old_record"
        )
    
    try:
        if event_type == "INSERT":
            # Handle user.created event
            return await handle_user_created(record, db)
        elif event_type == "UPDATE":
            # Handle user.updated event
            return await handle_user_updated(record, old_record, db)
        elif event_type == "DELETE":
            # Handle user.deleted event
            return await handle_user_deleted(old_record, db)
        else:
            logger.warning(f"Unknown event type: {event_type}")
            return {"status": "ignored", "reason": f"Unknown event type: {event_type}"}
            
    except Exception as e:
        logger.error(f"Error processing Supabase webhook: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing webhook: {str(e)}"
        )


async def handle_user_created(record: Dict[str, Any], db: Session) -> Dict[str, Any]:
    """
    Handle user.created event (INSERT).
    
    Creates a new user in the backend database with free tier defaults.
    """
    logger.info(f"Processing user.created event: record_id={record.get('id')}")
    
    # Extract user data from Supabase record
    user_data = extract_user_data_from_record(record)
    
    if not user_data.get("supabase_user_id") or not user_data.get("email"):
        logger.error(f"Missing required fields in user record: {user_data}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required fields: supabase_user_id or email"
        )
    
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.supabase_user_id == user_data["supabase_user_id"]) | 
        (User.email == user_data["email"])
    ).first()
    
    if existing_user:
        logger.info(
            f"User already exists: id={existing_user.id}, "
            f"supabase_user_id={existing_user.supabase_user_id}"
        )
        return {
            "status": "success",
            "action": "skipped",
            "reason": "User already exists",
            "user_id": str(existing_user.id),
        }
    
    # Determine tier and initialize defaults
    tier = "free"  # New users always start with free tier
    
    monthly_credits = _determine_monthly_credits(
        tier=tier,
        requested=3  # Default for new users
    )
    
    storage_limit = _determine_storage_limit(
        tier=tier,
        requested=0  # Default for new users
    )
    
    # Create new user
    try:
        new_user = User(
            supabase_user_id=user_data["supabase_user_id"],
            email=user_data["email"],
            email_verified=user_data["email_verified"],
            first_name=user_data.get("first_name"),
            last_name=user_data.get("last_name"),
            profile_image_url=user_data.get("profile_image_url"),
            subscription_tier=tier,
            subscription_status="active",
            monthly_credits=monthly_credits,
            topup_credits=0,
            storage_limit_bytes=storage_limit,
            storage_used_bytes=0,
            account_status="active",
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        logger.info(
            f"User created via webhook: id={new_user.id}, "
            f"supabase_user_id={new_user.supabase_user_id}, email={new_user.email}"
        )
        
        return {
            "status": "success",
            "action": "created",
            "user_id": str(new_user.id),
            "email": new_user.email,
        }
        
    except IntegrityError as e:
        db.rollback()
        # Handle race condition: user might have been created between check and insert
        logger.warning(
            f"Integrity error during user creation (possible race condition): {e}. "
            f"Attempting to fetch existing user."
        )
        
        existing_user = db.query(User).filter(
            (User.supabase_user_id == user_data["supabase_user_id"]) | 
            (User.email == user_data["email"])
        ).first()
        
        if existing_user:
            logger.info(f"Found existing user after integrity error: id={existing_user.id}")
            return {
                "status": "success",
                "action": "skipped",
                "reason": "User created concurrently",
                "user_id": str(existing_user.id),
            }
        
        logger.error(
            f"Failed to create user and could not find existing user: "
            f"supabase_user_id={user_data['supabase_user_id']}, email={user_data['email']}, error={e}"
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already exists or conflict occurred"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating user via webhook: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )


async def handle_user_updated(
    record: Dict[str, Any], 
    old_record: Optional[Dict[str, Any]], 
    db: Session
) -> Dict[str, Any]:
    """
    Handle user.updated event (UPDATE).
    
    Updates user data in backend database when Supabase user is updated.
    """
    supabase_user_id = record.get("id")
    if not supabase_user_id:
        logger.error("Missing supabase_user_id in UPDATE event")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing supabase_user_id in record"
        )
    
    logger.info(f"Processing user.updated event: supabase_user_id={supabase_user_id}")
    
    # Find user in database
    user = db.query(User).filter(User.supabase_user_id == supabase_user_id).first()
    
    if not user:
        logger.warning(
            f"User not found for UPDATE event: supabase_user_id={supabase_user_id}. "
            f"Creating new user instead."
        )
        # Create user if not found (shouldn't happen, but handle gracefully)
        return await handle_user_created(record, db)
    
    # Extract updated user data
    user_data = extract_user_data_from_record(record)
    
    # Track what fields are being updated
    updated_fields = []
    
    # Update email if changed
    if user_data.get("email") and user_data["email"] != user.email:
        user.email = user_data["email"]
        updated_fields.append("email")
    
    # Update email_verified if changed
    if user_data.get("email_verified") is not None and user_data["email_verified"] != user.email_verified:
        user.email_verified = user_data["email_verified"]
        updated_fields.append("email_verified")
    
    # Update name fields if changed
    if user_data.get("first_name") != user.first_name:
        user.first_name = user_data.get("first_name")
        updated_fields.append("first_name")
    
    if user_data.get("last_name") != user.last_name:
        user.last_name = user_data.get("last_name")
        updated_fields.append("last_name")
    
    # Update profile image if changed
    if user_data.get("profile_image_url") != user.profile_image_url:
        user.profile_image_url = user_data.get("profile_image_url")
        updated_fields.append("profile_image_url")
    
    if not updated_fields:
        logger.debug(f"No fields changed for user {user.id}")
        return {
            "status": "success",
            "action": "no_changes",
            "user_id": str(user.id),
        }
    
    try:
        db.commit()
        db.refresh(user)
        
        logger.info(
            f"User updated via webhook: id={user.id}, "
            f"updated_fields={updated_fields}"
        )
        
        return {
            "status": "success",
            "action": "updated",
            "user_id": str(user.id),
            "updated_fields": updated_fields,
        }
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(
            f"Database error updating user via webhook: id={user.id}, error={e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while updating user"
        )
    except Exception as e:
        db.rollback()
        logger.error(
            f"Unexpected error updating user via webhook: id={user.id}, error={e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )


async def handle_user_deleted(
    old_record: Optional[Dict[str, Any]], 
    db: Session
) -> Dict[str, Any]:
    """
    Handle user.deleted event (DELETE).
    
    Marks user account as deleted (soft delete) or schedules deletion.
    """
    if not old_record:
        logger.error("Missing old_record in DELETE event")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing old_record in DELETE event"
        )
    
    supabase_user_id = old_record.get("id")
    if not supabase_user_id:
        logger.error("Missing supabase_user_id in old_record")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing supabase_user_id in old_record"
        )
    
    logger.info(f"Processing user.deleted event: supabase_user_id={supabase_user_id}")
    
    # Find user in database
    user = db.query(User).filter(User.supabase_user_id == supabase_user_id).first()
    
    if not user:
        logger.warning(
            f"User not found for DELETE event: supabase_user_id={supabase_user_id}"
        )
        return {
            "status": "success",
            "action": "skipped",
            "reason": "User not found in database",
        }
    
    # Mark account as deleted (soft delete)
    # Note: We don't hard delete immediately - we mark for deletion
    # The actual deletion happens via the scheduled task (30-day grace period)
    from datetime import datetime, timezone
    
    if not user.deletion_requested_at:
        user.deletion_requested_at = datetime.now(timezone.utc)
        user.account_status = "deleted"
        
        try:
            db.commit()
            db.refresh(user)
            
            logger.info(
                f"User marked as deleted via webhook: id={user.id}, "
                f"deletion_requested_at={user.deletion_requested_at}"
            )
            
            return {
                "status": "success",
                "action": "deleted",
                "user_id": str(user.id),
                "deletion_requested_at": user.deletion_requested_at.isoformat(),
            }
            
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(
                f"Database error deleting user via webhook: id={user.id}, error={e}",
                exc_info=True
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error occurred while deleting user"
            )
    else:
        logger.info(
            f"User {user.id} already marked for deletion at {user.deletion_requested_at}"
        )
        return {
            "status": "success",
            "action": "already_deleted",
            "user_id": str(user.id),
            "deletion_requested_at": user.deletion_requested_at.isoformat(),
        }

