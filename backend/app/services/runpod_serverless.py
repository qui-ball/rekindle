"""
RunPod Serverless service for image restoration
"""

import boto3
import runpod
from loguru import logger
from typing import Dict, Any, Optional
from botocore.exceptions import ClientError

from app.core.config import settings


class RunPodServerlessService:
    """Service for interacting with RunPod serverless endpoints and network volumes"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint_id: Optional[str] = None,
        network_volume_id: Optional[str] = None,
        s3_endpoint: Optional[str] = None,
        s3_access_key: Optional[str] = None,
        s3_secret_key: Optional[str] = None,
        s3_region: Optional[str] = None,
    ):
        """
        Initialize RunPod serverless service

        Args:
            api_key: RunPod API key (defaults to settings.RUNPOD_API_KEY)
            endpoint_id: RunPod serverless endpoint ID (defaults to settings.RUNPOD_ENDPOINT_ID)
            network_volume_id: Network volume ID (defaults to settings.RUNPOD_NETWORK_VOLUME_ID)
            s3_endpoint: S3 API endpoint URL (defaults to settings.RUNPOD_S3_ENDPOINT)
            s3_access_key: S3 access key (defaults to settings.RUNPOD_S3_ACCESS_KEY)
            s3_secret_key: S3 secret key (defaults to settings.RUNPOD_S3_SECRET_KEY)
            s3_region: S3 region (defaults to settings.RUNPOD_S3_REGION)
        """
        self.api_key = api_key or settings.RUNPOD_API_KEY
        self.endpoint_id = endpoint_id or settings.RUNPOD_ENDPOINT_ID
        self.network_volume_id = network_volume_id or settings.RUNPOD_NETWORK_VOLUME_ID
        self.s3_endpoint = s3_endpoint or settings.RUNPOD_S3_ENDPOINT
        self.s3_access_key = s3_access_key or settings.RUNPOD_S3_ACCESS_KEY
        self.s3_secret_key = s3_secret_key or settings.RUNPOD_S3_SECRET_KEY
        self.s3_region = s3_region or settings.RUNPOD_S3_REGION

        # Validate required settings
        if not self.api_key:
            raise ValueError("RUNPOD_API_KEY is required")
        if not self.endpoint_id:
            raise ValueError("RUNPOD_ENDPOINT_ID is required")
        if not self.network_volume_id:
            raise ValueError("RUNPOD_NETWORK_VOLUME_ID is required")
        if not self.s3_access_key or not self.s3_secret_key:
            raise ValueError("RUNPOD_S3_ACCESS_KEY and RUNPOD_S3_SECRET_KEY are required")

        # Initialize RunPod API
        runpod.api_key = self.api_key

        # Initialize S3 client for network volume access
        self.s3_client = boto3.client(
            "s3",
            endpoint_url=self.s3_endpoint,
            aws_access_key_id=self.s3_access_key,
            aws_secret_access_key=self.s3_secret_key,
            region_name=self.s3_region,
        )

        logger.info(
            f"RunPod serverless service initialized: endpoint={self.endpoint_id}, volume={self.network_volume_id}"
        )

    def upload_image_to_volume(
        self, image_data: bytes, job_id: str, extension: str = "jpg"
    ) -> str:
        """
        Upload image to network volume via S3 API

        Args:
            image_data: Raw image bytes
            job_id: Job UUID string
            extension: File extension (default: "jpg")

        Returns:
            S3 path relative to bucket (e.g., "inputs/job_123.jpg")

        Raises:
            Exception: If upload fails
        """
        filename = f"job_{job_id}.{extension}"
        s3_key = f"inputs/{filename}"

        try:
            logger.info(f"Uploading image to network volume: {s3_key}")

            self.s3_client.put_object(
                Bucket=self.network_volume_id, Key=s3_key, Body=image_data
            )

            logger.success(f"Successfully uploaded image to {s3_key}")
            return s3_key

        except ClientError as e:
            logger.error(f"Failed to upload image to network volume: {e}")
            raise Exception(f"S3 upload failed: {e}")

    def submit_job(
        self, workflow: Dict[str, Any], webhook_url: str, job_id: str
    ) -> str:
        """
        Submit job to RunPod serverless endpoint

        Args:
            workflow: Complete ComfyUI workflow JSON
            webhook_url: URL for RunPod to call on completion
            job_id: Job UUID string for logging

        Returns:
            RunPod job ID

        Raises:
            Exception: If job submission fails
        """
        try:
            logger.info(f"Submitting job {job_id} to RunPod serverless endpoint {self.endpoint_id}")

            # Initialize endpoint
            endpoint = runpod.Endpoint(self.endpoint_id)

            # Submit async job with webhook
            run_request = endpoint.run(
                {
                    "input": {"workflow_api": workflow},
                    "webhook": webhook_url,
                }
            )

            # Get job ID
            runpod_job_id = run_request.job_id

            logger.success(
                f"Successfully submitted job {job_id} to RunPod (job_id: {runpod_job_id})"
            )

            return runpod_job_id

        except Exception as e:
            logger.error(f"Failed to submit job {job_id} to RunPod: {e}")
            raise Exception(f"RunPod job submission failed: {e}")

    def download_output_from_volume(self, output_path: str) -> bytes:
        """
        Download output file from network volume via S3 API

        Args:
            output_path: S3 path relative to bucket (e.g., "outputs/restored.jpg")

        Returns:
            File bytes

        Raises:
            Exception: If download fails
        """
        try:
            logger.info(f"Downloading output from network volume: {output_path}")

            response = self.s3_client.get_object(
                Bucket=self.network_volume_id, Key=output_path
            )

            output_bytes = response["Body"].read()

            logger.success(
                f"Successfully downloaded {len(output_bytes)} bytes from {output_path}"
            )

            return output_bytes

        except ClientError as e:
            logger.error(f"Failed to download output from network volume: {e}")
            raise Exception(f"S3 download failed: {e}")


# Global service instance
runpod_serverless_service = RunPodServerlessService()
