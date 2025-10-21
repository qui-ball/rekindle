"""
Main API router
"""

from fastapi import APIRouter

from app.api.v1.jobs import router as jobs_router
from app.api.v1.webhooks import router as webhooks_router

# Create main API router
api_router = APIRouter()

# Include v1 routes
api_router.include_router(
    jobs_router, prefix="/v1/jobs", tags=["jobs"]
)
api_router.include_router(
    webhooks_router, prefix="/v1/webhooks", tags=["webhooks"]
)
