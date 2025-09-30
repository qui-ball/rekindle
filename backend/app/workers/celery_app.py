"""
Celery application configuration
"""

from celery import Celery
from app.core.config import settings

# Create Celery instance
celery_app = Celery(
    "rekindle",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks.jobs"],
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,  # 10 minutes
    task_soft_time_limit=300,  # 5 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
)
