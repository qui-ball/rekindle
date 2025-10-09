"""
S3 service for file upload and download
"""

import boto3
from botocore.exceptions import ClientError
from typing import Optional
import io
import uuid
from pathlib import Path
from loguru import logger
from datetime import datetime, timezone

from app.core.config import settings


class S3Service:
    def __init__(self):
        self.s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        self.bucket = settings.S3_BUCKET
        self.region = settings.AWS_REGION

    @staticmethod
    def generate_timestamp_id() -> str:
        """
        Generate a timestamp-based ID in format: YYYYMMDD_HHMMSS_microseconds
        Example: 20250926_143052_123456
        """
        now = datetime.now(timezone.utc)
        return now.strftime("%Y%m%d_%H%M%S_%f")

    def upload_file(
        self, file_content: bytes, key: str, content_type: str = "image/jpeg"
    ) -> str:
        """
        Upload a file to S3 and return the S3 URL
        """
        try:
            self.s3_client.put_object(
                Bucket=self.bucket, Key=key, Body=file_content, ContentType=content_type
            )
            s3_url = self.get_s3_url(key)
            logger.info(f"Uploaded file to S3: {key}")
            return s3_url
        except ClientError as e:
            logger.error(f"Error uploading to S3: {e}")
            raise

    def upload_processed_image(
        self,
        image_content: bytes,
        job_id: str,
        extension: str = "jpg",
        content_type: Optional[str] = None,
    ) -> str:
        """
        Upload a processed/cropped image for a job
        """
        key = f"uploaded/{job_id}.{extension}"
        ct = self._get_content_type(extension, content_type)
        return self.upload_file(image_content, key, ct)

    def upload_restored_image(
        self,
        image_content: bytes,
        job_id: str,
        restore_id: str,
        extension: str = "jpg",
        content_type: Optional[str] = None,
    ) -> str:
        """
        Upload a restored image for a job
        """
        key = f"restored/{job_id}/{restore_id}.{extension}"
        ct = self._get_content_type(extension, content_type)
        return self.upload_file(image_content, key, ct)

    def upload_animation(
        self,
        video_content: bytes,
        job_id: str,
        animation_id: str,
        is_preview: bool = True,
        content_type: str = "video/mp4",
    ) -> str:
        """
        Upload an animation video (preview or result)
        """
        suffix = "preview" if is_preview else "result"
        key = f"animated/{job_id}/{animation_id}_{suffix}.mp4"
        return self.upload_file(video_content, key, content_type)

    def upload_thumbnail(
        self,
        image_content: bytes,
        job_id: str,
        animation_id: str,
        extension: str = "jpg",
        content_type: Optional[str] = None,
    ) -> str:
        """
        Upload a thumbnail for an animation
        """
        key = f"thumbnails/{job_id}/{animation_id}.{extension}"
        ct = self._get_content_type(extension, content_type)
        return self.upload_file(image_content, key, ct)

    def upload_meta(
        self,
        meta_content: bytes,
        job_id: str,
        content_type: str = "application/json",
    ) -> str:
        """
        Upload metadata JSON for a job
        """
        key = f"meta/{job_id}.json"
        return self.upload_file(meta_content, key, content_type)

    def _get_content_type(self, extension: str, content_type: Optional[str] = None) -> str:
        """
        Normalize content type based on extension
        """
        if content_type is None:
            ext = extension.lower()
            if ext in {"jpg", "jpeg"}:
                return "image/jpeg"
            elif ext == "png":
                return "image/png"
            elif ext == "webp":
                return "image/webp"
            elif ext == "heic":
                return "image/heic"
            else:
                return f"image/{ext}"
        return content_type

    def download_file(self, key: str) -> bytes:
        """
        Download a file from S3
        """
        try:
            response = self.s3_client.get_object(Bucket=self.bucket, Key=key)
            return response["Body"].read()
        except ClientError as e:
            logger.error(f"Error downloading from S3: {e}")
            raise

    def generate_presigned_url(self, key: str, expiration: int = 3600) -> str:
        """
        Generate a presigned URL for direct upload
        """
        try:
            url = self.s3_client.generate_presigned_url(
                "put_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expiration,
            )
            return url
        except ClientError as e:
            logger.error(f"Error generating presigned URL: {e}")
            raise

    def get_s3_url(self, key: str) -> str:
        """
        Get the S3 URL for a given S3 key
        """
        return f"https://{self.bucket}.s3.{self.region}.amazonaws.com/{key}"

    def extract_key_from_url(self, url: str) -> str:
        """
        Extract the S3 key from an S3 URL
        """
        if f"{self.bucket}.s3" in url:
            # S3 URL format: https://bucket.s3.region.amazonaws.com/key
            if f".s3.{self.region}.amazonaws.com/" in url:
                return url.split(f".s3.{self.region}.amazonaws.com/")[1]
            elif ".s3.amazonaws.com/" in url:
                return url.split(f".s3.amazonaws.com/")[1]
        elif f"/{self.bucket}/" in url and "s3" in url and "amazonaws.com" in url:
            # Regional S3 URL format: https://s3.region.amazonaws.com/bucket/key
            parts = url.split(f"/{self.bucket}/")
            if len(parts) > 1:
                return parts[1]
        # Assume it's already a key
        return url


# Global instance
s3_service = S3Service()
