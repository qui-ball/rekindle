#!/usr/bin/env python3
import boto3
import os
from botocore.config import Config
from dotenv import load_dotenv

load_dotenv()

print(f"Testing S3 connection...")
print(f"Endpoint: {os.getenv('RUNPOD_S3_ENDPOINT')}")
print(f"Access Key: {os.getenv('RUNPOD_S3_ACCESS_KEY')[:20]}...")
print()

s3_config = Config(signature_version="s3v4", s3={"addressing_style": "path"})

s3 = boto3.client(
    "s3",
    endpoint_url=os.getenv("RUNPOD_S3_ENDPOINT"),
    aws_access_key_id=os.getenv("RUNPOD_S3_ACCESS_KEY"),
    aws_secret_access_key=os.getenv("RUNPOD_S3_SECRET_KEY"),
    region_name=os.getenv("RUNPOD_S3_REGION"),
    config=s3_config,
)

try:
    result = s3.list_buckets()
    buckets = result.get("Buckets", [])
    print(f"✅ Success! Found {len(buckets)} bucket(s)")
    for b in buckets:
        print(f"   - {b['Name']}")
except Exception as e:
    print(f"❌ Error: {e}")
