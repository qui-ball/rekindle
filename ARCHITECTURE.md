# Rekindle Architecture Overview

## Database Architecture

### Current Setup

#### 1. **Supabase Auth Database** (Supabase's PostgreSQL)
- **Purpose**: Authentication only
- **Location**: Supabase managed PostgreSQL (local or cloud)
- **Tables**:
  - `auth.users` - User authentication data (managed by Supabase)
    - Passwords (hashed)
    - OAuth tokens
    - Email verification status
    - User metadata (name, avatar URL, etc.)
    - JWT tokens issued

#### 2. **AWS RDS PostgreSQL** (Application Database)
- **Purpose**: Application data storage
- **Location**: `rekindle-db-dev.c7cc4sm6091r.us-east-2.rds.amazonaws.com`
- **Connection**: Via `DATABASE_URL` environment variable
- **Tables**:
  - `users` - User profiles synced from Supabase Auth
    - Links to Supabase via `supabase_user_id`
    - Subscription data (tier, credits, Stripe IDs)
    - Storage limits
    - Account status
  - `jobs` - Photo upload sessions
  - `restore_attempts` - Photo restoration processing attempts
  - `animation_attempts` - Animation processing attempts
  - `photos` - Photo metadata (owner_id, S3 keys, status)
  - `audit_logs` - Security audit logs

#### 3. **AWS S3** (File Storage)
- **Purpose**: Actual photo file storage
- **Location**: AWS S3 bucket (`S3_BUCKET` env var)
- **Storage**:
  - Original uploaded photos
  - Processed/restored photos
  - Thumbnails
  - Referenced by S3 keys stored in RDS tables

## Data Flow

### User Authentication Flow
1. User signs up/logs in → **Supabase Auth** (creates/authenticates in `auth.users`)
2. Supabase webhook → **Backend API** (`/api/webhooks/supabase`)
3. Backend syncs user → **AWS RDS** (`users` table)
4. User gets JWT token → Frontend stores token
5. API requests include JWT → Backend verifies with Supabase → Looks up user in **AWS RDS**

### Photo Upload Flow
1. User uploads photo → **Frontend** → **Backend API**
2. Backend uploads file → **AWS S3** (stores actual file)
3. Backend creates record → **AWS RDS** (`photos` table with S3 key)
4. Backend creates job → **AWS RDS** (`jobs` table)
5. Processing happens → Results stored in **AWS S3** → Metadata in **AWS RDS**

## Current Architecture Summary

| Data Type | Storage Location | Database |
|-----------|-----------------|----------|
| **User Authentication** | Supabase Auth | Supabase PostgreSQL (`auth.users`) |
| **User Profiles** | AWS RDS | AWS RDS PostgreSQL (`users` table) |
| **Photo Metadata** | AWS RDS | AWS RDS PostgreSQL (`photos`, `jobs` tables) |
| **Photo Files** | AWS S3 | S3 Bucket (referenced by keys in RDS) |

## Important Notes

⚠️ **Current State**: User profiles are stored in **AWS RDS**, NOT in Supabase's PostgreSQL database.

- Supabase Auth handles authentication (passwords, OAuth, JWT)
- User profile data (subscription, credits, storage) is in AWS RDS
- Photos and processing jobs are in AWS RDS
- Actual photo files are in AWS S3

## Architecture Diagram

```
┌─────────────────┐
│   Frontend      │
│  (Next.js)      │
└────────┬────────┘
         │
         │ JWT Token
         ▼
┌─────────────────┐
│   Backend API   │
│   (FastAPI)     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌──────────────┐
│ Supabase│ │  AWS RDS      │
│  Auth   │ │  PostgreSQL   │
│         │ │               │
│ auth.   │ │ • users       │
│ users   │ │ • photos      │
│         │ │ • jobs        │
│         │ │ • restore_    │
│         │ │   attempts   │
└─────────┘ └──────────────┘
                 │
                 │ S3 Keys
                 ▼
            ┌─────────┐
            │ AWS S3  │
            │         │
            │ • Photos │
            │ • Thumbs │
            └─────────┘
```

## Data Synchronization

### Supabase → AWS RDS User Sync
- **Trigger**: Supabase webhook on `auth.users` changes
- **Endpoint**: `/api/webhooks/supabase`
- **Process**:
  1. User created/updated in Supabase Auth
  2. Webhook fires → Backend receives event
  3. Backend creates/updates `users` record in AWS RDS
  4. Links via `supabase_user_id` field

### Manual Sync
- **Endpoint**: `/api/v1/users/sync`
- **Purpose**: Manual user sync if webhook fails
- **Rate Limited**: 5 requests/minute

