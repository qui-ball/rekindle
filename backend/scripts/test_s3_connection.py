#!/usr/bin/env python3
"""Test RunPod S3 connection and list buckets/volumes"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import boto3
from dotenv import load_dotenv
from loguru import logger
from botocore.exceptions import ClientError

# Load environment
load_dotenv()

VOLUME_ID = os.getenv("RUNPOD_NETWORK_VOLUME_ID", "vw7o2iyjlt")
S3_ENDPOINT = os.getenv("RUNPOD_S3_ENDPOINT", "https://s3api-us-il-1.runpod.io/")
S3_ACCESS_KEY = os.getenv("RUNPOD_S3_ACCESS_KEY")
S3_SECRET_KEY = os.getenv("RUNPOD_S3_SECRET_KEY")
S3_REGION = os.getenv("RUNPOD_S3_REGION", "us-il-1")


def test_connection():
    """Test S3 connection to RunPod volume"""

    print("\n" + "=" * 60)
    print("RunPod S3 Connection Test")
    print("=" * 60)
    print(f"Endpoint:  {S3_ENDPOINT}")
    print(f"Region:    {S3_REGION}")
    print(f"Volume ID: {VOLUME_ID}")
    print(
        f"Access Key: {S3_ACCESS_KEY[:10]}..."
        if S3_ACCESS_KEY
        else "Access Key: NOT SET"
    )
    print("=" * 60 + "\n")

    if not S3_ACCESS_KEY or not S3_SECRET_KEY:
        logger.error("❌ S3 credentials not set in .env file")
        return False

    # Initialize S3 client
    s3_client = boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name=S3_REGION,
    )

    # Test 1: List buckets
    print("Test 1: List buckets/volumes")
    print("-" * 60)
    try:
        response = s3_client.list_buckets()
        buckets = response.get("Buckets", [])
        if buckets:
            logger.success(f"✅ Found {len(buckets)} bucket(s):")
            for bucket in buckets:
                print(f"   - {bucket['Name']}")
        else:
            logger.warning("⚠️  No buckets found")
        print()
    except ClientError as e:
        logger.error(f"❌ Failed to list buckets: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        return False

    # Test 2: Try to access the specific volume
    print(f"Test 2: Access volume '{VOLUME_ID}'")
    print("-" * 60)
    try:
        response = s3_client.list_objects_v2(Bucket=VOLUME_ID, MaxKeys=10)
        object_count = response.get("KeyCount", 0)
        logger.success(f"✅ Successfully accessed volume '{VOLUME_ID}'")
        print(f"   Objects found: {object_count}")

        if object_count > 0:
            print("   First few objects:")
            for obj in response.get("Contents", [])[:5]:
                print(f"      - {obj['Key']}")
        print()
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        error_msg = e.response.get("Error", {}).get("Message", str(e))
        logger.error(f"❌ Failed to access volume '{VOLUME_ID}'")
        print(f"   Error Code: {error_code}")
        print(f"   Error Message: {error_msg}")
        print()
        return False
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        return False

    # Test 3: Try to upload a small test file
    print("Test 3: Upload test file")
    print("-" * 60)
    test_key = "test/connection_test.txt"
    test_data = b"RunPod S3 connection test - " + str(os.urandom(8).hex()).encode()

    try:
        s3_client.put_object(Bucket=VOLUME_ID, Key=test_key, Body=test_data)
        logger.success(f"✅ Successfully uploaded test file to '{test_key}'")
        print()
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        error_msg = e.response.get("Error", {}).get("Message", str(e))
        logger.error(f"❌ Failed to upload test file")
        print(f"   Error Code: {error_code}")
        print(f"   Error Message: {error_msg}")
        print()
        return False

    # Test 4: Try to download the test file
    print("Test 4: Download test file")
    print("-" * 60)
    try:
        response = s3_client.get_object(Bucket=VOLUME_ID, Key=test_key)
        downloaded_data = response["Body"].read()
        if downloaded_data == test_data:
            logger.success(f"✅ Successfully downloaded and verified test file")
        else:
            logger.error(f"❌ Downloaded data doesn't match uploaded data")
        print()
    except ClientError as e:
        logger.error(f"❌ Failed to download test file: {e}")
        return False

    # Clean up test file
    try:
        s3_client.delete_object(Bucket=VOLUME_ID, Key=test_key)
        logger.info(f"🧹 Cleaned up test file")
    except:
        pass

    print("=" * 60)
    logger.success("✅ All tests passed! S3 connection is working.")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)
