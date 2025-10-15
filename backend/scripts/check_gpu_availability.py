#!/usr/bin/env python3
"""Check GPU availability in the network volume's datacenter"""

import os
from dotenv import load_dotenv
import runpod
from loguru import logger

# Load environment variables
load_dotenv()

# Set API key
runpod.api_key = os.getenv("RUNPOD_API_KEY")

# Network volume datacenter
DATACENTER_ID = "EU-CZ-1"
NETWORK_VOLUME_ID = "366etpkt4g"

logger.info(f"Checking GPU availability in datacenter: {DATACENTER_ID}")

# Check availability for GPUs with 24-48GB VRAM
target_gpus = [
    ("NVIDIA RTX A5000", 24),
    ("NVIDIA GeForce RTX 3090", 24),
    ("NVIDIA GeForce RTX 3090 Ti", 24),
    ("NVIDIA GeForce RTX 4090", 24),
    ("NVIDIA L4", 24),
    ("Tesla V100-SXM2-32GB", 32),
    ("NVIDIA RTX 5000 Ada Generation", 32),
    ("NVIDIA GeForce RTX 5090", 32),
    ("NVIDIA RTX A6000", 48),
    ("NVIDIA A40", 48),
    ("NVIDIA L40", 48),
    ("NVIDIA L40S", 48),
    ("NVIDIA RTX 6000 Ada Generation", 48),
]

available_gpus = []

for gpu_id, vram in target_gpus:
    # Build query using gpuTypes with lowestPrice filtering by datacenter
    query = f"""
    query {{
      gpuTypes(input: {{id: "{gpu_id}"}}) {{
        id
        displayName
        memoryInGb
        lowestPrice(input: {{
          dataCenterId: "{DATACENTER_ID}"
          gpuCount: 1
        }}) {{
          uninterruptablePrice
          stockStatus
          maxUnreservedGpuCount
        }}
      }}
    }}
    """

    result = runpod.api.graphql.run_graphql_query(query)

    if "errors" not in result:
        gpu_types = result.get("data", {}).get("gpuTypes", [])
        if gpu_types and len(gpu_types) > 0:
            gpu_data = gpu_types[0]
            price_info = gpu_data.get("lowestPrice")

            # Check if GPU is available (has pricing and positive count)
            if price_info and price_info.get("maxUnreservedGpuCount", 0) > 0:
                price = price_info.get("uninterruptablePrice", 0)
                stock = price_info.get("stockStatus", "Unknown")
                count = price_info.get("maxUnreservedGpuCount", 0)

                available_gpus.append({
                    "id": gpu_id,
                    "vram": vram,
                    "price": price,
                    "stock": stock,
                    "count": count
                })

if not available_gpus:
    logger.error(f"No GPUs with 24-48GB VRAM available in {DATACENTER_ID}")
    logger.info("Your network volume may be in a datacenter with limited GPU availability")
else:
    # Sort by price
    available_gpus.sort(key=lambda x: x["price"])

    logger.success(f"Found {len(available_gpus)} available GPU(s) in {DATACENTER_ID}:")

    for gpu in available_gpus:
        print(f"\n{gpu['id']}")
        print(f"  VRAM: {gpu['vram']} GB")
        print(f"  Price: ${gpu['price']:.2f}/hr")
        print(f"  Stock: {gpu['stock']} ({gpu['count']} available)")
