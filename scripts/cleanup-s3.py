#!/usr/bin/env python3
"""
S3 Cleanup Script
Deletes all files from S3 buckets
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import boto3
from botocore.exceptions import ClientError

# Load environment variables
env_path = Path(__file__).parent.parent / "backend" / ".env"
load_dotenv(env_path)

# Get AWS configuration
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION")
S3_BUCKET = os.getenv("S3_BUCKET")

print("🧹 S3 Storage Cleanup Script")
print("=" * 60)

if not all([AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET]):
    print("❌ Missing AWS credentials in .env file")
    print("\nRequired environment variables:")
    print("  - AWS_ACCESS_KEY_ID")
    print("  - AWS_SECRET_ACCESS_KEY")
    print("  - AWS_REGION")
    print("  - S3_BUCKET")
    sys.exit(1)

# Initialize S3 client
s3 = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)

def count_objects(prefix):
    """Count objects in a prefix"""
    try:
        response = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=prefix)
        return response.get('KeyCount', 0)
    except ClientError as e:
        print(f"  Error counting objects: {e}")
        return 0

def delete_objects(prefix):
    """Delete all objects with given prefix"""
    try:
        # List all objects
        response = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=prefix)
        
        if 'Contents' not in response:
            print(f"  No objects found in {prefix}")
            return 0
        
        # Prepare objects for deletion
        objects = [{'Key': obj['Key']} for obj in response['Contents']]
        
        if not objects:
            return 0
        
        # Delete objects
        s3.delete_objects(
            Bucket=S3_BUCKET,
            Delete={'Objects': objects}
        )
        
        print(f"  ✅ Deleted {len(objects)} objects from {prefix}")
        return len(objects)
        
    except ClientError as e:
        print(f"  ❌ Error deleting from {prefix}: {e}")
        return 0

def main():
    print(f"\nBucket: {S3_BUCKET}")
    print(f"Region: {AWS_REGION}")
    
    # Show current state
    print("\n📊 Current storage state:")
    print("-" * 60)
    prefixes = ['uploaded/', 'thumbnails/', 'restored/', 'animated/']
    counts = {}
    for prefix in prefixes:
        count = count_objects(prefix)
        counts[prefix] = count
        print(f"  /{prefix:20} {count:>10} objects")
    
    total = sum(counts.values())
    if total == 0:
        print("\n✅ S3 storage is already empty!")
        return
    
    # Confirm
    print("\n" + "=" * 60)
    confirm = input(f"\n⚠️  This will DELETE {total} objects from S3. Continue? (y/N): ")
    if confirm.lower() != 'y':
        print("❌ Cleanup cancelled")
        return
    
    # Delete objects
    print("\n🗑️  Deleting objects...")
    print("-" * 60)
    total_deleted = 0
    for prefix in prefixes:
        deleted = delete_objects(prefix)
        total_deleted += deleted
    
    print("\n" + "=" * 60)
    print(f"✅ Cleanup complete! Deleted {total_deleted} objects")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Cleanup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

