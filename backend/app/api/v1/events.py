"""
SSE (Server-Sent Events) endpoint for real-time job updates
"""

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse, ServerSentEvent
import asyncio
import json
from typing import Dict, Any
from loguru import logger

router = APIRouter()


class JobEventManager:
    """Simple in-memory SSE event manager"""

    def __init__(self):
        # job_id -> list of queues
        self.subscribers: Dict[str, list] = {}

    async def subscribe(self, job_id: str):
        """
        Generator that yields SSE events for a job
        Keeps connection open and sends events as they arrive
        """
        queue = asyncio.Queue()

        # Register subscriber
        if job_id not in self.subscribers:
            self.subscribers[job_id] = []
        self.subscribers[job_id].append(queue)

        logger.info(f"📡 [JobEventManager] New subscriber for job: {job_id}")
        logger.info(
            f"📡 [JobEventManager] Current subscribers count: {len(self.subscribers[job_id])}"
        )

        try:
            while True:
                # Wait for events
                event = await queue.get()
                yield event
        finally:
            # Cleanup on disconnect
            self.subscribers[job_id].remove(queue)
            if not self.subscribers[job_id]:
                del self.subscribers[job_id]
            logger.info(
                f"🔌 [JobEventManager] Subscriber disconnected for job: {job_id}"
            )

    async def notify(self, job_id: str, event_type: str, data: Dict[str, Any]):
        """
        Send event to all subscribers listening to this job
        """
        if job_id in self.subscribers:
            subscriber_count = len(self.subscribers[job_id])
            logger.info(
                f"✅ [JobEventManager] Notifying {subscriber_count} subscribers for job: {job_id}"
            )

            # Format: SSE events using ServerSentEvent class
            event_data = json.dumps(data)
            event = ServerSentEvent(data=event_data, event=event_type)

            # Send to all subscribers
            for queue in self.subscribers[job_id]:
                try:
                    await queue.put(event)
                except Exception as e:
                    logger.error(f"❌ [JobEventManager] Error sending SSE event: {e}")


# Global instance
job_events = JobEventManager()


@router.get("/{job_id}")
async def job_event_stream(job_id: str):
    """
    SSE endpoint for job updates

    Usage from frontend:
        const eventSource = new EventSource('/api/v1/events/{job_id}');
        eventSource.addEventListener('completed', (e) => {
            const data = JSON.parse(e.data);
            console.log('Job completed:', data);
        });
    """
    return EventSourceResponse(job_events.subscribe(job_id))
