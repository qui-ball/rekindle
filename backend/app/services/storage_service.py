"""
Storage service for user-scoped S3 operations.

This service enforces user-scoped key structure: users/{user_id}/raw/{photo_id}/original.{ext}
All operations require a user_id to ensure data isolation.
"""

from __future__ import annotations

from typing import Optional, Tuple
from uuid import UUID as UUIDType

from loguru import logger
from botocore.exceptions import ClientError

from app.services.s3 import S3Service


class StorageService:
    """
    Service for user-scoped storage operations with enforced prefix isolation.
    
    All S3 keys follow the pattern: users/{user_id}/{category}/{photo_id}/{filename}
    This ensures:
    1. IAM policies can restrict access to user-specific prefixes
    2. Users cannot access other users' data
    3. Clear ownership trail in S3 key structure
    """

    def __init__(self, s3_service: Optional[S3Service] = None):
        """
        Initialize storage service.
        
        Args:
            s3_service: Optional S3Service instance (defaults to global instance)
        """
        self.s3_service = s3_service or S3Service()

    @staticmethod
    def generate_user_scoped_key(
        user_id: str,
        photo_id: UUIDType,
        category: str,
        filename: str,
    ) -> str:
        """
        Generate a user-scoped S3 key.
        
        Args:
            user_id: Supabase user ID (sub claim)
            photo_id: Photo UUID
            category: One of 'raw', 'processed', 'thumbs', 'animated', 'meta'
            filename: Filename with extension (e.g., 'original.jpg')
            
        Returns:
            S3 key in format: users/{user_id}/{category}/{photo_id}/{filename}
            
        Raises:
            ValueError: If category is invalid or user_id/photo_id are empty
        """
        if not user_id or not user_id.strip():
            raise ValueError("user_id is required and cannot be empty")
        if not photo_id:
            raise ValueError("photo_id is required")
        
        valid_categories = {"raw", "processed", "thumbs", "animated", "meta"}
        if category not in valid_categories:
            raise ValueError(
                f"Invalid category '{category}'. Must be one of: {valid_categories}"
            )
        
        # Sanitize user_id to prevent path traversal (remove any slashes)
        sanitized_user_id = user_id.replace("/", "_").replace("\\", "_")
        
        return f"users/{sanitized_user_id}/{category}/{photo_id}/{filename}"

    def generate_original_key(
        self, user_id: str, photo_id: UUIDType, extension: str = "jpg"
    ) -> str:
        """
        Generate S3 key for original uploaded photo.
        
        Args:
            user_id: Supabase user ID
            photo_id: Photo UUID
            extension: File extension (default: 'jpg')
            
        Returns:
            S3 key: users/{user_id}/raw/{photo_id}/original.{ext}
        """
        filename = f"original.{extension}"
        return self.generate_user_scoped_key(user_id, photo_id, "raw", filename)

    def generate_processed_key(
        self, user_id: str, photo_id: UUIDType, extension: str = "jpg"
    ) -> str:
        """
        Generate S3 key for processed/restored photo.
        
        Args:
            user_id: Supabase user ID
            photo_id: Photo UUID
            extension: File extension (default: 'jpg')
            
        Returns:
            S3 key: users/{user_id}/processed/{photo_id}/restored.{ext}
        """
        filename = f"restored.{extension}"
        return self.generate_user_scoped_key(user_id, photo_id, "processed", filename)

    def generate_thumbnail_key(
        self, user_id: str, photo_id: UUIDType
    ) -> str:
        """
        Generate S3 key for thumbnail.
        
        Args:
            user_id: Supabase user ID
            photo_id: Photo UUID
            
        Returns:
            S3 key: users/{user_id}/thumbs/{photo_id}.jpg
        """
        filename = f"{photo_id}.jpg"
        return self.generate_user_scoped_key(user_id, photo_id, "thumbs", filename)

    def generate_animation_key(
        self,
        user_id: str,
        photo_id: UUIDType,
        animation_id: str,
        is_preview: bool = True,
    ) -> str:
        """
        Generate S3 key for animation video.
        
        Args:
            user_id: Supabase user ID
            photo_id: Photo UUID
            animation_id: Animation ID
            is_preview: Whether this is a preview (default: True)
            
        Returns:
            S3 key: users/{user_id}/animated/{photo_id}/{animation_id}_{suffix}.mp4
        """
        suffix = "preview" if is_preview else "result"
        filename = f"{animation_id}_{suffix}.mp4"
        return self.generate_user_scoped_key(
            user_id, photo_id, "animated", filename
        )

    def generate_metadata_key(
        self, user_id: str, photo_id: UUIDType
    ) -> str:
        """
        Generate S3 key for metadata JSON.
        
        Args:
            user_id: Supabase user ID
            photo_id: Photo UUID
            
        Returns:
            S3 key: users/{user_id}/meta/{photo_id}.json
        """
        filename = f"{photo_id}.json"
        return self.generate_user_scoped_key(user_id, photo_id, "meta", filename)

    def validate_user_key(self, key: str, user_id: str) -> bool:
        """
        Validate that an S3 key belongs to the specified user.
        
        Args:
            key: S3 key to validate
            user_id: Expected user ID
            
        Returns:
            True if key belongs to user, False otherwise
        """
        if not key or not user_id:
            return False
        
        # Check for path traversal attempts (../ or ..\)
        if ".." in key:
            return False
        
        sanitized_user_id = user_id.replace("/", "_").replace("\\", "_")
        expected_prefix = f"users/{sanitized_user_id}/"
        
        # Normalize the key to resolve any path traversal before checking prefix
        # This ensures that even if path traversal is attempted, it won't pass
        normalized_key = key.replace("\\", "/")
        
        return normalized_key.startswith(expected_prefix)

    def generate_presigned_upload_url(
        self,
        user_id: str,
        photo_id: UUIDType,
        category: str,
        filename: str,
        content_type: Optional[str] = None,
        max_size_bytes: Optional[int] = None,
        expiration: int = 3600,
    ) -> dict:
        """
        Generate a presigned POST URL for direct upload with enforced prefix conditions.
        
        Args:
            user_id: Supabase user ID
            photo_id: Photo UUID
            category: One of 'raw', 'processed', 'thumbs', 'animated', 'meta'
            filename: Filename with extension
            content_type: Expected content type (optional)
            max_size_bytes: Maximum file size in bytes (optional)
            expiration: URL expiration in seconds (default: 3600)
            
        Returns:
            Dict with keys:
                - 'url': Presigned POST URL
                - 'fields': Dict of form fields to include in POST request
                - 'key': S3 key for the upload
            
        Raises:
            ValueError: If parameters are invalid
            ClientError: If S3 operation fails
        """
        # Generate user-scoped key
        s3_key = self.generate_user_scoped_key(user_id, photo_id, category, filename)
        
        # Build conditions for presigned POST
        conditions = []
        
        # Enforce prefix condition (critical for security)
        sanitized_user_id = user_id.replace("/", "_").replace("\\", "_")
        user_prefix = f"users/{sanitized_user_id}/"
        conditions.append(["starts-with", "$key", user_prefix])
        
        # Enforce exact key match (additional security)
        conditions.append({"key": s3_key})
        
        # Content type condition (if specified)
        if content_type:
            conditions.append({"Content-Type": content_type})
        
        # Content length range (if specified)
        if max_size_bytes:
            conditions.append(["content-length-range", 1, max_size_bytes])
        
        try:
            # Generate presigned POST URL with conditions
            # Note: generate_presigned_post returns a dict with 'url' and 'fields'
            presigned_post = self.s3_service.s3_client.generate_presigned_post(
                Bucket=self.s3_service.bucket,
                Key=s3_key,
                Fields={"Content-Type": content_type} if content_type else {},
                Conditions=conditions,
                ExpiresIn=expiration,
            )
            
            logger.info(
                "Generated presigned upload URL",
                user_id=user_id,
                photo_id=str(photo_id),
                key=s3_key,
                category=category,
            )
            
            # Return dict with URL, fields, and key for client convenience
            return {
                "url": presigned_post["url"],
                "fields": presigned_post["fields"],
                "key": s3_key,
            }
            
        except ClientError as e:
            logger.error(
                "Failed to generate presigned upload URL",
                user_id=user_id,
                photo_id=str(photo_id),
                error=str(e),
            )
            raise

    def generate_presigned_download_url(
        self,
        key: str,
        user_id: str,
        expiration: int = 3600,
    ) -> str:
        """
        Generate a presigned GET URL for downloading a file.
        
        This method validates that the key belongs to the user before generating the URL.
        
        Args:
            key: S3 key
            user_id: Supabase user ID (for validation)
            expiration: URL expiration in seconds (default: 3600)
            
        Returns:
            Presigned GET URL
            
        Raises:
            ValueError: If key doesn't belong to user
            ClientError: If S3 operation fails
        """
        # Validate key belongs to user
        if not self.validate_user_key(key, user_id):
            raise ValueError(
                f"S3 key '{key}' does not belong to user '{user_id}'. "
                "Access denied for security."
            )
        
        try:
            url = self.s3_service.generate_presigned_download_url(key, expiration)
            
            logger.info(
                "Generated presigned download URL",
                user_id=user_id,
                key=key,
            )
            
            return url
            
        except ClientError as e:
            logger.error(
                "Failed to generate presigned download URL",
                user_id=user_id,
                key=key,
                error=str(e),
            )
            raise

    def upload_file(
        self,
        file_content: bytes,
        user_id: str,
        photo_id: UUIDType,
        category: str,
        filename: str,
        content_type: str = "image/jpeg",
    ) -> str:
        """
        Upload a file to S3 using user-scoped key.
        
        Args:
            file_content: File content as bytes
            user_id: Supabase user ID
            photo_id: Photo UUID
            category: One of 'raw', 'processed', 'thumbs', 'animated', 'meta'
            filename: Filename with extension
            content_type: Content type (default: 'image/jpeg')
            
        Returns:
            S3 URL of uploaded file
        """
        s3_key = self.generate_user_scoped_key(user_id, photo_id, category, filename)
        
        try:
            url = self.s3_service.upload_file(file_content, s3_key, content_type)
            
            logger.info(
                "Uploaded file to user-scoped S3 location",
                user_id=user_id,
                photo_id=str(photo_id),
                key=s3_key,
                category=category,
            )
            
            return url
            
        except ClientError as e:
            logger.error(
                "Failed to upload file",
                user_id=user_id,
                photo_id=str(photo_id),
                key=s3_key,
                error=str(e),
            )
            raise

    def download_file(self, key: str, user_id: str) -> bytes:
        """
        Download a file from S3, validating user ownership.
        
        Args:
            key: S3 key
            user_id: Supabase user ID (for validation)
            
        Returns:
            File content as bytes
            
        Raises:
            ValueError: If key doesn't belong to user
            ClientError: If S3 operation fails
        """
        # Validate key belongs to user
        if not self.validate_user_key(key, user_id):
            raise ValueError(
                f"S3 key '{key}' does not belong to user '{user_id}'. "
                "Access denied for security."
            )
        
        try:
            content = self.s3_service.download_file(key)
            
            logger.info(
                "Downloaded file from S3",
                user_id=user_id,
                key=key,
            )
            
            return content
            
        except ClientError as e:
            logger.error(
                "Failed to download file",
                user_id=user_id,
                key=key,
                error=str(e),
            )
            raise

    def delete_file(self, key: str, user_id: str) -> bool:
        """
        Delete a file from S3, validating user ownership.
        
        Args:
            key: S3 key
            user_id: Supabase user ID (for validation)
            
        Returns:
            True if deleted successfully
            
        Raises:
            ValueError: If key doesn't belong to user
            ClientError: If S3 operation fails
        """
        # Validate key belongs to user
        if not self.validate_user_key(key, user_id):
            raise ValueError(
                f"S3 key '{key}' does not belong to user '{user_id}'. "
                "Access denied for security."
            )
        
        try:
            self.s3_service.s3_client.delete_object(
                Bucket=self.s3_service.bucket,
                Key=key,
            )
            
            logger.info(
                "Deleted file from S3",
                user_id=user_id,
                key=key,
            )
            
            return True
            
        except ClientError as e:
            logger.error(
                "Failed to delete file",
                user_id=user_id,
                key=key,
                error=str(e),
            )
            raise


# Global instance
storage_service = StorageService()

