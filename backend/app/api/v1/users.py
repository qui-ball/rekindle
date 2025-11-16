"""
User management API endpoints.
"""

from typing import Dict
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from loguru import logger

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User, UserTier
from app.schemas.user import UserSyncRequest, UserResponse, UserUpdateRequest

router = APIRouter()

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
        500: {"description": "Internal server error"},
    },
)
async def sync_user(
    request: UserSyncRequest,
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
    """
    logger.info(
        f"Syncing user: supabase_user_id={request.supabase_user_id}, email={request.email}"
    )
    
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.supabase_user_id == request.supabase_user_id) | (User.email == request.email)
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
    tier = request.subscription_tier or "free"
    
    # Determine monthly credits:
    # - If tier is not free and request has free tier default (3), use tier default
    # - Otherwise, use request value (explicit override or free tier)
    monthly_credits = _determine_monthly_credits(
        tier=tier,
        requested=request.monthly_credits
    )
    
    # Determine storage limit:
    # - If tier is not free and request has free tier default (0), use tier default
    # - Otherwise, use request value (explicit override or free tier)
    storage_limit = _determine_storage_limit(
        tier=tier,
        requested=request.storage_limit_bytes
    )
    
    # Create new user
    try:
        new_user = User(
            supabase_user_id=request.supabase_user_id,
            email=request.email,
            email_verified=request.email_verified,
            first_name=request.first_name,
            last_name=request.last_name,
            profile_image_url=request.profile_image_url,
            subscription_tier=tier,
            subscription_status=request.subscription_status or "active",
            monthly_credits=monthly_credits,
            topup_credits=request.topup_credits or 0,
            storage_limit_bytes=storage_limit,
            storage_used_bytes=request.storage_used_bytes or 0,
            account_status=request.account_status or "active",
            stripe_customer_id=request.stripe_customer_id,
            stripe_subscription_id=request.stripe_subscription_id,
            subscription_period_start=request.subscription_period_start,
            subscription_period_end=request.subscription_period_end,
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
            f"supabase_user_id={request.supabase_user_id}, email={request.email}, error={e}"
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"User with supabase_user_id={request.supabase_user_id} or "
                f"email={request.email} already exists"
            )
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating user: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
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

