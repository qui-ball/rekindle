#!/usr/bin/env python3
"""
RunPod Pod Launcher with Network Volume Support

This script provides functionality to launch RunPod pods with network volumes,
wait for them to become ready, and terminate them when work is complete.

Usage:
    python backend/scripts/launch_runpod_pod.py --name my-pod --gpu "NVIDIA GeForce RTX 4090"
    python backend/scripts/launch_runpod_pod.py --terminate <pod_id>
"""

import os
import time
import argparse
import requests
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv
from loguru import logger
import runpod

# Load environment variables
load_dotenv()


class RunPodLauncher:
    """RunPod pod launcher with network volume support"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize RunPod launcher

        Args:
            api_key: RunPod API key (defaults to RUNPOD_API_KEY env var)
        """
        self.api_key = api_key or os.getenv("RUNPOD_API_KEY")
        print(f"RUNPOD_API_KEY: {self.api_key}")
        if not self.api_key:
            raise ValueError("RUNPOD_API_KEY environment variable not set")

        runpod.api_key = self.api_key

        # Network volume configuration
        self.network_volume_id = "366etpkt4g"  # Rekindle-ComfyUI volume (EU-CZ-1)
        self.default_image = "bilunsun/comfyuiprod:pod-test-1"
        self.default_timeout = 300  # 5 minutes
        self.default_cloud_type = "ALL"
        self.default_ports = "8188/http"
        self.volume_mount_path = "/workspace"

        # Pod configuration defaults
        self.default_gpu_count = 1
        self.default_volume_gb = 100  # Minimal pod volume (using network volume instead)
        self.default_container_disk_gb = 10  # Just enough for OS + Docker layers
        self.default_min_vcpu = 2
        self.default_min_memory_gb = 15

    def launch_pod(
        self,
        name: str,
        gpu_type_id: str,
        gpu_count: int = None,
        cloud_type: str = None,
        env_vars: Optional[List[Dict[str, str]]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Launch a RunPod pod with network volume using GraphQL API

        Args:
            name: Name for the pod
            gpu_type_id: GPU type (e.g., "NVIDIA GeForce RTX 4090")
            gpu_count: Number of GPUs (default: 1)
            cloud_type: Cloud type - ALL, SECURE, or COMMUNITY (default: ALL)
            env_vars: List of environment variables as [{"key": "VAR", "value": "val"}]
            **kwargs: Additional pod configuration options

        Returns:
            Dict containing pod information including pod ID

        Raises:
            Exception: If pod launch fails
        """
        gpu_count = gpu_count or self.default_gpu_count
        cloud_type = cloud_type or self.default_cloud_type

        # Prepare environment variables
        env_list = env_vars or []
        env_str = ", ".join(
            [f'{{key: "{e["key"]}", value: "{e["value"]}"}}' for e in env_list]
        )

        # Build input parameters
        volume_gb = kwargs.get("volume_gb", self.default_volume_gb)
        container_disk_gb = kwargs.get(
            "container_disk_gb", self.default_container_disk_gb
        )
        min_vcpu = kwargs.get("min_vcpu", self.default_min_vcpu)
        min_memory_gb = kwargs.get("min_memory_gb", self.default_min_memory_gb)
        docker_args = kwargs.get("docker_args", "")
        ports = kwargs.get("ports", self.default_ports)

        logger.info(f"Launching pod '{name}' with GPU: {gpu_type_id}")
        logger.debug(f"Config: {cloud_type}, {gpu_count}x GPU, {volume_gb}GB volume")

        # Build GraphQL mutation with embedded variables
        mutation = f"""
        mutation {{
          podFindAndDeployOnDemand(input: {{
            cloudType: {cloud_type}
            gpuCount: {gpu_count}
            volumeInGb: {volume_gb}
            containerDiskInGb: {container_disk_gb}
            minVcpuCount: {min_vcpu}
            minMemoryInGb: {min_memory_gb}
            gpuTypeId: "{gpu_type_id}"
            name: "{name}"
            imageName: "{self.default_image}"
            dockerArgs: "{docker_args}"
            ports: "{ports}"
            volumeMountPath: "{self.volume_mount_path}"
            networkVolumeId: "{self.network_volume_id}"
            env: [{env_str}]
          }}) {{
            id
            desiredStatus
            imageName
            env
            machineId
            machine {{
              gpuDisplayName
            }}
          }}
        }}
        """

        try:
            # Execute GraphQL mutation
            result = runpod.api.graphql.run_graphql_query(mutation)

            if "errors" in result:
                error_msg = result["errors"]
                logger.error(f"GraphQL error: {error_msg}")
                raise Exception(f"Failed to launch pod: {error_msg}")

            pod_data = result.get("data", {}).get("podFindAndDeployOnDemand")
            if not pod_data:
                logger.error(f"No pod data in response: {result}")
                raise Exception("No pod data returned from API")

            pod_id = pod_data.get("id")
            gpu_name = pod_data.get("machine", {}).get("gpuDisplayName", "Unknown")

            logger.success(f"Pod launched successfully!")
            logger.info(f"Pod ID: {pod_id}")
            logger.info(f"GPU: {gpu_name}")
            logger.info(f"Status: {pod_data.get('desiredStatus')}")

            return pod_data

        except Exception as e:
            logger.error(f"Error launching pod: {e}")
            raise

    def wait_for_ready(
        self, pod_id: str, timeout: int = None, poll_interval: float = 5.0
    ) -> bool:
        """
        Wait for pod to be ready (RUNNING state)

        Args:
            pod_id: Pod ID to wait for
            timeout: Maximum time to wait in seconds (default: 300)
            poll_interval: Time between status checks in seconds (default: 5.0)

        Returns:
            True if pod becomes ready, raises TimeoutError otherwise

        Raises:
            TimeoutError: If pod doesn't become ready within timeout
            Exception: If pod enters FAILED state
        """
        timeout = timeout or self.default_timeout
        start_time = time.time()

        logger.info(
            f"Waiting for pod {pod_id} to become ready (timeout: {timeout}s)..."
        )

        comfyui_url = None  # Will be set once we get the pod's public IP

        while time.time() - start_time < timeout:
            try:
                # GraphQL query to get pod status and connection info
                query = f"""
                query {{
                  pod(input: {{podId: "{pod_id}"}}) {{
                    id
                    desiredStatus
                    runtime {{
                      uptimeInSeconds
                      ports {{
                        ip
                        isIpPublic
                        privatePort
                        publicPort
                        type
                      }}
                      gpus {{
                        id
                        gpuUtilPercent
                      }}
                    }}
                  }}
                }}
                """

                result = runpod.api.graphql.run_graphql_query(query)

                if "errors" in result:
                    logger.warning(f"Error checking status: {result['errors']}")
                    time.sleep(poll_interval)
                    continue

                pod_data = result.get("data", {}).get("pod")
                if not pod_data:
                    logger.debug("No pod data yet, waiting...")
                    time.sleep(poll_interval)
                    continue

                status = pod_data.get("desiredStatus", "UNKNOWN")
                runtime = pod_data.get("runtime")
                uptime = runtime.get("uptimeInSeconds", 0) if runtime else 0

                # Check for failure states
                if status in ["FAILED", "TERMINATED", "EXITED"]:
                    logger.error(f"Pod entered {status} state")
                    raise Exception(f"Pod failed to start: status={status}")

                # Once pod is RUNNING, try to connect to ComfyUI
                if status == "RUNNING" and runtime:
                    # Use RunPod's proxy URL format: {pod_id}-{port}.proxy.runpod.net
                    if not comfyui_url:
                        comfyui_url = f"https://{pod_id}-8188.proxy.runpod.net"
                        logger.info(f"Using RunPod proxy endpoint: {comfyui_url}")

                    # Try to ping ComfyUI
                    try:
                        # Try to connect to ComfyUI's system_stats endpoint
                        response = requests.get(
                            f"{comfyui_url}/system_stats", timeout=5, verify=True
                        )
                        if response.status_code == 200:
                            logger.success(
                                f"Pod {pod_id} is ready! ComfyUI responding at {comfyui_url} (uptime: {uptime}s)"
                            )
                            return True
                        else:
                            logger.debug(
                                f"ComfyUI returned status {response.status_code}, still initializing..."
                            )
                    except requests.exceptions.RequestException as e:
                        logger.debug(f"ComfyUI not ready yet: {type(e).__name__}")

                    # Log progress
                    elapsed = time.time() - start_time
                    logger.info(
                        f"Status: {status}, uptime: {uptime}s, waiting for ComfyUI to respond (elapsed: {elapsed:.0f}s/{timeout}s)"
                    )
                else:
                    # Not running yet
                    elapsed = time.time() - start_time
                    logger.info(
                        f"Status: {status} (elapsed: {elapsed:.0f}s/{timeout}s)"
                    )

                time.sleep(poll_interval)

            except Exception as e:
                logger.error(f"Error checking pod status: {e}")
                time.sleep(poll_interval)

        raise TimeoutError(
            f"Pod {pod_id} did not become ready within {timeout} seconds"
        )

    def terminate_pod(self, pod_id: str) -> bool:
        """
        Terminate (delete) a pod

        Args:
            pod_id: ID of pod to terminate

        Returns:
            True if termination succeeded

        Raises:
            Exception: If termination fails
        """
        logger.info(f"Terminating pod {pod_id}...")

        mutation = f"""
        mutation {{
          podTerminate(input: {{podId: "{pod_id}"}})
        }}
        """

        try:
            result = runpod.api.graphql.run_graphql_query(mutation)

            if "errors" in result:
                error_msg = result["errors"]
                logger.error(f"GraphQL error: {error_msg}")
                raise Exception(f"Failed to terminate pod: {error_msg}")

            logger.success(f"Pod {pod_id} terminated successfully")
            return True

        except Exception as e:
            logger.error(f"Error terminating pod: {e}")
            raise

    def get_pod_info(self, pod_id: str) -> Optional[Dict[str, Any]]:
        """
        Get information about a pod

        Args:
            pod_id: Pod ID

        Returns:
            Pod information dict or None if not found
        """
        query = f"""
        query {{
          pod(input: {{podId: "{pod_id}"}}) {{
            id
            name
            desiredStatus
            imageName
            machine {{
              gpuDisplayName
            }}
            runtime {{
              uptimeInSeconds
              ports {{
                ip
                isIpPublic
                privatePort
                publicPort
                type
              }}
            }}
          }}
        }}
        """

        try:
            result = runpod.api.graphql.run_graphql_query(query)

            if "errors" in result:
                logger.error(f"Error getting pod info: {result['errors']}")
                return None

            return result.get("data", {}).get("pod")

        except Exception as e:
            logger.error(f"Error getting pod info: {e}")
            return None


def main():
    """CLI interface for the pod launcher"""
    parser = argparse.ArgumentParser(
        description="Launch and manage RunPod pods with network volumes"
    )

    # Create subcommands
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # Launch command
    launch_parser = subparsers.add_parser("launch", help="Launch a new pod")
    launch_parser.add_argument("--name", required=True, help="Name for the pod")
    launch_parser.add_argument(
        "--gpu", required=True, help='GPU type (e.g., "NVIDIA GeForce RTX 4090")'
    )
    launch_parser.add_argument(
        "--gpu-count", type=int, default=1, help="Number of GPUs (default: 1)"
    )
    launch_parser.add_argument(
        "--cloud-type",
        choices=["ALL", "SECURE", "COMMUNITY"],
        default="ALL",
        help="Cloud type (default: ALL)",
    )
    launch_parser.add_argument(
        "--no-wait",
        action="store_true",
        help="Don't wait for pod to be ready",
    )
    launch_parser.add_argument(
        "--timeout",
        type=int,
        default=300,
        help="Timeout in seconds for waiting (default: 300)",
    )

    # Terminate command
    terminate_parser = subparsers.add_parser("terminate", help="Terminate a pod")
    terminate_parser.add_argument("pod_id", help="Pod ID to terminate")

    # Info command
    info_parser = subparsers.add_parser("info", help="Get pod information")
    info_parser.add_argument("pod_id", help="Pod ID")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    # Initialize launcher
    try:
        launcher = RunPodLauncher()
    except ValueError as e:
        logger.error(f"Failed to initialize: {e}")
        return 1

    # Execute command
    try:
        if args.command == "launch":
            pod = launcher.launch_pod(
                name=args.name,
                gpu_type_id=args.gpu,
                gpu_count=args.gpu_count,
                cloud_type=args.cloud_type,
            )

            if not args.no_wait:
                launcher.wait_for_ready(pod["id"], timeout=args.timeout)
            else:
                logger.info(f"Pod launched with ID: {pod['id']}")

        elif args.command == "terminate":
            launcher.terminate_pod(args.pod_id)

        elif args.command == "info":
            info = launcher.get_pod_info(args.pod_id)
            if info:
                logger.info(f"Pod Information:\n{info}")
            else:
                logger.error("Pod not found or error retrieving info")
                return 1

    except Exception as e:
        logger.error(f"Command failed: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
