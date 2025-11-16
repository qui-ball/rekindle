"""
Celery tasks for user management
"""

from datetime import datetime, timezone, timedelta
from uuid import UUID
from sqlalchemy import select
from loguru import logger

from app.workers.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.user import User


@celery_app.task
def schedule_account_deletion(user_id: str):
    """
    Celery task to archive a user account after 30-day grace period.
    
    This task is scheduled to run 30 days after deletion_requested_at timestamp.
    Moves account to 'archived' status (soft delete stage 2).
    """
    db = SessionLocal()
    try:
        user_uuid = UUID(user_id)
        
        # Use SELECT FOR UPDATE to lock the row and prevent race conditions
        user = db.execute(
            select(User)
            .where(User.id == user_uuid)
            .with_for_update(nowait=True)  # Fail fast if locked
        ).scalar_one_or_none()
        
        if not user:
            logger.warning(f"User {user_id} not found for deletion")
            return
        
        # Double-check deletion was requested (now with lock held)
        if not user.deletion_requested_at:
            logger.warning(f"User {user_id} deletion not requested, skipping")
            return
        
        # Calculate days since request (with lock held)
        now = datetime.now(timezone.utc)
        days_since_request = (now - user.deletion_requested_at).days
        
        if days_since_request < 30:
            logger.warning(
                f"User {user_id} deletion requested {days_since_request} days ago, "
                f"not yet 30 days. Rescheduling..."
            )
            # Reschedule for remaining days
            remaining_days = 30 - days_since_request
            task = schedule_account_deletion.apply_async(
                args=[user_id],
                countdown=remaining_days * 24 * 60 * 60  # Convert days to seconds
            )
            # Update task ID in case it changed
            user.deletion_task_id = task.id
            db.commit()
            return
        
        logger.info(f"Archiving user account: id={user_id}, email={user.email}")
        
        # Move to archived status (soft delete stage 2)
        user.account_status = "archived"
        user.archived_at = datetime.now(timezone.utc)
        user.deletion_requested_at = None  # Clear deletion request timestamp
        user.deletion_task_id = None  # Clear task ID
        
        # Schedule hard deletion after 2 years (730 days)
        schedule_account_hard_delete.apply_async(
            args=[user_id],
            countdown=730 * 24 * 60 * 60  # 2 years in seconds
        )
        
        db.commit()
        logger.success(f"User account {user_id} archived (will be hard deleted in 2 years)")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error archiving user account {user_id}: {e}", exc_info=True)
        raise
    finally:
        db.close()


@celery_app.task
def schedule_account_hard_delete(user_id: str):
    """
    Celery task to permanently delete a user account after archive retention period.
    
    This task is scheduled to run 2 years after archived_at timestamp.
    Performs actual data deletion (hard delete stage 3).
    """
    db = SessionLocal()
    try:
        user_uuid = UUID(user_id)
        
        # Use SELECT FOR UPDATE to lock the row
        user = db.execute(
            select(User)
            .where(User.id == user_uuid)
            .with_for_update(nowait=True)
        ).scalar_one_or_none()
        
        if not user:
            logger.warning(f"User {user_id} not found for hard deletion")
            return
        
        # Verify account is archived
        if user.account_status != "archived":
            logger.warning(
                f"User {user_id} is not archived (status: {user.account_status}), skipping hard delete"
            )
            return
        
        # Verify retention period has passed
        if not user.archived_at:
            logger.warning(f"User {user_id} has no archived_at timestamp, skipping")
            return
        
        now = datetime.now(timezone.utc)
        days_since_archive = (now - user.archived_at).days
        
        if days_since_archive < 730:  # 2 years
            logger.warning(
                f"User {user_id} archived {days_since_archive} days ago, "
                f"not yet 2 years. Rescheduling..."
            )
            remaining_days = 730 - days_since_archive
            schedule_account_hard_delete.apply_async(
                args=[user_id],
                countdown=remaining_days * 24 * 60 * 60
            )
            return
        
        logger.info(f"Permanently deleting user account: id={user_id}, email={user.email}")
        
        # TODO: In production, implement comprehensive data deletion:
        # - Delete user's photos from S3 (via UserDeletionService)
        # - Delete user's jobs and related data
        # - Cancel any active subscriptions
        # - Send final deletion confirmation email
        
        # Mark account as hard deleted
        user.account_status = "deleted"
        user.archived_at = None
        
        db.commit()
        logger.success(f"User account {user_id} permanently deleted")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error hard deleting user account {user_id}: {e}", exc_info=True)
        raise
    finally:
        db.close()

