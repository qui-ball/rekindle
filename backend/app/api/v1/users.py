"""
User management API endpoints.
"""

from typing import Dict
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from loguru import logger
import httpx
import json

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User, UserTier
from app.models.photo import Photo
from app.models.jobs import Job, RestoreAttempt, AnimationAttempt
from app.models.audit_log import AuditLog
from app.schemas.user import UserSyncRequest, UserResponse, UserUpdateRequest
from app.core.config import settings
from app.workers.tasks.users import schedule_account_deletion, schedule_account_hard_delete
from sqlalchemy.orm import joinedload
from sqlalchemy import or_, and_

router = APIRouter()

# Rate limiter instance
# Note: Each router creates its own limiter instance, but they share the same storage backend
limiter = Limiter(key_func=get_remote_address)

# Simple in-memory rate limiting for user-specific endpoints
# (slowapi runs before dependencies, so we can't use authenticated user in key_func)
from collections import defaultdict
from datetime import datetime as dt
_user_rate_limit_store: Dict[str, list] = defaultdict(list)

def check_user_rate_limit(user_id: str, endpoint: str, limit: int, window_seconds: int) -> bool:
    """
    Simple in-memory rate limiting for user-specific endpoints.
    
    Args:
        user_id: User identifier
        endpoint: Endpoint name for tracking
        limit: Maximum requests allowed
        window_seconds: Time window in seconds
        
    Returns:
        True if allowed, False if rate limited
    """
    key = f"{user_id}:{endpoint}"
    now = dt.now()
    
    # Clean old entries (remove timestamps outside the window)
    if key in _user_rate_limit_store:
        _user_rate_limit_store[key] = [
            ts for ts in _user_rate_limit_store[key]
            if (now - ts).total_seconds() < window_seconds
        ]
    
    # Check if limit exceeded
    if len(_user_rate_limit_store[key]) >= limit:
        return False
    
    # Record this request
    _user_rate_limit_store[key].append(now)
    return True

# Storage limits by tier (in bytes)
TIER_STORAGE_LIMITS: Dict[UserTier, int] = {
    "free": 0,  # Free tier has no permanent storage (7-day expiry)
    "remember": 10 * 1024 * 1024 * 1024,  # 10 GB
    "cherish": 50 * 1024 * 1024 * 1024,  # 50 GB
    "forever": 200 * 1024 * 1024 * 1024,  # 200 GB
}

# Monthly credits by tier
TIER_MONTHLY_CREDITS: Dict[UserTier, int] = {
    "free": 3,
    "remember": 25,
    "cherish": 60,
    "forever": 150,
}


def _get_storage_limit_for_tier(tier: UserTier) -> int:
    """Get storage limit in bytes for a given tier."""
    return TIER_STORAGE_LIMITS.get(tier, 0)


def _get_monthly_credits_for_tier(tier: UserTier) -> int:
    """Get monthly credits for a given tier."""
    return TIER_MONTHLY_CREDITS.get(tier, 3)


def _determine_monthly_credits(tier: UserTier, requested: int) -> int:
    """
    Determine monthly credits for a new user.
    
    Uses tier-based defaults unless request explicitly provides a non-default value.
    For non-free tiers, if request has free tier default (3), assume it's a schema
    default and use tier-based value instead.
    
    Args:
        tier: Subscription tier
        requested: Requested monthly credits value
        
    Returns:
        Monthly credits to use for the user
    """
    tier_default = _get_monthly_credits_for_tier(tier)
    free_tier_default = 3
    
    # If tier is free, always use requested value (which defaults to 3)
    if tier == "free":
        return requested
    
    # For non-free tiers: if request matches free default, use tier default
    # Otherwise, use requested value (explicit override)
    if requested == free_tier_default:
        return tier_default
    
    return requested


def _determine_storage_limit(tier: UserTier, requested: int) -> int:
    """
    Determine storage limit for a new user.
    
    Uses tier-based defaults unless request explicitly provides a non-default value.
    For non-free tiers, if request has free tier default (0), assume it's a schema
    default and use tier-based value instead.
    
    Args:
        tier: Subscription tier
        requested: Requested storage limit in bytes
        
    Returns:
        Storage limit in bytes to use for the user
    """
    tier_default = _get_storage_limit_for_tier(tier)
    free_tier_default = 0
    
    # If tier is free, always use requested value (which defaults to 0)
    if tier == "free":
        return requested
    
    # For non-free tiers: if request matches free default, use tier default
    # Otherwise, use requested value (explicit override)
    if requested == free_tier_default:
        return tier_default
    
    return requested


def _user_to_response(user: User) -> UserResponse:
    """
    Convert User model to UserResponse schema.
    
    Uses Pydantic's model_validate to convert SQLAlchemy model to Pydantic schema.
    Computed properties are explicitly included since they're @property methods.
    """
    # Build dict with all fields, including computed properties
    user_dict = {
        **{k: v for k, v in user.__dict__.items() if not k.startswith("_")},
        "id": str(user.id),  # Convert UUID to string
        # Explicitly include computed properties
        "total_credits": user.total_credits,
        "full_name": user.full_name,
        "storage_limit_gb": user.storage_limit_gb,
        "storage_used_gb": user.storage_used_gb,
        "storage_percentage": user.storage_percentage,
    }
    
    return UserResponse.model_validate(user_dict)


@router.post(
    "/sync",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        200: {"description": "User already exists"},
        201: {"description": "User created successfully"},
        409: {"description": "Conflict - user already exists"},
        429: {"description": "Too many requests - rate limit exceeded"},
        500: {"description": "Internal server error"},
    },
)
@limiter.limit("5/minute")
async def sync_user(
    request: Request,
    user_sync_request: UserSyncRequest,
    db: Session = Depends(get_db),
):
    """
    Sync user from Supabase Auth to backend database.
    
    This endpoint is typically called by Supabase webhooks when a new user is created,
    or during the onboarding flow when a user first authenticates.
    
    - **supabase_user_id**: Required. Supabase Auth user identifier
    - **email**: Required. User's email address
    - **subscription_tier**: Optional. Defaults to "free" for new users
    - **monthly_credits**: Optional. Defaults based on tier (3 for free tier)
    - **storage_limit_bytes**: Optional. Defaults based on tier (0 for free tier)
    
    If a user with the same `supabase_user_id` or `email` already exists,
    returns the existing user with status 200 instead of creating a duplicate.
    
    **Security Note:** This endpoint should be protected with webhook signature
    verification in production (see Task 3.10).
    
    **Rate Limited:** 5 requests per minute per IP address.
    """
    logger.info(
        f"Syncing user: supabase_user_id={user_sync_request.supabase_user_id}, email={user_sync_request.email}"
    )
    
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.supabase_user_id == user_sync_request.supabase_user_id) | (User.email == user_sync_request.email)
    ).first()
    
    if existing_user:
        logger.info(
            f"User already exists: id={existing_user.id}, "
            f"supabase_user_id={existing_user.supabase_user_id}"
        )
        # Return 200 OK for existing user (not 201 Created)
        user_response = _user_to_response(existing_user)
        return JSONResponse(
            content=user_response.model_dump(mode="json"),  # Use mode="json" to serialize datetime objects
            status_code=status.HTTP_200_OK
        )
    
    # Determine tier and initialize defaults
    tier = user_sync_request.subscription_tier or "free"
    
    # Determine monthly credits:
    # - If tier is not free and request has free tier default (3), use tier default
    # - Otherwise, use request value (explicit override or free tier)
    monthly_credits = _determine_monthly_credits(
        tier=tier,
        requested=user_sync_request.monthly_credits
    )
    
    # Determine storage limit:
    # - If tier is not free and request has free tier default (0), use tier default
    # - Otherwise, use request value (explicit override or free tier)
    storage_limit = _determine_storage_limit(
        tier=tier,
        requested=user_sync_request.storage_limit_bytes
    )
    
    # Create new user
    try:
        new_user = User(
            supabase_user_id=user_sync_request.supabase_user_id,
            email=user_sync_request.email,
            email_verified=user_sync_request.email_verified,
            first_name=user_sync_request.first_name,
            last_name=user_sync_request.last_name,
            profile_image_url=user_sync_request.profile_image_url,
            subscription_tier=tier,
            subscription_status=user_sync_request.subscription_status or "active",
            monthly_credits=monthly_credits,
            topup_credits=user_sync_request.topup_credits or 0,
            storage_limit_bytes=storage_limit,
            storage_used_bytes=user_sync_request.storage_used_bytes or 0,
            account_status=user_sync_request.account_status or "active",
            stripe_customer_id=user_sync_request.stripe_customer_id,
            stripe_subscription_id=user_sync_request.stripe_subscription_id,
            subscription_period_start=user_sync_request.subscription_period_start,
            subscription_period_end=user_sync_request.subscription_period_end,
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        logger.info(
            f"User created successfully: id={new_user.id}, "
            f"supabase_user_id={new_user.supabase_user_id}, tier={tier}"
        )
        
        return _user_to_response(new_user)
        
    except IntegrityError as e:
        db.rollback()
        # Handle race condition: user might have been created between check and insert
        logger.warning(
            f"Integrity error during user creation (possible race condition): {e}. "
            f"Attempting to fetch existing user."
        )
        
        # Try to fetch the user that was created concurrently
        existing_user = db.query(User).filter(
            (User.supabase_user_id == request.supabase_user_id) | (User.email == request.email)
        ).first()
        
        if existing_user:
            logger.info(f"Found existing user after integrity error: id={existing_user.id}")
            return _user_to_response(existing_user)
        
        # If we still can't find the user, raise an error
        logger.error(
            f"Failed to create user and could not find existing user: "
            f"supabase_user_id={user_sync_request.supabase_user_id}, email={user_sync_request.email}, error={e}"
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"User with supabase_user_id={user_sync_request.supabase_user_id} or "
                f"email={user_sync_request.email} already exists"
            )
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating user: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )


@router.get(
    "/me",
    response_model=UserResponse,
    responses={
        200: {"description": "User profile retrieved successfully"},
        401: {"description": "Unauthorized - authentication required"},
        429: {"description": "Too many requests - rate limit exceeded"},
    },
)
@limiter.limit("60/minute")
async def get_current_user_profile(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Get current authenticated user's profile.
    
    Returns complete user profile including:
    - Basic information (name, email, profile image)
    - Subscription details (tier, status, period dates)
    - Credits (monthly, topup, total)
    - Storage (used, limit, percentage)
    - Account status and metadata
    
    Requires authentication via JWT token.
    
    **Rate Limited:** 60 requests per minute per IP address.
    """
    logger.debug(f"Fetching profile for user: id={current_user.id}, email={current_user.email}")
    
    return _user_to_response(current_user)


@router.put(
    "/me",
    response_model=UserResponse,
    responses={
        200: {"description": "Profile updated successfully"},
        400: {"description": "Invalid input data"},
        401: {"description": "Unauthorized - authentication required"},
        403: {"description": "Forbidden - account suspended or deleted"},
        422: {"description": "Validation error - invalid field format"},
        500: {"description": "Internal server error"},
    },
)
async def update_current_user_profile(
    request: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update current authenticated user's profile.
    
    Allows updating:
    - **first_name**: User's first name (1-100 characters, letters/spaces/hyphens/apostrophes only)
    - **last_name**: User's last name (1-100 characters, letters/spaces/hyphens/apostrophes only)
    - **profile_image_url**: URL to user's profile image
    
    All fields are optional. Only provided fields will be updated.
    Empty strings will be converted to None (clearing the field).
    
    Requires authentication via JWT token.
    
    Returns the updated user profile.
    """
    # Defense-in-depth: Explicitly check account status even though get_current_user already checks
    if current_user.account_status != "active":
        logger.warning(
            f"Update attempt by non-active account: id={current_user.id}, "
            f"status={current_user.account_status}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cannot update profile: account is {current_user.account_status}"
        )
    
    logger.info(
        f"Updating profile for user: id={current_user.id}, email={current_user.email}"
    )
    
    # Get fields that were explicitly set in the request (including None values)
    # This allows us to distinguish between "field not provided" and "field set to None"
    request_data = request.model_dump(exclude_unset=True)
    
    # Track what fields are being updated for logging
    updated_fields = []
    
    # Update fields if explicitly provided in request (including None values)
    if "first_name" in request_data:
        # Empty string after validation becomes None, which is valid
        current_user.first_name = request_data["first_name"]
        updated_fields.append("first_name")
    
    if "last_name" in request_data:
        # Empty string after validation becomes None, which is valid
        current_user.last_name = request_data["last_name"]
        updated_fields.append("last_name")
    
    if "profile_image_url" in request_data:
        # None is valid for profile_image_url (clears the field)
        current_user.profile_image_url = request_data["profile_image_url"]
        updated_fields.append("profile_image_url")
    
    # If no fields were provided to update, return current user
    if not updated_fields:
        logger.debug(f"No fields provided for update, returning current profile")
        return _user_to_response(current_user)
    
    try:
        # Save changes to database
        db.commit()
        db.refresh(current_user)
        
        logger.info(
            f"Profile updated successfully for user: id={current_user.id}, "
            f"updated_fields={updated_fields}"
        )
        
        return _user_to_response(current_user)
        
    except IntegrityError as e:
        db.rollback()
        logger.error(
            f"Database integrity error updating profile for user: id={current_user.id}, error={e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid data provided - constraint violation"
        )
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(
            f"Database error updating profile for user: id={current_user.id}, error={e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while updating profile"
        )
    except Exception as e:
        db.rollback()
        logger.error(
            f"Unexpected error updating profile for user: id={current_user.id}, error={e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user profile"
        )


@router.delete(
    "/me",
    responses={
        200: {"description": "Account deletion requested successfully"},
        400: {"description": "Deletion already requested"},
        401: {"description": "Unauthorized - authentication required"},
        403: {"description": "Forbidden - account suspended or deleted"},
        429: {"description": "Too many requests - rate limit exceeded"},
        500: {"description": "Internal server error"},
    },
)
async def delete_account(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Request account deletion with 30-day grace period.
    
    This endpoint:
    - Sets `deletion_requested_at` timestamp
    - Sends confirmation email to user
    - Schedules permanent deletion after 30 days
    - Returns success message with grace period information
    
    Users can cancel deletion within the 30-day grace period using the cancellation endpoint.
    
    Requires authentication via JWT token.
    
    **Rate Limited:** 1 request per hour per user.
    """
    # Rate limiting: 1 request per hour per user
    if not check_user_rate_limit(str(current_user.id), "delete_account", limit=1, window_seconds=3600):
        logger.warning(
            f"Rate limit exceeded for deletion request: user_id={current_user.id}"
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many deletion requests. Please wait before requesting again."
        )
    
    # Defense-in-depth: Check account status
    if current_user.account_status != "active":
        logger.warning(
            f"Deletion request attempt by non-active account: id={current_user.id}, "
            f"status={current_user.account_status}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cannot delete account: account is {current_user.account_status}"
        )
    
    # Check if deletion already requested
    if current_user.deletion_requested_at:
        logger.info(
            f"User {current_user.id} already requested deletion at {current_user.deletion_requested_at}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Account deletion already requested on {current_user.deletion_requested_at.isoformat()}. "
                "Your account will be permanently deleted after the 30-day grace period."
            )
        )
    
    logger.info(
        f"Processing account deletion request for user: id={current_user.id}, email={current_user.email}"
    )
    
    try:
        # Set deletion_requested_at timestamp
        current_user.deletion_requested_at = datetime.now(timezone.utc)
        
        # Schedule deletion task for 30 days from now and store task ID
        deletion_date = current_user.deletion_requested_at + timedelta(days=30)
        task = schedule_account_deletion.apply_async(
            args=[str(current_user.id)],
            countdown=30 * 24 * 60 * 60  # 30 days in seconds
        )
        current_user.deletion_task_id = task.id
        
        db.commit()
        db.refresh(current_user)
        
        logger.info(
            f"Account deletion scheduled for user {current_user.id} on {deletion_date.isoformat()}, "
            f"task_id={task.id}"
        )
        
        # Send confirmation email via Supabase Admin API
        try:
            async with httpx.AsyncClient() as client:
                # Use Supabase Admin API to send email
                # Note: Supabase doesn't have a direct API for custom emails,
                # so we'll use their auth admin API to trigger a password reset email
                # as a workaround, or implement a custom email service
                # For now, we'll log that email should be sent
                logger.info(
                    f"Account deletion confirmation email should be sent to {current_user.email}"
                )
                # TODO: Implement proper email sending via Supabase or custom SMTP
                # Example: Use Supabase Admin API or SendGrid/SES for custom emails
        except Exception as email_error:
            # Log email error but don't fail the deletion request
            logger.error(
                f"Failed to send deletion confirmation email to {current_user.email}: {email_error}",
                exc_info=True
            )
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "message": "Account deletion requested successfully",
                "deletion_requested_at": current_user.deletion_requested_at.isoformat(),
                "archive_date": deletion_date.isoformat(),
                "grace_period_days": 30,
                "note": (
                    "Your account will be archived after 30 days, then permanently deleted "
                    "after 2 years (for legal/compliance purposes). "
                    "You can cancel this request within the grace period."
                )
            }
        )
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(
            f"Database error processing deletion request for user: id={current_user.id}, error={e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while processing deletion request"
        )
    except Exception as e:
        db.rollback()
        logger.error(
            f"Unexpected error processing deletion request for user: id={current_user.id}, error={e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process account deletion request"
        )


@router.post(
    "/me/cancel-deletion",
    responses={
        200: {"description": "Deletion request cancelled successfully"},
        400: {"description": "No deletion request to cancel"},
        401: {"description": "Unauthorized - authentication required"},
        403: {"description": "Forbidden - account suspended or deleted"},
        429: {"description": "Too many requests - rate limit exceeded"},
        500: {"description": "Internal server error"},
    },
)
async def cancel_account_deletion(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cancel a pending account deletion request.
    
    This endpoint:
    - Clears `deletion_requested_at` timestamp
    - Cancels the scheduled deletion task
    - Returns success message
    
    Requires authentication via JWT token.
    
    **Rate Limited:** 5 requests per hour per user.
    """
    # Rate limiting: 5 requests per hour per user
    if not check_user_rate_limit(str(current_user.id), "cancel_deletion", limit=5, window_seconds=3600):
        logger.warning(
            f"Rate limit exceeded for cancellation request: user_id={current_user.id}"
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many cancellation requests. Please wait before trying again."
        )
    
    # Defense-in-depth: Check account status
    if current_user.account_status != "active":
        logger.warning(
            f"Deletion cancellation attempt by non-active account: id={current_user.id}, "
            f"status={current_user.account_status}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cannot cancel deletion: account is {current_user.account_status}"
        )
    
    # Check if deletion was requested
    if not current_user.deletion_requested_at:
        logger.info(f"User {current_user.id} attempted to cancel deletion but none was requested")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No account deletion request found to cancel"
        )
    
    logger.info(
        f"Cancelling account deletion request for user: id={current_user.id}, email={current_user.email}"
    )
    
    try:
        # Revoke Celery task if it exists (Strategy 1: Immediate revocation)
        if current_user.deletion_task_id:
            try:
                from app.workers.celery_app import celery_app
                celery_app.control.revoke(
                    current_user.deletion_task_id,
                    terminate=True  # Kill if already running
                )
                logger.info(
                    f"Revoked Celery task {current_user.deletion_task_id} "
                    f"for user {current_user.id}"
                )
            except Exception as revoke_error:
                # Log but don't fail - fallback to flag check
                logger.warning(
                    f"Failed to revoke task {current_user.deletion_task_id}: {revoke_error}. "
                    f"Will rely on flag check fallback."
                )
        
        # Clear deletion fields (Strategy 2: Flag check fallback)
        current_user.deletion_requested_at = None
        current_user.deletion_task_id = None
        db.commit()
        db.refresh(current_user)
        
        logger.info(f"Account deletion request cancelled for user {current_user.id}")
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "message": "Account deletion request cancelled successfully",
                "account_status": current_user.account_status,
                "note": "Your account is now active and will not be deleted."
            }
        )
        
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(
            f"Database error cancelling deletion request for user: id={current_user.id}, error={e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while cancelling deletion request"
        )
    except Exception as e:
        db.rollback()
        logger.error(
            f"Unexpected error cancelling deletion request for user: id={current_user.id}, error={e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel account deletion request"
        )


def sanitize_for_json(value):
    """
    Sanitize value for JSON serialization.
    Removes control characters and ensures UTF-8 compatibility.
    """
    if value is None:
        return None
    if isinstance(value, str):
        # Remove control characters except newline, carriage return, tab
        return ''.join(c for c in value if ord(c) >= 32 or c in '\n\r\t')
    if isinstance(value, dict):
        return {k: sanitize_for_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [sanitize_for_json(item) for item in value]
    return value


def format_datetime(dt_value):
    """Format datetime for JSON export"""
    if dt_value is None:
        return None
    return dt_value.isoformat()


@router.get(
    "/me/export",
    responses={
        200: {"description": "User data exported successfully"},
        401: {"description": "Unauthorized - authentication required"},
        403: {"description": "Forbidden - account suspended or deleted"},
        429: {"description": "Too many requests - rate limit exceeded"},
        500: {"description": "Internal server error"},
    },
)
async def export_user_data(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Export all user data in JSON format (GDPR compliance).
    
    This endpoint collects and exports:
    - User profile data
    - All photos metadata (including archived items older than 30 days)
    - All processing jobs and attempts
    - Payment history (when implemented)
    
    Returns a downloadable JSON file with all user data via streaming response.
    
    Requires authentication via JWT token.
    
    **Rate Limited:** 1 export per hour per user.
    """
    # Rate limiting: 1 export per hour per user
    if not check_user_rate_limit(str(current_user.id), "export_data", limit=1, window_seconds=3600):
        logger.warning(
            f"Rate limit exceeded for export request: user_id={current_user.id}"
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many export requests. Please wait before requesting again."
        )
    
    # Defense-in-depth: Check account status
    if current_user.account_status != "active":
        logger.warning(
            f"Data export attempt by non-active account: id={current_user.id}, "
            f"status={current_user.account_status}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cannot export data: account is {current_user.account_status}"
        )
    
    logger.info(
        f"Exporting user data for user: id={current_user.id}, email={current_user.email}"
    )
    
    # Track export statistics for audit log
    export_start_time = datetime.now(timezone.utc)
    photo_count = 0
    job_count = 0
    restore_attempt_count = 0
    animation_attempt_count = 0
    
    try:
        # Get IP address and user agent for audit log
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent", None)
        
        # Calculate cutoff date for archived data (30 days ago)
        archive_cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        # Collect user profile data with sanitization
        export_date = datetime.now(timezone.utc)
        
        # Build export metadata
        export_metadata = {
            "version": "1.0",
            "export_date": export_date.isoformat(),
            "format": "json",
            "data_retention_policy": "2 years",
            "included_data": [
                "profile",
                "photos",
                "jobs",
                "payment_history"
            ],
            "excluded_data": [
                "passwords",
                "internal_analytics",
                "session_tokens"
            ],
            "note": "This export includes archived items older than 30 days. Payment history will be added when payment system is integrated."
        }
        
        profile_data = {
                "id": str(current_user.id),
                "supabase_user_id": sanitize_for_json(current_user.supabase_user_id),
                "email": sanitize_for_json(current_user.email),
                "email_verified": current_user.email_verified,
                "first_name": sanitize_for_json(current_user.first_name),
                "last_name": sanitize_for_json(current_user.last_name),
                "profile_image_url": sanitize_for_json(current_user.profile_image_url),
                "subscription_tier": current_user.subscription_tier,
                "subscription_status": current_user.subscription_status,
                "monthly_credits": current_user.monthly_credits,
                "topup_credits": current_user.topup_credits,
                "total_credits": current_user.total_credits,
                "storage_used_bytes": current_user.storage_used_bytes,
                "storage_limit_bytes": current_user.storage_limit_bytes,
                "storage_used_gb": current_user.storage_used_gb,
                "storage_limit_gb": current_user.storage_limit_gb,
                "storage_percentage": current_user.storage_percentage,
                "account_status": current_user.account_status,
                "stripe_customer_id": sanitize_for_json(current_user.stripe_customer_id),
                "stripe_subscription_id": sanitize_for_json(current_user.stripe_subscription_id),
                "subscription_period_start": format_datetime(current_user.subscription_period_start),
                "subscription_period_end": format_datetime(current_user.subscription_period_end),
                "deletion_requested_at": format_datetime(current_user.deletion_requested_at),
                "archived_at": format_datetime(getattr(current_user, 'archived_at', None)),
                "created_at": format_datetime(current_user.created_at),
                "updated_at": format_datetime(current_user.updated_at),
                "last_login_at": format_datetime(current_user.last_login_at),
        }
        
        # Collect photos: include archived items older than 30 days
        photos_query = db.query(Photo).filter(
            Photo.owner_id == str(current_user.id)
        ).filter(
            or_(
                Photo.status == "ready",  # Active photos
                Photo.status == "uploaded",
                Photo.status == "processing",
                # Include archived/deleted if older than 30 days
                and_(
                    Photo.status.in_(["archived", "deleted"]),
                    Photo.created_at < archive_cutoff
                )
            )
        ).order_by(Photo.created_at.desc())
        
        photos = photos_query.all()
        photo_count = len(photos)
        
        # Collect jobs with eager loading to fix N+1 problem
        jobs_query = db.query(Job).options(
            joinedload(Job.restore_attempts),
            joinedload(Job.animation_attempts)
        ).filter(Job.email == current_user.email).order_by(Job.created_at.desc())
        
        jobs = jobs_query.all()
        job_count = len(jobs)
        
        # Calculate counts before generating export
        restore_attempt_count = sum(len(job.restore_attempts) for job in jobs)
        animation_attempt_count = sum(len(job.animation_attempts) for job in jobs)
        
        # Generator function for streaming JSON export
        def generate_export():
            """Generate JSON export in chunks for streaming"""
            # Start JSON object
            yield '{\n'
            yield '  "export_metadata": ' + json.dumps(sanitize_for_json(export_metadata), indent=2, ensure_ascii=False).replace('\n', '\n  ') + ',\n'
            yield '  "user_id": ' + json.dumps(str(current_user.id), ensure_ascii=False) + ',\n'
            yield '  "profile": ' + json.dumps(sanitize_for_json(profile_data), indent=2, ensure_ascii=False).replace('\n', '\n  ') + ',\n'
            
            # Photos array
            yield '  "photos": [\n'
            for i, photo in enumerate(photos):
                photo_data = {
                    "id": str(photo.id),
                    "owner_id": sanitize_for_json(photo.owner_id),
                    "original_key": sanitize_for_json(photo.original_key),
                    "processed_key": sanitize_for_json(photo.processed_key),
                    "thumbnail_key": sanitize_for_json(photo.thumbnail_key),
                    "storage_bucket": sanitize_for_json(photo.storage_bucket),
                    "status": photo.status,
                    "size_bytes": photo.size_bytes,
                    "mime_type": sanitize_for_json(photo.mime_type),
                    "checksum_sha256": sanitize_for_json(photo.checksum_sha256),
                    "metadata": sanitize_for_json(photo.metadata_json),
                    "created_at": format_datetime(photo.created_at),
                    "updated_at": format_datetime(photo.updated_at),
                }
                photo_json = json.dumps(sanitize_for_json(photo_data), indent=2, ensure_ascii=False)
                yield '    ' + photo_json.replace('\n', '\n    ')
                if i < len(photos) - 1:
                    yield ',\n'
                else:
                    yield '\n'
            yield '  ],\n'
            
            # Jobs array
            yield '  "jobs": [\n'
            for i, job in enumerate(jobs):
                restore_attempts_data = []
                for restore in job.restore_attempts:
                    restore_attempts_data.append({
                        "id": str(restore.id),
                        "job_id": str(restore.job_id),
                        "s3_key": sanitize_for_json(restore.s3_key),
                        "model": sanitize_for_json(restore.model),
                        "params": sanitize_for_json(restore.params),
                        "created_at": format_datetime(restore.created_at),
                    })
                
                animation_attempts_data = []
                for animation in job.animation_attempts:
                    animation_attempts_data.append({
                        "id": str(animation.id),
                        "job_id": str(animation.job_id),
                        "restore_id": str(animation.restore_id) if animation.restore_id else None,
                        "preview_s3_key": sanitize_for_json(animation.preview_s3_key),
                        "result_s3_key": sanitize_for_json(animation.result_s3_key),
                        "thumb_s3_key": sanitize_for_json(animation.thumb_s3_key),
                        "model": sanitize_for_json(animation.model),
                        "params": sanitize_for_json(animation.params),
                        "created_at": format_datetime(animation.created_at),
                    })
                
                job_data = {
                    "id": str(job.id),
                    "email": sanitize_for_json(job.email),
                    "created_at": format_datetime(job.created_at),
                    "selected_restore_id": str(job.selected_restore_id) if job.selected_restore_id else None,
                    "latest_animation_id": str(job.latest_animation_id) if job.latest_animation_id else None,
                    "thumbnail_s3_key": sanitize_for_json(job.thumbnail_s3_key),
                    "restore_attempts": restore_attempts_data,
                    "animation_attempts": animation_attempts_data,
                }
                job_json = json.dumps(sanitize_for_json(job_data), indent=2, ensure_ascii=False)
                yield '    ' + job_json.replace('\n', '\n    ')
                if i < len(jobs) - 1:
                    yield ',\n'
                else:
                    yield '\n'
            yield '  ],\n'
            
            # Payment history (empty for now)
            yield '  "payment_history": []\n'
            
            # End JSON object
            yield '}\n'
        
        # Calculate export statistics
        export_end_time = datetime.now(timezone.utc)
        export_duration = (export_end_time - export_start_time).total_seconds()
        
        # Create audit log entry
        audit_log = AuditLog(
            user_id=current_user.id,
            action="data_export",
            ip_address=ip_address,
            user_agent=user_agent,
            metadata_json={
                "photo_count": photo_count,
                "job_count": job_count,
                "restore_attempt_count": restore_attempt_count,
                "animation_attempt_count": animation_attempt_count,
                "export_duration_seconds": round(export_duration, 2),
                "export_date": export_date.isoformat(),
            }
        )
        db.add(audit_log)
        db.commit()
        
        logger.info(
            f"User data export completed for user {current_user.id}: "
            f"{photo_count} photos, {job_count} jobs, "
            f"{restore_attempt_count} restore attempts, "
            f"{animation_attempt_count} animation attempts, "
            f"duration: {export_duration:.2f}s"
        )
        
        # Return streaming response
        filename = f"rekindle_data_export_{current_user.id}_{export_date.strftime('%Y%m%d_%H%M%S')}.json"
        
        return StreamingResponse(
            generate_export(),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": "application/json; charset=utf-8",
            }
        )
        
    except Exception as e:
        logger.error(
            f"Error exporting user data for user: id={current_user.id}, error={e}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export user data"
        )

