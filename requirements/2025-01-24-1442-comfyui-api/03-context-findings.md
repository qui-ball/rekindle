# Context Findings

## Current Backend Structure

### Directory Layout
- `backend/app/` - Main application directory
- `backend/app/core/` - Core configurations
- **Missing:** `backend/app/api/` - API routes directory needs to be created
- **Missing:** Celery worker implementation
- **Missing:** S3 upload service

### Existing Files to Integrate
- `backend/app/run_restore.py` - ComfyUI client implementation
- `backend/app/restore.json` - ComfyUI workflow definition

### Technology Stack Identified
1. **Framework:** FastAPI
2. **Database:** PostgreSQL with SQLAlchemy
3. **Job Queue:** Celery + Redis (dependencies installed but not implemented)
4. **Storage:** AWS S3 (boto3 installed, config exists)
5. **Auth:** Auth0 (config exists)

### Configuration Available
From `backend/app/core/config.py`:
- Redis URL configured
- S3 bucket and CloudFront configured
- Auth0 domain and audience configured
- File upload settings (max 50MB, allowed types)

### Implementation Patterns Needed
1. **API Structure:** Need to create:
   - `backend/app/api/` directory
   - `backend/app/api/__init__.py`
   - `backend/app/api/routes.py` (main router)
   - `backend/app/api/v1/` directory for versioned endpoints
   - `backend/app/api/v1/restoration.py` for restoration endpoint

2. **Celery Tasks:** Need to create:
   - `backend/app/workers/` directory
   - `backend/app/workers/celery_app.py` (Celery instance)
   - `backend/app/workers/tasks/restoration.py` (restoration task)

3. **Services:** Need to create:
   - `backend/app/services/` directory
   - `backend/app/services/s3.py` (S3 upload/download)
   - `backend/app/services/comfyui.py` (ComfyUI client wrapper)

4. **Models:** Need to create:
   - `backend/app/models/` directory
   - `backend/app/models/restoration.py` (database models)
   - `backend/app/schemas/` directory
   - `backend/app/schemas/restoration.py` (Pydantic schemas)

### Integration Points
1. The `run_restore.py` script needs to be refactored into a service class
2. The `restore.json` workflow needs to be moved to a config directory
3. Need to handle image upload to S3 before processing
4. Need to download from ComfyUI and upload result to S3
5. Need to track job status in database

### Technical Constraints
- ComfyUI server runs on localhost:8188
- Image restoration is a long-running process (needs async handling)
- Need to handle concurrent requests (multiple workers)
- Auth0 authentication required for API endpoints
- Files need to be stored in S3 with CloudFront CDN

### Similar Features Analysis
No similar features found in current codebase - this is the first async job processing implementation.