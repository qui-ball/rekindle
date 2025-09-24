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
        self.cloudfront_domain = settings.CLOUDFRONT_DOMAIN

    def upload_file(
        self, file_content: bytes, key: str, content_type: str = "image/jpeg"
    ) -> str:
        """
        Upload a file to S3 and return the CloudFront URL
        """
        try:
            self.s3_client.put_object(
                Bucket=self.bucket, Key=key, Body=file_content, ContentType=content_type
            )
            cloudfront_url = f"https://{self.cloudfront_domain}/{key}"
            logger.info(f"Uploaded file to S3: {key}")
            return cloudfront_url
        except ClientError as e:
            logger.error(f"Error uploading to S3: {e}")
            raise

    def upload_image(
        self,
        image_content: bytes,
        user_id: str,
        prefix: str = "original",
        extension: str = "jpg",
    ) -> str:
        """
        Upload an image with a generated unique key
        """
        unique_id = str(uuid.uuid4())
        key = f"restorations/{user_id}/{prefix}/{unique_id}.{extension}"
        return self.upload_file(image_content, key, f"image/{extension}")

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

    def get_cloudfront_url(self, key: str) -> str:
        """
        Get the CloudFront URL for a given S3 key
        """
        return f"https://{self.cloudfront_domain}/{key}"


# Global instance
s3_service = S3Service()
