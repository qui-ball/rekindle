# Context Findings

## Existing Codebase Analysis

### Configuration
- **RUNPOD_API_KEY**: Already configured in `backend/app/core/config.py:36` and `.env.example`
- **Project Structure**: Backend uses FastAPI with services pattern (`backend/app/services/`)
- **Similar Service**: `backend/app/services/comfyui.py` provides good pattern for external service integration

### Existing RunPod Infrastructure
Found on remote machine (`bilunsun@bilunsun-desktop-internal:~/Git/ComfyUI-Rekindle/`):

1. **Dockerfile**: Custom ComfyUI image for RunPod Pods
   - Based on `runpod/comfyui:latest`
   - Exposes port 8188
   - Uses `/workspace/outputs` and `/workspace/inputs` (network volume paths)
   - Configured for both direct access and serverless handler mode

2. **RunPod Handler** (`rp_handler.py`):
   - Serverless worker implementation
   - Handles ComfyUI workflow execution
   - Uses `runpod.serverless.start()` pattern
   - Manages lifecycle: start ComfyUI → submit prompt → poll completion → collect files

### Service Patterns in Codebase
From `backend/app/services/comfyui.py`:
- Class-based service with `__init__` accepting base URL
- Methods: `queue_prompt()`, `wait_for_completion()`, `upload_image()`, `download_image()`
- Uses `loguru` for logging
- Global service instance pattern at bottom of file

## RunPod API Research

### Python SDK (runpod package)
- **Installation**: `pip install runpod` or `uv add runpod`
- **Python Requirement**: 3.8+
- **API Key**: Set via `runpod.api_key = "your_key"`

### Pod Management Methods
```python
# Basic pod operations
runpod.create_pod(name, image, gpu_type)
runpod.get_pods()
runpod.get_pod(pod_id)
runpod.stop_pod(pod_id)
runpod.resume_pod(pod_id)
runpod.terminate_pod(pod_id)
```

### GraphQL API (underlying the SDK)
Two main mutations for pod creation:

1. **On-Demand Pods**: `podFindAndDeployOnDemand`
   - Parameters: `cloudType: ALL`, `volumeInGb`, `containerDiskInGb`
   - Guaranteed availability

2. **Spot/Interruptable Pods**: `podRentInterruptable`
   - Parameters: `bidPerGpu`, `cloudType: SECURE`
   - Cost-effective but can be interrupted

### Network Volume Integration
From Pulumi examples and GitHub issues:
```python
# Key parameters for pod with network volume
network_volume_id: str  # Reference to existing volume
volume_in_gb: int       # Size of persistent volume
container_disk_in_gb: int  # Ephemeral container storage
volume_mount_path: str  # Where to mount (e.g., "/workspace")
```

**Important**: The basic `runpod.create_pod()` method may not support all parameters. For full control (especially network volumes), may need to use GraphQL API directly or extended SDK methods.

### GPU Types & Templates
- **GPU Types**: RTX 4090, A5000, A40, A4000, H100, etc.
- **Templates**: Docker container images with configuration
  - Official templates (RunPod maintained)
  - Community templates (user shared)
  - Custom templates (user created)
- **Cloud Types**: `ALL`, `SECURE`, `COMMUNITY`

### Cost Considerations
- Pay-per-second billing
- Volume storage charged even when pod is stopped
- On-demand vs spot pricing differences

## Recommended Implementation Approach

### Script Location
Create standalone script: `backend/scripts/launch_runpod_pod.py`
- Follows project structure (keep in backend for consistency)
- Separate from main app code (standalone requirement)
- Easy to run directly: `uv run python backend/scripts/launch_runpod_pod.py`

### Dependencies
Add to `backend/pyproject.toml`:
```toml
runpod = "^1.0.0"  # or latest version
```

### Script Structure (based on similar patterns)
```python
#!/usr/bin/env python3
"""RunPod pod launcher with network volume support"""

import runpod
from typing import Optional
import os
from loguru import logger

class RunPodLauncher:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("RUNPOD_API_KEY")
        runpod.api_key = self.api_key

    def launch_pod(
        self,
        name: str,
        image_name: str,
        gpu_type_id: str,
        network_volume_id: str,
        **kwargs
    ) -> dict:
        """Launch pod with network volume"""
        # Implementation here
        pass

    def wait_for_ready(self, pod_id: str) -> bool:
        """Wait for pod to be ready"""
        pass

    def terminate_pod(self, pod_id: str) -> bool:
        """Delete pod when job is done"""
        pass
```

### Integration Points (Future)
While building standalone script now, design for future integration:
- Could be imported into `backend/app/services/runpod.py` later
- Compatible with Celery task pattern (like `comfyui_service`)
- Environment variable based configuration (already have RUNPOD_API_KEY)

## Files to Reference During Implementation
- `backend/app/services/comfyui.py` - Service class pattern
- `backend/app/core/config.py` - Configuration pattern
- Remote: `~/Git/ComfyUI-Rekindle/Dockerfile` - Pod image template
- Remote: `~/Git/ComfyUI-Rekindle/rp_handler.py` - Serverless handler pattern

## Technical Constraints
1. Network volume ID must be known in advance (user has existing volume)
2. Need to support multiple GPU configurations (user requirement)
3. Lifecycle: launch → wait for ready → (do work) → terminate
4. Script should be standalone (no FastAPI/Celery dependencies for now)
