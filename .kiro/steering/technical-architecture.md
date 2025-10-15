# Technical Architecture Guidelines

## Overview
This document outlines the technical architecture standards and recommendations for the photo restoration service. The architecture prioritizes MVP delivery, cost efficiency, and rapid development using AI-assisted coding tools.

**Related Documents:**
- `development-standards.md` - Detailed coding standards, project structure, and testing strategies
- `integration-recommendations.md` - Specific service recommendations and implementation patterns
- `product-and-sales-strategy.md` - Product vision, cost projections, and pricing strategy that inform architecture decisions

## Core Architecture Principles

### 1. MVP-First Approach
**Focus:** Deliver core photo restoration and colourization features exceptionally well

**MVP Scope:**
- Photo upload (mobile camera, gallery, desktop drag & drop)
- Photo restoration (2 credits)
- Photo colourization (3 credits)
- Combined restoration + colourization (4 credits)
- Basic user management and credit system
- Simple results viewing and download

**Post-MVP Features:**
- Animation (8 credits)
- Bring Together feature (6 credits)
- Advanced sharing and viral features
- Social media integrations

### 2. Progressive Web App (PWA) Approach
**Recommendation:** Build as PWA for optimal user experience

**PWA Benefits for Photo Upload Use Case:**
- Better camera integration for "photo of photo" scenarios
- App icon on home screen increases retention
- Offline capability for poor connections
- Cross-platform compatibility (mobile and desktop)

**Implementation Strategy:**
- Start responsive, add PWA features in weeks 2-3
- Focus on camera access and file upload optimization
- Implement service worker for offline functionality

### 3. File Processing Strategy

**Upload Limits:**
- **User Upload Limit:** 50MB (accommodates high-res phone photos)
- **Backend Processing Limits:**
  - Free tier: 480p max resolution
  - Paid tiers: 720p max resolution
  - Smart resizing based on user tier

**Supported Formats:**
- JPG, PNG, HEIC, WebP
- Auto-format conversion as needed
- Automatic perspective correction and quality enhancement

**Upload Flow Processing:**
1. File selection/capture
2. Smart cropping interface with draggable points
3. File size optimization
4. Upload to S3
5. Automatic perspective correction
6. Quality enhancement preprocessing
7. Queue for AI processing
8. Generate thumbnail
9. Delete original upload

### 4. AI Service Integration

**Primary: RunPod with Custom Models**

**Photo Restoration & Colourization (MVP):**
- **Model:** Qwen 3 Image Edit
- **Cost:** ~$0.02-0.08 per image (estimated)
- **Quality:** Professional-grade restoration and colourization
- **Processing:** 720p max for paid users, 480p for free users
- **Features:** Individual or combined processing

**Photo Animation (Post-MVP):**
- **Model:** Wan 2.2 T2V A14B
- **Cost:** ~$0.15-0.60 per video (estimated)
- **Processing:** 720p max for paid users, 480p for free users

**Bring Together Feature (Post-MVP):**
- **Model:** Qwen 3 Image Edit 2509
- **Cost:** ~$0.10-0.25 per composite image (estimated)
- **Feature:** Combine multiple photos into single composition

## System Architecture Diagrams

### Overall System Architecture (MVP)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 USER DEVICES                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│  📱 Mobile (PWA)                    💻 Desktop (PWA)                           │
│  ┌─────────────────────────────────┐ ┌─────────────────────────────────────┐   │
│  │ • Camera Capture (Physical)     │ │ • Drag & Drop Upload                │   │
│  │ • Gallery Access (Mobile)       │ │ • File Browser                      │   │
│  │ • Smart Cropping Interface      │ │ • QR Code → Mobile Camera           │   │
│  │ • Upload Progress Tracking      │ │ • Progress Tracking                 │   │
│  └─────────────────────────────────┘ └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                    Next.js PWA + TypeScript + Tailwind                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ Upload Manager  │  │ Processing UI   │  │ Results Viewer  │                │
│  │ • File Validate │  │ • Queue Status  │  │ • Image Display │                │
│  │ • Progress UI   │  │ • Error Handle  │  │ • Download      │                │
│  │ • Crop Interface│  │ • Notifications │  │ • Basic Share   │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ HTTPS/TLS
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               API GATEWAY                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                          FastAPI (Python) Backend                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ Upload API      │  │ Processing API  │  │ User API        │                │
│  │ • Presigned URLs│  │ • Job Status    │  │ • Auth (Auth0)  │                │
│  │ • File Metadata │  │ • Queue Mgmt    │  │ • Subscriptions │                │
│  │ • Validation    │  │ • Cost Tracking │  │ • Credits       │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            STORAGE & QUEUE LAYER                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ AWS S3 + CDN    │  │ Redis Queue     │  │ PostgreSQL DB   │                │
│  │ • Raw Photos    │  │ • Free Tier     │  │ • Users         │                │
│  │ • Processed     │  │ • Paid Priority │  │ • Jobs          │                │
│  │ • Thumbnails    │  │ • Retry Logic   │  │ • Subscriptions │                │
│  │ • Signed URLs   │  │ • Job Tracking  │  │ • Credits       │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ Job Processing
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AI PROCESSING LAYER                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         RunPod Serverless                              │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │   │
│  │  │ Qwen 3 Image    │  │ Wan 2.2 T2V     │  │ Qwen 3 Image    │        │   │
│  │  │ Edit            │  │ A14B            │  │ Edit 2509       │        │   │
│  │  │ • Restoration   │  │ • Animation     │  │ • Bring Together│        │   │
│  │  │ • Colourization │  │ (Post-MVP)      │  │ (Post-MVP)      │        │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ Results
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES LAYER                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ Auth0           │  │ Stripe          │  │ Basic Logging   │                │
│  │ • Social Login  │  │ • Subscriptions │  │ • Error Track   │                │
│  │ • User Mgmt     │  │ • Credits       │  │ • Cost Monitor  │                │
│  │ • Password Reset│  │ • Annual Billing│  │ • Manual Review │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
```### Pho
to Upload & Processing Flow (MVP)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            PHOTO UPLOAD & PROCESSING FLOW                      │
└─────────────────────────────────────────────────────────────────────────────────┘

📱 Mobile Flow                       💻 Desktop Flow
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│                                 │  │                                 │
│ 1a. Take Photo (Camera)         │  │ 1a. Drag & Drop File            │
│     ↓                           │  │     ↓                           │
│ 2a. Pre-upload (Crop)           │  │ 2a. Pre-upload (Crop)           │
│     ↓                           │  │     ↓                           │
│ 3a. Upload → Post-process       │  │ 3a. Upload → Post-process       │
│                                 │  │                                 │
│ 1b. Choose from Gallery         │  │ 1b. QR Code → Mobile Camera     │
│     ↓                           │  │     ↓                           │
│ 2b. Pre-upload (Crop)           │  │ 2b. Mobile handles upload       │
│     ↓                           │  │     ↓                           │
│ 3b. Upload → Post-process       │  │ 3b. View results on desktop     │
└─────────────────────────────────┘  └─────────────────────────────────┘
                    │                                  │
                    └──────────────┬───────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PROCESSING PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  📤 Upload Phase                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ File → Validation → S3 Upload → Generate Presigned URLs                │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                   ▼                                             │
│  🔧 Post-Upload Processing                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Perspective Correction → Quality Enhancement → Create Thumbnail         │   │
│  │ → Save Processing-Ready Image → Delete Original → Queue for AI          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                   ▼                                             │
│  🤖 AI Processing                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ RunPod Job → Qwen 3 Image Edit → Restoration/Colourization             │   │
│  │ → Quality Check → Store Results → Update Database                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                   ▼                                             │
│  📧 Notification (Auth0 handles)                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Job Complete → Update UI → User Views Results → Download Available      │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Credit System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CREDIT SYSTEM FLOW                                │
└─────────────────────────────────────────────────────────────────────────────────┘

User Account                     Credit Management                 Processing
┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
│                 │             │                 │             │                 │
│ Subscription    │────────────▶│ Unified Credits │────────────▶│ Job Processing  │
│ • Free: 3       │   Monthly   │ • All Carry Over│   Deduct    │ • Restoration:2 │
│ • Remember: 25  │   Addition  │ • Stack Monthly │   Credits   │ • Coloring: 3   │
│ • Cherish: 60   │             │ • Accumulate    │             │ • Combined: 4   │
│ • Forever: 150  │             │                 │             │                 │
│                 │             │                 │             │                 │
└─────────────────┘             └─────────────────┘             └─────────────────┘
         │                               ▲                               │
         │                               │                               │
         ▼                               │                               ▼
┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
│                 │             │                 │             │                 │
│ Credit Top-ups  │────────────▶│ Credit Balance  │◀────────────│ Credit Check    │
│ • $4.99: 10     │   Add to    │ • Unified Pool  │   Deduct    │ • Sufficient?   │
│ • $12.99: 30    │   Balance   │ • All Carry Over│   From Pool │ • Queue Job     │
│ • $39.99: 100   │             │                 │             │ • Or Show Error │
│                 │             │                 │             │                 │
│                 │             │ ⚠️ Lost on Sub  │             │                 │
│ Cancel Sub ────▶│             │   Cancellation  │             │                 │
│                 │             │                 │             │                 │
└─────────────────┘             └─────────────────┘             └─────────────────┘
```

## Infrastructure Recommendations

### AI Processing Strategy

**Primary: RunPod Serverless**
- **Cost Control:** Pay only for actual processing time
- **Model Flexibility:** Easy to switch between models
- **Scalability:** Automatic scaling based on demand
- **Quality:** Professional-grade AI models
- **Implementation:** Docker containers with model endpoints

**Model Configuration:**
```python
# RunPod service abstraction
class RunPodService:
    def __init__(self):
        self.models = {
            'restoration': 'qwen-3-image-edit',
            'colourization': 'qwen-3-image-edit',
            'animation': 'wan-2-2-t2v-a14b',  # Post-MVP
            'bring_together': 'qwen-3-image-edit-2509'  # Post-MVP
        }
    
    async def process_restoration(self, image_data: bytes, user_tier: str) -> bytes:
        max_resolution = '720p' if user_tier != 'free' else '480p'
        return await self._run_model('restoration', image_data, max_resolution)
```

### Backend Architecture

**Recommended Stack:**
- **API Framework:** FastAPI (Python) - excellent for AI integration
- **Database:** PostgreSQL - reliable, supports complex queries
- **Queue System:** Redis with job queues - simple, reliable processing
- **File Storage:** AWS S3 + CloudFront CDN
- **Authentication:** Auth0 (free tier covers MVP)
- **Payments:** Stripe (subscription + credits)

**Scalability Pattern:**
```
User Upload → S3 → Queue Job → RunPod Worker → Process → Store Result → Notify User
```

**Queue Priority System:**
- **Free Tier:** Standard queue (best effort)
- **Paid Tiers:** Priority queue with faster processing
- **Credit Deduction:** Atomic operations to prevent double-charging

### Frontend Architecture

**Technology Stack:**
- **Framework:** Next.js 14 with TypeScript (App Router)
- **PWA Tools:** next-pwa with Workbox for service workers
- **State Management:** Zustand (lightweight)
- **UI Components:** Tailwind CSS + Headless UI
- **Camera Integration:** Native browser APIs with PWA enhancements

**Upload Interface Design:**
- **Mobile-First:** Camera as primary input method
- **Smart Cropping:** Draggable corner/edge points for precise cropping
- **Progress Tracking:** Real-time upload and processing status
- **Error Recovery:** Clear error messages and retry options
- **Cross-Device:** QR code flow for desktop → mobile camera##
 Development Standards

### Docker Development Environment

**Local Development Setup:**
```yaml
# docker-compose.yml
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - CHOKIDAR_USEPOLLING=true  # Hot reload
  
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    environment:
      - RELOAD=true  # Hot reload
    depends_on:
      - postgres
      - redis
  
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: rekindle_dev
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7
    ports:
      - "6379:6379"
```

### CI/CD Pipeline

**GitHub Actions Workflow:**
```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: test_password
      redis:
        image: redis:7
    
    steps:
      - uses: actions/checkout@v3
      
      # Frontend tests
      - name: Frontend Tests
        run: |
          cd frontend
          npm ci
          npm run test:unit
          npm run test:integration
      
      # Backend tests
      - name: Backend Tests
        run: |
          cd backend
          pip install -r requirements.txt
          pytest tests/unit/
          pytest tests/integration/
      
      # Build and deploy on main branch
      - name: Deploy
        if: github.ref == 'refs/heads/main'
        run: |
          # Deploy to production
```

### Testing Strategy (MVP Focus)

**Required Tests:**
- **Unit Tests:** All functions, components, and services (80% coverage)
- **Integration Tests:** API endpoints and database operations
- **Error Handling Tests:** All failure scenarios and edge cases
- **No E2E Tests:** Focus on unit and integration for MVP speed

**Test Organization:**
```
frontend/
├── src/
│   ├── components/
│   │   └── PhotoUpload/
│   │       ├── PhotoUpload.tsx
│   │       └── PhotoUpload.test.tsx  # Required
│   └── services/
│       ├── api.ts
│       └── api.test.ts  # Required

backend/
├── app/
│   ├── services/
│   │   ├── photo_service.py
│   │   └── test_photo_service.py  # Required
│   └── api/
│       ├── photos.py
│       └── test_photos.py  # Required
```

## Security & Privacy

### Data Protection
- **Upload Security:** Presigned S3 URLs, file type validation
- **Processing Security:** Isolated RunPod workers, no data persistence
- **Storage Security:** Encrypted at rest, signed URLs for access
- **Auth Security:** Auth0 handles password security and resets
- **Privacy Compliance:** GDPR/CCPA ready for US/Canada launch

### Content Moderation
- **Basic Filtering:** File type validation, size limits
- **Manual Review:** Admin interface for flagged content
- **User Reporting:** Simple flagging system

## Monitoring & Cost Control

### Minimal Observability (MVP)
- **Application Logs:** Structured logging to files/console
- **Basic Health Checks:** API endpoint monitoring
- **Cost Tracking:** Manual monitoring of RunPod and AWS costs
- **Error Handling:** In-app error reporting and user feedback

### Cost Monitoring Strategy
```python
# Cost tracking for AI processing
class CostTracker:
    def __init__(self):
        self.daily_limits = {
            'free': 50,      # $50 daily limit for free tier abuse
            'paid': 500      # $500 daily limit for paid tiers
        }
    
    async def track_job_cost(self, user_id: str, job_type: str, cost_cents: int):
        # Track costs per user and globally
        # Alert if approaching limits
        # Auto-pause processing if limits exceeded
```

### Essential Metrics (MVP Only)
- **Total User Accounts:** Registration tracking
- **User Tier Distribution:** Free vs paid breakdown
- **Average Revenue Per User (ARPU):** Monthly revenue / active paid users
- **Monthly Recurring Revenue (MRR):** Subscription revenue
- **Profit Margin:** (Revenue - Costs) / Revenue
- **Monthly Operational Costs:** Infrastructure + AI + other costs

## Deployment Strategy

### Environment Setup
- **Development:** Local Docker Compose with hot reload
- **Staging:** Vercel (Next.js frontend) + AWS ECS (backend)
- **Production:** AWS ECS Fargate with auto-scaling

### Infrastructure as Code
```yaml
# AWS ECS Task Definition
family: rekindle-backend
networkMode: awsvpc
requiresCompatibilities:
  - FARGATE
cpu: 256
memory: 512
containerDefinitions:
  - name: backend
    image: rekindle/backend:latest
    portMappings:
      - containerPort: 8000
    environment:
      - name: DATABASE_URL
        value: !Ref DatabaseURL
      - name: REDIS_URL
        value: !Ref RedisURL
      - name: RUNPOD_API_KEY
        valueFrom: !Ref RunPodApiKey
```

## Future Considerations

### Scalability Roadmap
1. **Phase 1 (MVP):** Single region, basic features
2. **Phase 2 (Growth):** Multi-region deployment, advanced features
3. **Phase 3 (Scale):** Custom AI infrastructure, enterprise features

### Technology Evolution
- **AI Models:** Path to custom model development and fine-tuning
- **Mobile Apps:** Native iOS/Android if PWA limitations arise
- **Global Expansion:** Multi-region deployment and localization
- **Enterprise Features:** Bulk processing, API access, white-label solutions

This architecture provides a solid foundation for rapid MVP development while maintaining flexibility for future scaling and feature expansion. The focus on RunPod, Auth0, and minimal observability keeps costs low during validation while providing professional-grade functionality.