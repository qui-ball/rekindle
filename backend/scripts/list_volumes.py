#!/usr/bin/env python3
"""Quick script to list RunPod network volumes"""

import os
from dotenv import load_dotenv
import runpod
from loguru import logger

# Load environment variables from .env file
load_dotenv()

# Set API key
runpod.api_key = os.getenv("RUNPOD_API_KEY")

# GraphQL query to list network volumes
query = """
query {
  myself {
    networkVolumes {
      id
      name
      size
      dataCenterId
    }
  }
}
"""

result = runpod.api.graphql.run_graphql_query(query)

if "errors" in result:
    logger.error(f"Error: {result['errors']}")
else:
    volumes = result.get("data", {}).get("myself", {}).get("networkVolumes", [])

    if not volumes:
        logger.warning("No network volumes found")
    else:
        logger.info(f"Found {len(volumes)} network volume(s):")
        for vol in volumes:
            print(f"\nID: {vol['id']}")
            print(f"  Name: {vol['name']}")
            print(f"  Size: {vol['size']} GB")
            print(f"  Datacenter: {vol['dataCenterId']}")
