#!/usr/bin/env python3
"""Manage files on RunPod network volume"""

import sys
import os
from pathlib import Path
from typing import Optional
from datetime import datetime

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

import click
from dotenv import load_dotenv
from loguru import logger
from botocore.exceptions import ClientError
import boto3

# Load environment variables
load_dotenv()

# Configuration - use correct values for your actual network volume
RUNPOD_NETWORK_VOLUME_ID = os.getenv(
    "RUNPOD_NETWORK_VOLUME_ID", "vw7o2iyjlt"
)  # ComfyUI-Rekindle volume
RUNPOD_S3_ENDPOINT = os.getenv("RUNPOD_S3_ENDPOINT", "https://s3api-us-il-1.runpod.io/")
RUNPOD_S3_ACCESS_KEY = os.getenv("RUNPOD_S3_ACCESS_KEY")
RUNPOD_S3_SECRET_KEY = os.getenv("RUNPOD_S3_SECRET_KEY")
RUNPOD_S3_REGION = os.getenv("RUNPOD_S3_REGION", "us-il-1")


def get_s3_client(volume_id: Optional[str] = None):
    """Initialize and return S3 client"""
    vol_id = volume_id or RUNPOD_NETWORK_VOLUME_ID
    if not vol_id:
        raise ValueError("RUNPOD_NETWORK_VOLUME_ID not set")
    if not RUNPOD_S3_ACCESS_KEY or not RUNPOD_S3_SECRET_KEY:
        raise ValueError("RUNPOD_S3_ACCESS_KEY and RUNPOD_S3_SECRET_KEY are required")

    return (
        boto3.client(
            "s3",
            endpoint_url=RUNPOD_S3_ENDPOINT,
            aws_access_key_id=RUNPOD_S3_ACCESS_KEY,
            aws_secret_access_key=RUNPOD_S3_SECRET_KEY,
            region_name=RUNPOD_S3_REGION,
        ),
        vol_id,
    )


def format_size(size_bytes: int) -> str:
    """Format bytes to human readable size"""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f}{unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f}PB"


def upload_file(
    s3_client, volume_id: str, file_path: Path, destination_path: Optional[str] = None
) -> bool:
    """
    Upload a single file to RunPod network volume

    Args:
        s3_client: Boto3 S3 client
        volume_id: Network volume ID
        file_path: Path to the file to upload
        destination_path: Optional destination path on volume. If not provided, uses filename only.

    Returns:
        True if successful, False otherwise
    """
    if not file_path.exists():
        logger.error(f"File not found: {file_path}")
        return False

    if not file_path.is_file():
        logger.error(f"Not a file: {file_path}")
        return False

    # Determine S3 key (destination path)
    if destination_path:
        s3_key = destination_path
    else:
        s3_key = file_path.name

    try:
        logger.info(f"Reading file: {file_path}")
        with open(file_path, "rb") as f:
            file_data = f.read()

        logger.info(f"File size: {len(file_data):,} bytes")
        logger.info(f"Uploading to: {s3_key}")

        s3_client.put_object(Bucket=volume_id, Key=s3_key, Body=file_data)

        logger.success(f"✓ Successfully uploaded: {s3_key}")
        return True

    except ClientError as e:
        logger.error(f"Failed to upload {file_path}: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error uploading {file_path}: {e}")
        return False


def upload_directory(
    s3_client,
    volume_id: str,
    dir_path: Path,
    destination_prefix: Optional[str] = None,
    recursive: bool = True,
) -> tuple[int, int]:
    """
    Upload all files in a directory to RunPod network volume

    Args:
        s3_client: Boto3 S3 client
        volume_id: Network volume ID
        dir_path: Path to the directory
        destination_prefix: Optional prefix for destination paths on volume
        recursive: Whether to upload subdirectories recursively

    Returns:
        Tuple of (successful_uploads, failed_uploads)
    """
    if not dir_path.exists():
        logger.error(f"Directory not found: {dir_path}")
        return (0, 0)

    if not dir_path.is_dir():
        logger.error(f"Not a directory: {dir_path}")
        return (0, 0)

    successful = 0
    failed = 0

    # Get all files
    if recursive:
        files = [f for f in dir_path.rglob("*") if f.is_file()]
    else:
        files = [f for f in dir_path.glob("*") if f.is_file()]

    logger.info(f"Found {len(files)} file(s) in {dir_path}")

    for file_path in files:
        # Calculate relative path for destination
        relative_path = file_path.relative_to(dir_path)

        # Build destination path
        if destination_prefix:
            dest_path = f"{destination_prefix.rstrip('/')}/{relative_path}"
        else:
            dest_path = str(relative_path)

        # Upload the file
        if upload_file(s3_client, volume_id, file_path, dest_path):
            successful += 1
        else:
            failed += 1

    return (successful, failed)


@click.group()
def cli():
    """Manage files on RunPod network volume."""
    pass


@cli.command()
@click.argument("source", type=click.Path(exists=True), required=True)
@click.option(
    "--dest",
    "-d",
    type=str,
    default=None,
    help="Destination path on volume. For files: full path including filename. For directories: prefix path.",
)
@click.option(
    "--recursive/--no-recursive",
    "-r/-R",
    default=True,
    help="Recursively upload directories (default: recursive)",
)
@click.option(
    "--volume-id",
    type=str,
    default=None,
    help="Override network volume ID (defaults to RUNPOD_NETWORK_VOLUME_ID env var)",
)
def upload(source: str, dest: Optional[str], recursive: bool, volume_id: Optional[str]):
    """
    Upload files or directories to RunPod network volume.

    SOURCE can be a file path or directory path.

    Examples:

    \b
    # Upload a single file to volume root
    $ uv run python scripts/runpod_upload.py upload /path/to/image.jpg

    \b
    # Upload a file with custom destination path
    $ uv run python scripts/runpod_upload.py upload image.jpg --dest inputs/test.jpg

    \b
    # Upload entire directory (recursive)
    $ uv run python scripts/runpod_upload.py upload /path/to/models --dest models/

    \b
    # Upload directory (non-recursive, only top-level files)
    $ uv run python scripts/runpod_upload.py upload /path/to/dir --no-recursive
    """
    logger.info("=" * 60)
    logger.info("RunPod Network Volume - Upload")
    logger.info("=" * 60)

    try:
        # Initialize S3 client
        s3_client, vol_id = get_s3_client(volume_id)
        logger.info(f"Network volume: {vol_id}")
        logger.info(f"S3 endpoint: {RUNPOD_S3_ENDPOINT}")
        logger.info(f"Region: {RUNPOD_S3_REGION}")
        logger.info("")

        source_path = Path(source).resolve()

        if source_path.is_file():
            # Upload single file
            logger.info(f"Uploading file: {source_path}")
            success = upload_file(s3_client, vol_id, source_path, dest)

            if success:
                logger.success("\n✓ Upload completed successfully!")
                sys.exit(0)
            else:
                logger.error("\n✗ Upload failed")
                sys.exit(1)

        elif source_path.is_dir():
            # Upload directory
            logger.info(f"Uploading directory: {source_path}")
            logger.info(f"Recursive: {recursive}")
            if dest:
                logger.info(f"Destination prefix: {dest}")
            logger.info("")

            successful, failed = upload_directory(
                s3_client, vol_id, source_path, dest, recursive
            )

            logger.info("")
            logger.info(f"Successful uploads: {successful}")
            logger.info(f"Failed uploads: {failed}")

            if failed == 0:
                logger.success("\n✓ All uploads completed successfully!")
                sys.exit(0)
            elif successful > 0:
                logger.warning("\n⚠ Some uploads failed")
                sys.exit(1)
            else:
                logger.error("\n✗ All uploads failed")
                sys.exit(1)
        else:
            logger.error(f"Source is neither a file nor a directory: {source_path}")
            sys.exit(1)

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        logger.info("\nMake sure your .env file has:")
        logger.info("  - RUNPOD_NETWORK_VOLUME_ID")
        logger.info("  - RUNPOD_S3_ACCESS_KEY")
        logger.info("  - RUNPOD_S3_SECRET_KEY")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)


@cli.command()
@click.argument("path", type=str, default="", required=False)
@click.option(
    "--recursive/--no-recursive",
    "-r/-R",
    default=False,
    help="List files recursively (default: non-recursive)",
)
@click.option(
    "--human-readable",
    "-h",
    is_flag=True,
    default=True,
    help="Show human-readable file sizes (default: enabled)",
)
@click.option(
    "--volume-id",
    type=str,
    default=None,
    help="Override network volume ID (defaults to RUNPOD_NETWORK_VOLUME_ID env var)",
)
def ls(path: str, recursive: bool, human_readable: bool, volume_id: Optional[str]):
    """
    List files in RunPod network volume.

    PATH is an optional prefix/directory to list. Defaults to root.

    Examples:

    \b
    # List root directory
    $ uv run python scripts/runpod_upload.py ls

    \b
    # List specific directory
    $ uv run python scripts/runpod_upload.py ls inputs/

    \b
    # List recursively
    $ uv run python scripts/runpod_upload.py ls --recursive

    \b
    # List specific path recursively
    $ uv run python scripts/runpod_upload.py ls models/ --recursive
    """
    logger.info("=" * 60)
    logger.info("RunPod Network Volume - List Files")
    logger.info("=" * 60)

    try:
        # Initialize S3 client
        s3_client, vol_id = get_s3_client(volume_id)
        logger.info(f"Network volume: {vol_id}")
        logger.info(f"S3 endpoint: {RUNPOD_S3_ENDPOINT}")
        logger.info(f"Region: {RUNPOD_S3_REGION}")
        logger.info(f"Path: {path or '(root)'}")
        logger.info(f"Recursive: {recursive}")
        logger.info("")

        # List objects
        if recursive:
            # List all objects with the prefix
            paginator = s3_client.get_paginator("list_objects_v2")
            pages = paginator.paginate(Bucket=vol_id, Prefix=path)

            objects = []
            for page in pages:
                if "Contents" in page:
                    objects.extend(page["Contents"])
        else:
            # List only immediate files/folders with the prefix
            # Use delimiter to simulate directory listing
            response = s3_client.list_objects_v2(
                Bucket=vol_id, Prefix=path, Delimiter="/"
            )

            objects = []
            if "Contents" in response:
                objects.extend(response["Contents"])

            # Also show "directories" (common prefixes)
            if "CommonPrefixes" in response:
                for prefix in response["CommonPrefixes"]:
                    # Create pseudo-object for directory
                    objects.append(
                        {"Key": prefix["Prefix"], "Size": 0, "IsDirectory": True}
                    )

        if not objects:
            logger.warning("No files found")
            return

        logger.info(f"Found {len(objects)} item(s):\n")

        # Sort by key
        objects.sort(key=lambda x: x["Key"])

        # Display files
        total_size = 0
        for obj in objects:
            key = obj["Key"]
            size = obj.get("Size", 0)
            is_dir = obj.get("IsDirectory", False)

            if is_dir:
                # Directory
                click.echo(f"  {key:<60} <DIR>")
            else:
                # File
                total_size += size
                if human_readable:
                    size_str = format_size(size)
                    click.echo(f"  {key:<60} {size_str:>10}")
                else:
                    click.echo(f"  {key:<60} {size:>10} bytes")

        # Summary
        logger.info("")
        logger.info(f"Total items: {len(objects)}")
        if total_size > 0:
            if human_readable:
                logger.info(f"Total size: {format_size(total_size)}")
            else:
                logger.info(f"Total size: {total_size:,} bytes")

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        logger.info("\nMake sure your .env file has:")
        logger.info("  - RUNPOD_NETWORK_VOLUME_ID")
        logger.info("  - RUNPOD_S3_ACCESS_KEY")
        logger.info("  - RUNPOD_S3_SECRET_KEY")
        sys.exit(1)
    except ClientError as e:
        logger.error(f"S3 error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    cli()
