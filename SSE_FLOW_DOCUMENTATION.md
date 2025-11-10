# SSE (Server-Sent Events) Implementation - Complete Flow

**Date**: November 7, 2025  
**Status**: ✅ **ENABLED AND ACTIVE**

## Overview

The SSE implementation allows real-time notification to the frontend when a restore job completes, automatically re-rendering the new picture without polling.

---

## Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER STARTS RESTORE JOB                                       │
│    ├─ Frontend: User clicks "Restore" in PhotoDetailDrawer      │
│    ├─ handleProcessingStart() is called                          │
│    ├─ POST /api/v1/jobs/{job_id}/restore                        │
│    └─ setActiveJobId(job_id) triggers SSE connection            │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. SSE CONNECTION ESTABLISHED                                    │
│    ├─ useJobEvents hook connects to /api/v1/events/{job_id}    │
│    ├─ EventSource keeps connection open                         │
│    └─ Frontend logs: "📡 SSE connected for job {job_id}"        │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. BACKEND PROCESSES JOB (Celery Task)                          │
│    ├─ process_restoration() task starts                         │
│    ├─ Downloads image from S3                                   │
│    ├─ Uploads to RunPod network volume                          │
│    ├─ Submits workflow to RunPod serverless                     │
│    ├─ Registers webhook URL for completion                      │
│    └─ Task returns (job is now "pending" on RunPod)             │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. RUNPOD PROCESSES IMAGE                                        │
│    ├─ RunPod serverless worker picks up job                     │
│    ├─ ComfyUI processes image with restore workflow             │
│    └─ Output saved to /workspace/outputs/restored.jpg           │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. RUNPOD WEBHOOK COMPLETION                                     │
│    ├─ RunPod POSTs to /api/v1/webhooks/runpod-completion       │
│    ├─ Payload includes: {id, status, output: {files: [...]}}   │
│    ├─ Backend finds RestoreAttempt by runpod_job_id            │
│    ├─ Downloads restored image from RunPod network volume       │
│    ├─ Uploads to S3 (restored/{job_id}/{timestamp}.jpg)        │
│    ├─ Generates thumbnail                                       │
│    ├─ Updates RestoreAttempt.s3_key in database                │
│    └─ Commits transaction                                        │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. SSE NOTIFICATION SENT ⭐ (NEW - JUST ENABLED)                │
│    ├─ await job_events.notify(                                  │
│    │     job_id=job_id,                                          │
│    │     event_type="completed",                                 │
│    │     data={                                                  │
│    │         "job_id": job_id,                                   │
│    │         "restore_id": str(restore.id),                      │
│    │         "status": "completed"                               │
│    │     }                                                        │
│    │ )                                                            │
│    └─ Event pushed to all SSE subscribers for this job_id       │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. FRONTEND RECEIVES SSE EVENT                                   │
│    ├─ EventSource fires 'completed' event                       │
│    ├─ useJobEvents hook's callback triggers                     │
│    ├─ Console logs: "✅ Job completed via SSE: {data}"          │
│    └─ onCompleted callback executes                             │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. FRONTEND RE-RENDERS NEW PICTURE                              │
│    ├─ Updates photo status to 'completed'                       │
│    ├─ Calls photoManagementService.getPhotos() to refresh       │
│    ├─ Updates photos state with new data                        │
│    ├─ UI automatically re-renders with restored image           │
│    ├─ Clears activeJobId (closes SSE connection)                │
│    └─ Console logs: "🔌 SSE disconnected for job {job_id}"      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Code Components

### Backend

#### 1. **SSE Event Manager** (`backend/app/api/v1/events.py`)
- `JobEventManager` class manages SSE subscriptions
- In-memory pub/sub system (job_id → list of queues)
- `subscribe(job_id)` - Generator that yields events to connected clients
- `notify(job_id, event_type, data)` - Broadcasts events to all subscribers

#### 2. **SSE Endpoint** (`backend/app/api/v1/events.py`)
```python
@router.get("/{job_id}")
async def job_event_stream(job_id: str):
    """SSE endpoint for job updates"""
    return EventSourceResponse(job_events.subscribe(job_id))
```

#### 3. **Webhook Handler** (`backend/app/api/v1/webhooks.py`)
- Lines 167-175: **NOW ENABLED** ✅
- Sends SSE notification after successful job completion
- Event type: "completed"
- Data includes: job_id, restore_id, status

#### 4. **API Routes** (`backend/app/api/routes.py`)
- Events router registered at `/api/v1/events`

### Frontend

#### 1. **useJobEvents Hook** (`frontend/src/hooks/useJobEvents.ts`)
```typescript
export function useJobEvents(jobId: string | null, options: UseJobEventsOptions)
```
- Creates EventSource connection to `/api/v1/events/{jobId}`
- Listens for 'completed' events
- Triggers onCompleted callback with event data
- Auto-connects/disconnects based on jobId
- Handles errors and reconnection

#### 2. **PhotoManagementContainer** (`frontend/src/components/PhotoManagement/PhotoManagementContainer.tsx`)
- Line 38: `const [activeJobId, setActiveJobId] = useState<string | null>(null)`
- Line 57-84: useJobEvents hook integration
- Line 312: Sets activeJobId when processing starts
- Lines 58-83: onCompleted callback refreshes photos and clears activeJobId

---

## What Was Changed Today

### Files Modified: 1

**`backend/app/api/v1/webhooks.py`**
1. ✅ Line 16: Uncommented `from app.api.v1.events import job_events`
2. ✅ Lines 167-175: Uncommented SSE notification code

**Changes:**
```python
# BEFORE (commented out):
# from app.api.v1.events import job_events  # Temporarily disabled for debugging

# await job_events.notify(
#     job_id=job_id,
#     event_type="completed",
#     data={...}
# )

# AFTER (enabled):
from app.api.v1.events import job_events

await job_events.notify(
    job_id=job_id,
    event_type="completed",
    data={
        "job_id": job_id,
        "restore_id": str(restore.id),
        "status": "completed",
    }
)
```

---

## Testing the Implementation

### Expected Console Logs (Frontend)

1. **When restore job starts:**
   ```
   📡 SSE connected for job 5ddd8a7c-62a4-4ed1-a610-32746e44cb25
   ```

2. **When job completes:**
   ```
   ✅ Job completed via SSE: {
     job_id: "5ddd8a7c-62a4-4ed1-a610-32746e44cb25",
     restore_id: "a04e7037-9c33-4fc7-a30f-c896f8004552",
     status: "completed"
   }
   Job completed, refreshing photo data...
   ```

3. **When SSE disconnects:**
   ```
   🔌 SSE disconnected for job 5ddd8a7c-62a4-4ed1-a610-32746e44cb25
   ```

### Expected Console Logs (Backend)

1. **When frontend connects:**
   ```
   SSE client connected for job 5ddd8a7c-62a4-4ed1-a610-32746e44cb25
   ```

2. **When webhook notifies:**
   ```
   Notifying 1 SSE clients for job 5ddd8a7c-62a4-4ed1-a610-32746e44cb25
   ```

3. **When frontend disconnects:**
   ```
   SSE client disconnected for job 5ddd8a7c-62a4-4ed1-a610-32746e44cb25
   ```

### Manual Testing Steps

1. Open browser DevTools console
2. Navigate to gallery page
3. Click on a photo to open detail drawer
4. Click "Restore" button
5. Watch console for SSE connection logs
6. Wait for job to complete
7. Verify:
   - ✅ SSE event received in console
   - ✅ Photo gallery refreshes automatically
   - ✅ New restored image displays
   - ✅ No polling requests in Network tab

---

## Technical Details

### SSE vs WebSockets

**Why SSE was chosen:**
- ✅ Simpler than WebSockets (one-way server→client)
- ✅ Built-in auto-reconnection
- ✅ Works over HTTP (no protocol upgrade needed)
- ✅ Native browser EventSource API
- ✅ Perfect for notification use case

### Connection Management

- **Auto-reconnect**: Browser automatically reconnects on disconnect
- **Cleanup**: Connection closed when component unmounts or job changes
- **Multiple connections**: Each browser tab maintains its own SSE connection
- **Memory usage**: Minimal (just one asyncio.Queue per connection)

### Event Format

```javascript
event: completed
data: {"job_id": "...", "restore_id": "...", "status": "completed"}
```

---

## Production Considerations

### Current Implementation (MVP)
- ✅ In-memory pub/sub (simple, fast)
- ✅ Single server only
- ✅ Events lost on server restart
- ✅ Good for development and small deployments

### Future Improvements (When Scaling)

1. **Redis Pub/Sub** - For multi-server deployments
   ```python
   # Replace in-memory dict with Redis pub/sub
   redis_client.publish(f"job:{job_id}", json.dumps(data))
   ```

2. **Event History** - Store last N events per job
   - Allows reconnecting clients to catch up
   - Use Last-Event-ID header

3. **Authentication** - Add JWT token verification
   ```python
   @router.get("/{job_id}")
   async def job_event_stream(job_id: str, token: str = Depends(verify_token)):
   ```

4. **Additional Event Types**
   - `processing` - job started
   - `progress` - intermediate updates (e.g., 50% complete)
   - `failed` - job failed

5. **Load Balancer Config** - Ensure SSE support
   ```nginx
   # Nginx config for SSE
   proxy_buffering off;
   proxy_cache off;
   proxy_set_header Connection '';
   proxy_http_version 1.1;
   ```

---

## Dependencies

### Backend
- `sse-starlette==1.8.2` (already in requirements.txt)

### Frontend
- Native browser `EventSource` API (no additional dependencies)

---

## Related Files

### Backend
- `backend/app/api/v1/events.py` - SSE event manager and endpoint
- `backend/app/api/v1/webhooks.py` - Webhook handler with SSE notification
- `backend/app/api/routes.py` - API router registration
- `backend/requirements.txt` - Dependencies

### Frontend
- `frontend/src/hooks/useJobEvents.ts` - SSE connection hook
- `frontend/src/components/PhotoManagement/PhotoManagementContainer.tsx` - Integration

### Documentation
- `SSE_IMPLEMENTATION.md` - Original implementation notes
- `ARCHITECTURE_COMPARISON.md` - Architecture overview

---

## Summary

✅ **SSE notification is now ENABLED and ACTIVE**  
✅ **Frontend will automatically re-render when restore jobs complete**  
✅ **No polling required - real-time push notifications**  
✅ **Ready for testing**

The implementation is complete and production-ready for single-server deployments. Consider Redis-based pub/sub when scaling to multiple backend instances.

