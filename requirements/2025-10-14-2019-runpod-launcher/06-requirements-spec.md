# Requirements Specification: RunPod Pod Launcher

**Date:** 2025-10-14
**ID:** runpod-launcher
**Status:** Ready for Implementation

---

## Problem Statement

The user needs the ability to programmatically launch RunPod pods with network volumes attached for running AI processing workloads. Currently, there is no automated way to:
- Launch a pod with the user's existing network volume
- Configure GPU types based on availability and requirements
- Wait for the pod to be ready before proceeding
- Terminate the pod after work is complete

The existing codebase has `RUNPOD_API_KEY` configured but no RunPod service implementation. A standalone Python script is needed to handle pod lifecycle management independently of the main FastAPI application.

## Solution Overview

Create a standalone Python script (`backend/scripts/launch_runpod_pod.py`) that:
1. Uses the RunPod Python SDK to launch pods programmatically
2. Attaches an existing network volume (hardcoded for now)
3. Supports configurable GPU type filtering
4. Uses the user's existing Docker image (`bilunsun/comfyuiprod:pod-test-0`)
5. Waits for pod readiness before completing
6. Provides methods to terminate pods when work is done
7. Follows existing service patterns from the codebase

---

## Functional Requirements

### FR1: Pod Launch
The script must be able to launch a RunPod pod with the following specifications:
- **Docker Image**: `bilunsun/comfyuiprod:pod-test-0` (user's pre-built ComfyUI image)
- **Network Volume**: Attach existing network volume (ID hardcoded in script)
- **GPU Type**: Configurable, with ability to filter/limit GPU types
- **Pod Name**: Configurable or auto-generated
- **Cloud Type**: Support different cloud types (ALL, SECURE, COMMUNITY)

### FR2: Pod Readiness Detection
The script must wait for the pod to reach a "RUNNING" state before considering the launch successful. This includes:
- Polling pod status at regular intervals
- Timeout handling (configurable timeout period)
- Clear logging of pod state transitions

### FR3: Pod Termination
The script must provide a method to terminate (delete) the pod when work is complete:
- Accept pod ID as parameter
- Confirm termination success
- Handle errors gracefully

### FR4: GPU Type Configuration
The script must support specifying GPU types with the following capabilities:
- Accept GPU type ID as parameter (e.g., "NVIDIA GeForce RTX 4090", "NVIDIA A40")
- Support filtering to specific GPU types
- Note: GPU availability will be restricted by network volume's datacenter location

### FR5: Error Handling
The script must handle common error scenarios:
- Invalid API key
- No available pods matching criteria
- Timeout waiting for pod readiness
- Network errors during API calls
- Pod launch failures

### FR6: Output Management
The script does NOT need to handle downloading/managing output files from the network volume (files persist independently on the volume).

---

## Technical Requirements

### TR1: Script Location and Structure
- **File Path**: `backend/scripts/launch_runpod_pod.py`
- **Pattern**: Class-based service similar to `backend/app/services/comfyui.py`
- **Logging**: Use `loguru` for consistent logging (already in project)
- **Executable**: Should be runnable as standalone script

### TR2: Dependencies
Add to `backend/pyproject.toml`:
```toml
[project.dependencies]
runpod = "^1.7.0"  # or latest stable version
```

Install with: `uv add runpod`

### TR3: Configuration
- **API Key**: Read from environment variable `RUNPOD_API_KEY` (already configured in `backend/app/core/config.py:36`)
- **Network Volume ID**: Hardcoded in script for now (future: make configurable)
- **Docker Image**: Hardcoded as `bilunsun/comfyuiprod:pod-test-0`
- **Default Timeout**: 300 seconds (5 minutes) for pod readiness

### TR4: RunPod API Integration
Based on research, use the RunPod Python SDK:

```python
import runpod

# Set API key
runpod.api_key = os.getenv("RUNPOD_API_KEY")

# Basic pod creation (may need GraphQL for full control)
pod = runpod.create_pod(
    name="pod_name",
    image_name="bilunsun/comfyuiprod:pod-test-0",
    gpu_type_id="NVIDIA GeForce RTX 4090"
)

# Pod lifecycle operations
runpod.get_pod(pod_id)
runpod.stop_pod(pod_id)
runpod.terminate_pod(pod_id)
```

**Important Note**: The basic `runpod.create_pod()` may not support all parameters (especially `network_volume_id`). If needed, use the GraphQL API directly via `runpod.api.graphql()` with the `podFindAndDeployOnDemand` mutation.

### TR5: GraphQL API (if needed for network volumes)
Reference from research findings:

```python
mutation_query = """
mutation {
  podFindAndDeployOnDemand(
    input: {
      cloudType: ALL
      gpuCount: 1
      volumeInGb: 50
      containerDiskInGb: 50
      minVcpuCount: 2
      minMemoryInGb: 15
      gpuTypeId: "NVIDIA GeForce RTX 4090"
      name: "ComfyUI Processing Pod"
      imageName: "bilunsun/comfyuiprod:pod-test-0"
      dockerArgs: ""
      ports: "8188/http"
      volumeMountPath: "/workspace"
      networkVolumeId: "YOUR_VOLUME_ID"
      env: [
        {key: "ENV_VAR", value: "value"}
      ]
    }
  ) {
    id
    desiredStatus
    imageName
    env
    machineId
    machine {
      gpuDisplayName
    }
  }
}
"""
```

### TR6: Pod Readiness Polling Pattern
Follow similar pattern to `backend/app/services/comfyui.py:39-73`:

```python
def wait_for_ready(self, pod_id: str, timeout: int = 300) -> bool:
    """Wait for pod to be ready"""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            pod = runpod.get_pod(pod_id)
            status = pod.get("desiredStatus")

            if status == "RUNNING":
                logger.success(f"Pod {pod_id} is ready")
                return True
            elif status == "FAILED":
                raise Exception(f"Pod failed to start: {pod}")

            logger.debug(f"Pod status: {status}, waiting...")
            time.sleep(2.0)
        except Exception as e:
            logger.error(f"Error checking pod status: {e}")
            time.sleep(2.0)

    raise TimeoutError(f"Pod {pod_id} did not become ready within {timeout}s")
```

---

## Implementation Hints and Patterns

### Pattern 1: Service Class Structure (from comfyui.py)
```python
class RunPodLauncher:
    def __init__(self, api_key: Optional[str] = None):
        """Initialize with API key from env or parameter"""
        self.api_key = api_key or os.getenv("RUNPOD_API_KEY")
        runpod.api_key = self.api_key

        # Hardcoded configuration
        self.network_volume_id = "YOUR_VOLUME_ID_HERE"
        self.default_image = "bilunsun/comfyuiprod:pod-test-0"
        self.default_timeout = 300

    def launch_pod(self, name: str, gpu_type_id: str, **kwargs) -> Dict[str, Any]:
        """Launch pod with network volume"""
        pass

    def wait_for_ready(self, pod_id: str, timeout: int = None) -> bool:
        """Wait for pod to be ready"""
        pass

    def terminate_pod(self, pod_id: str) -> bool:
        """Terminate pod"""
        pass
```

### Pattern 2: Logging (from comfyui.py)
```python
from loguru import logger

logger.info("Launching pod with GPU: {}", gpu_type_id)
logger.debug("Pod status: {}", status)
logger.success("Pod {} is ready!", pod_id)
logger.error("Error launching pod: {}", error)
```

### Pattern 3: Error Handling (from comfyui.py:35-37)
```python
try:
    # API call
    response = runpod.create_pod(...)
except Exception as e:
    logger.error("Error launching pod: {}", e)
    raise
```

### Pattern 4: Standalone Script Execution
```python
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Launch RunPod pod")
    parser.add_argument("--name", required=True, help="Pod name")
    parser.add_argument("--gpu", required=True, help="GPU type ID")
    args = parser.parse_args()

    launcher = RunPodLauncher()
    pod = launcher.launch_pod(args.name, args.gpu)
    logger.info(f"Pod launched: {pod}")
```

---

## Reference Files

### Files to Study
1. **`backend/app/services/comfyui.py`** - Service class pattern, API integration, polling pattern
2. **`backend/app/core/config.py:36`** - RUNPOD_API_KEY configuration
3. **`backend/.env.example:13`** - Environment variable reference
4. **Remote: `~/Git/ComfyUI-Rekindle/Dockerfile`** - Docker image that will be used
5. **Remote: `~/Git/ComfyUI-Rekindle/rp_handler.py`** - RunPod serverless handler (different pattern, but useful context)

### Existing Patterns to Follow
- Class-based service design
- Environment variable configuration via `os.getenv()`
- Loguru logging with f-string formatting
- Try-except error handling with logging
- Polling with timeout pattern
- Global instance pattern (optional for standalone script)

---

## Acceptance Criteria

### AC1: Pod Launch Success
- [ ] Script can successfully launch a RunPod pod
- [ ] Pod uses the specified Docker image (`bilunsun/comfyuiprod:pod-test-0`)
- [ ] Network volume is attached and accessible at `/workspace`
- [ ] GPU type can be specified and is respected
- [ ] Pod ID is returned upon successful launch

### AC2: Readiness Detection
- [ ] Script waits for pod to reach "RUNNING" state
- [ ] Timeout mechanism works (default 300s)
- [ ] Clear log messages show state transitions
- [ ] Returns True when pod is ready
- [ ] Raises TimeoutError if timeout exceeded

### AC3: Pod Termination
- [ ] Script can terminate a pod given its ID
- [ ] Termination is confirmed through API
- [ ] Errors during termination are logged and handled

### AC4: Error Handling
- [ ] Invalid API key produces clear error message
- [ ] Network errors are caught and logged
- [ ] Pod launch failures are reported clearly
- [ ] Timeout scenarios are handled gracefully

### AC5: Code Quality
- [ ] Follows existing code patterns from `comfyui.py`
- [ ] Uses loguru for all logging
- [ ] Includes docstrings for all public methods
- [ ] Type hints where appropriate
- [ ] Can be run as standalone script: `uv run python backend/scripts/launch_runpod_pod.py`

### AC6: Configuration
- [ ] RUNPOD_API_KEY read from environment
- [ ] Network volume ID is hardcoded (with comment for future improvement)
- [ ] Docker image is hardcoded as `bilunsun/comfyuiprod:pod-test-0`
- [ ] GPU type is configurable via parameter

---

## Future Enhancements (Out of Scope for Initial Implementation)

1. **Integration with FastAPI**: Create `backend/app/services/runpod.py` for use in API endpoints
2. **Celery Task**: Add to `backend/app/workers/tasks/` for background pod management
3. **Configuration File**: Move hardcoded values to config or environment variables
4. **Multiple Network Volumes**: Support for different volumes via parameters
5. **Pod Templates**: Predefined configurations for different workload types
6. **Cost Tracking**: Log GPU hours and estimated costs
7. **Auto-scaling**: Launch multiple pods based on queue depth
8. **Spot Instance Support**: Use `podRentInterruptable` mutation for cost savings

---

## Assumptions

1. User has a valid RunPod API key configured in environment
2. Network volume already exists and user knows its ID
3. Docker image `bilunsun/comfyuiprod:pod-test-0` is already built and pushed to Docker Hub
4. Network volume is in a specific datacenter, which limits GPU availability
5. RunPod Python SDK version 1.7.0+ is used (latest stable)
6. Script will be run from project root: `uv run python backend/scripts/launch_runpod_pod.py`

---

## Notes

- **GPU Type Constraint**: GPU availability will be restricted by the network volume's datacenter location. The script should handle cases where no GPUs of the requested type are available in that datacenter.
- **Network Volume Persistence**: The network volume persists independently of pods. Files written to `/workspace` will remain after pod termination.
- **Port Exposure**: The Docker image exposes port 8188 for ComfyUI. If accessing externally, may need to configure port mapping in pod creation.
- **Billing**: User is charged for pod runtime (GPU time) and network volume storage separately. Terminate pods promptly when not in use.
