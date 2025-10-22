# Authentication & Authorization - Technical Design

## Document Info

**Created:** October 21, 2025  
**Status:** Approved  
**Related:** requirements.md, tasks.md

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          User Devices                            │
│  📱 Mobile (PWA)              💻 Desktop (Browser)                │
└────────────────┬────────────────────────────┬───────────────────┘
                 │                            │
                 ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Next.js Frontend (Port 3000)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Auth0 Next.js SDK (@auth0/nextjs-auth0)                  │   │
│  │  • <Auth0Provider /> - Wraps app                         │   │
│  │  • useUser() - Get current user                          │   │
│  │  • getSession() - Get server-side session                │   │
│  │  • withPageAuthRequired() - Protect pages                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Session Management                                       │   │
│  │  • JWT token in cookies                                  │   │
│  │  • Auto-refresh before expiry                            │   │
│  │  • Secure httpOnly cookies                               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────┬──────────────────────────────────────────┘
                      │ JWT Token in Authorization header
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              FastAPI Backend (Port 8000)                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ JWT Middleware (app/api/deps.py)                         │   │
│  │  • Verify JWT signature                                  │   │
│  │  • Extract Auth0 user ID                                 │   │
│  │  • Fetch user from database                              │   │
│  │  • Inject User object into request                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Protected Routes                                         │   │
│  │  • /api/v1/users/* (user management)                     │   │
│  │  • /api/v1/photos/* (requires auth)                      │   │
│  │  • /api/v1/jobs/* (requires auth)                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────┬──────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                           │
│  • users table (profiles, credits, subscriptions)               │
│  • photos table (user_id foreign key)                           │
│  • jobs table (user_id foreign key)                             │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Auth0 Service                                 │
│  • User authentication                                           │
│  • Social OAuth providers                                        │
│  • Email verification                                            │
│  • Password resets                                               │
│  • Session management                                            │
│  • Webhooks (user events)                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Database Schema

#### Users Table

```sql
-- users table - PostgreSQL
CREATE TABLE users (
    -- Core Identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth0_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    
    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    profile_image_url TEXT,
    
    -- Subscription & Credits
    subscription_tier VARCHAR(20) DEFAULT 'free' 
        CHECK (subscription_tier IN ('free', 'remember', 'cherish', 'forever')),
    monthly_credits INTEGER DEFAULT 3,
    topup_credits INTEGER DEFAULT 0,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    subscription_status VARCHAR(20) DEFAULT 'active'
        CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'paused')),
    subscription_period_start TIMESTAMP WITH TIME ZONE,
    subscription_period_end TIMESTAMP WITH TIME ZONE,
    
    -- Storage
    storage_used_bytes BIGINT DEFAULT 0,
    storage_limit_bytes BIGINT DEFAULT 0,
    
    -- Account Status
    account_status VARCHAR(20) DEFAULT 'active'
        CHECK (account_status IN ('active', 'suspended', 'deleted')),
    deletion_requested_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexes
    CONSTRAINT unique_auth0_id UNIQUE (auth0_user_id),
    CONSTRAINT unique_email UNIQUE (email)
);

-- Indexes for performance
CREATE INDEX idx_users_auth0_id ON users(auth0_user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tier ON users(subscription_tier);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX idx_users_updated_at ON users(updated_at);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

#### SQLAlchemy Model

```python
# backend/app/models/user.py
from sqlalchemy import Column, String, Boolean, Integer, BigInteger, DateTime, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from typing import Literal

from app.core.database import Base

UserTier = Literal['free', 'remember', 'cherish', 'forever']
AccountStatus = Literal['active', 'suspended', 'deleted']
SubscriptionStatus = Literal['active', 'cancelled', 'past_due', 'paused']


class User(Base):
    """User account model"""
    __tablename__ = "users"

    # Core Identity
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth0_user_id = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    email_verified = Column(Boolean, default=False)

    # Profile
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    profile_image_url = Column(String, nullable=True)

    # Subscription & Credits
    subscription_tier = Column(String(20), default='free', nullable=False, index=True)
    monthly_credits = Column(Integer, default=3)
    topup_credits = Column(Integer, default=0)
    stripe_customer_id = Column(String(255), nullable=True, index=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    subscription_status = Column(String(20), default='active')
    subscription_period_start = Column(DateTime(timezone=True), nullable=True)
    subscription_period_end = Column(DateTime(timezone=True), nullable=True)

    # Storage
    storage_used_bytes = Column(BigInteger, default=0)
    storage_limit_bytes = Column(BigInteger, default=0)

    # Account Status
    account_status = Column(String(20), default='active')
    deletion_requested_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # Table constraints
    __table_args__ = (
        CheckConstraint(
            subscription_tier.in_(['free', 'remember', 'cherish', 'forever']),
            name='valid_subscription_tier'
        ),
        CheckConstraint(
            account_status.in_(['active', 'suspended', 'deleted']),
            name='valid_account_status'
        ),
        CheckConstraint(
            subscription_status.in_(['active', 'cancelled', 'past_due', 'paused']),
            name='valid_subscription_status'
        ),
    )

    @property
    def total_credits(self) -> int:
        """Total available credits"""
        return self.monthly_credits + self.topup_credits

    @property
    def full_name(self) -> str:
        """Full name of user"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.email.split('@')[0]

    @property
    def storage_limit_gb(self) -> float:
        """Storage limit in GB"""
        return self.storage_limit_bytes / (1024 ** 3)

    @property
    def storage_used_gb(self) -> float:
        """Storage used in GB"""
        return self.storage_used_bytes / (1024 ** 3)

    @property
    def storage_percentage(self) -> float:
        """Percentage of storage used"""
        if self.storage_limit_bytes == 0:
            return 0.0
        return (self.storage_used_bytes / self.storage_limit_bytes) * 100

    def __repr__(self):
        return f"<User {self.email} ({self.subscription_tier})>"
```

#### TypeScript Types

```typescript
// frontend/src/types/user.ts
export type UserTier = 'free' | 'remember' | 'cherish' | 'forever';
export type AccountStatus = 'active' | 'suspended' | 'deleted';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'paused';

export interface User {
  // Core Identity
  id: string;
  auth0UserId: string;
  email: string;
  emailVerified: boolean;

  // Profile
  firstName?: string;
  lastName?: string;
  fullName: string;
  profileImageUrl?: string;

  // Subscription & Credits
  subscriptionTier: UserTier;
  monthlyCredits: number;
  topupCredits: number;
  totalCredits: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPeriodStart?: string;
  subscriptionPeriodEnd?: string;

  // Storage
  storageUsedBytes: number;
  storageLimitBytes: number;
  storageUsedGb: number;
  storageLimitGb: number;
  storagePercentage: number;

  // Account Status
  accountStatus: AccountStatus;
  deletionRequestedAt?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}
```

### Tier Configuration

```typescript
// frontend/src/config/tiers.ts
export const TIER_CONFIG = {
  free: {
    name: 'Try',
    monthlyPrice: 0,
    annualPrice: 0,
    monthlyCredits: 3,
    quality: '480p',
    watermark: true,
    storageGB: 0,
    storageLimitBytes: 0,
    processing: 'standard',
    features: [
      '3 trial credits',
      '480p quality',
      'Small watermark',
      '7-day photo expiry',
      'Standard queue'
    ]
  },
  remember: {
    name: 'Remember',
    monthlyPrice: 9.99,
    annualPrice: 95.90,
    monthlyCredits: 25,
    quality: '720p HD',
    watermark: false,
    storageGB: 10,
    storageLimitBytes: 10 * 1024 * 1024 * 1024,
    processing: 'priority',
    features: [
      '25 monthly credits',
      '720p HD quality',
      'No watermark',
      '10GB storage (~2,000 photos)',
      'Priority processing'
    ]
  },
  cherish: {
    name: 'Cherish',
    monthlyPrice: 19.99,
    annualPrice: 191.90,
    monthlyCredits: 60,
    quality: '720p HD',
    watermark: false,
    storageGB: 50,
    storageLimitBytes: 50 * 1024 * 1024 * 1024,
    processing: 'priority',
    features: [
      '60 monthly credits',
      '720p HD quality',
      'No watermark',
      '50GB storage (~10,000 photos)',
      'Priority processing',
      'Batch upload'
    ]
  },
  forever: {
    name: 'Forever',
    monthlyPrice: 39.99,
    annualPrice: 383.90,
    monthlyCredits: 150,
    quality: '720p HD',
    watermark: false,
    storageGB: 200,
    storageLimitBytes: 200 * 1024 * 1024 * 1024,
    processing: 'highest',
    features: [
      '150 monthly credits',
      '720p HD quality',
      'No watermark',
      '200GB storage (~40,000 photos)',
      'Highest priority processing',
      'Batch upload',
      'API access'
    ]
  }
} as const;
```

---

## API Design

### Authentication Endpoints

#### Backend API (FastAPI)

```python
# backend/app/api/v1/users.py

@router.post("/users/sync", status_code=201)
async def sync_user(
    request: UserSyncRequest,
    db: Session = Depends(get_db),
):
    """
    Sync user from Auth0 to backend database.
    Called by frontend after Auth0 signup or via webhook.
    """
    pass

@router.get("/users/me")
async def get_current_user(
    current_user: User = Depends(get_current_active_user),
):
    """Get current authenticated user's profile"""
    pass

@router.put("/users/me")
async def update_current_user(
    request: UserUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update current user's profile"""
    pass

@router.delete("/users/me")
async def request_account_deletion(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Request account deletion (30-day grace period)"""
    pass

@router.get("/users/me/export")
async def export_user_data(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Export all user data (GDPR compliance)"""
    pass
```

#### Webhook Endpoints

```python
# backend/app/api/webhooks/auth0.py

@router.post("/webhooks/auth0")
async def handle_auth0_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Handle Auth0 webhook events:
    - user.created
    - user.updated
    - user.deleted
    - session.created
    - session.ended
    """
    pass
```

#### Cross-Device Session Endpoints

```python
# backend/app/api/v1/sessions.py

@router.post("/sessions/qr-token", status_code=201)
async def generate_qr_token(
    current_user: User = Depends(get_current_active_user),
    redis: Redis = Depends(get_redis),
):
    """
    Generate one-time QR code token for cross-device upload.
    Rate limited: 5 tokens per hour per user.
    """
    # Generate UUID token
    token = str(uuid.uuid4())
    
    # Store token → user_id mapping in Redis (5-min TTL)
    await redis.setex(
        f"qr_token:{token}",
        300,  # 5 minutes
        current_user.id
    )
    
    # Log token generation
    logger.info(f"QR token generated for user {current_user.id}")
    
    return {
        "token": token,
        "expires_in": 300,
        "url": f"https://rekindle.app/upload?token={token}"
    }


@router.get("/sessions/qr-token/{token}")
async def validate_qr_token(
    token: str,
    current_user: User = Depends(get_current_active_user),
    redis: Redis = Depends(get_redis),
):
    """
    Validate QR token and ensure user matches.
    Called by mobile device that's already logged in.
    """
    # Get desktop user_id from token
    desktop_user_id = await redis.get(f"qr_token:{token}")
    
    if not desktop_user_id:
        raise HTTPException(
            status_code=400,
            detail="QR code expired or invalid"
        )
    
    # Verify user matches
    if str(desktop_user_id) != str(current_user.id):
        raise HTTPException(
            status_code=403,
            detail="This QR code belongs to a different account"
        )
    
    # Consume token (delete from Redis)
    await redis.delete(f"qr_token:{token}")
    
    return {"success": True}


@router.post("/sessions/biometric-auth")
async def biometric_authentication(
    request: BiometricAuthRequest,
    redis: Redis = Depends(get_redis),
    db: Session = Depends(get_db),
):
    """
    Create temporary session after successful biometric authentication.
    Called by mobile device that's NOT logged in.
    """
    # Get desktop user_id from token
    desktop_user_id = await redis.get(f"qr_token:{request.token}")
    
    if not desktop_user_id:
        raise HTTPException(
            status_code=400,
            detail="QR code expired or invalid"
        )
    
    # Validate biometric proof (device signature)
    # This is a placeholder - actual implementation depends on WebAuthn
    if not validate_biometric_proof(request.biometric_proof):
        raise HTTPException(
            status_code=401,
            detail="Biometric authentication failed"
        )
    
    # Get user from database
    user = db.query(User).filter(User.id == desktop_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate temporary JWT (1-hour expiry)
    temp_jwt = create_temporary_jwt(
        user_id=user.id,
        expires_in=3600  # 1 hour
    )
    
    # Consume token
    await redis.delete(f"qr_token:{request.token}")
    
    # Log biometric authentication
    logger.info(f"Biometric auth successful for user {user.id}")
    
    return {
        "access_token": temp_jwt,
        "token_type": "bearer",
        "expires_in": 3600
    }
```

### Request/Response Schemas

```python
# backend/app/schemas/user.py

class UserSyncRequest(BaseModel):
    auth0_user_id: str
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    profile_image_url: str | None = None

# backend/app/schemas/session.py

class BiometricAuthRequest(BaseModel):
    token: str  # QR code token
    biometric_proof: dict  # WebAuthn assertion/credential
    device_info: dict | None = None
    
class QRTokenResponse(BaseModel):
    token: str
    expires_in: int
    url: str

class BiometricAuthResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int

class UserUpdateRequest(BaseModel):
    first_name: constr(min_length=1, max_length=100) | None = None
    last_name: constr(min_length=1, max_length=100) | None = None
    
    @validator('first_name', 'last_name')
    def validate_name(cls, v):
        if v is not None:
            import re
            if not re.match(r"^[a-zA-Z\s'-]+$", v):
                raise ValueError("Invalid name format")
        return v

class UserResponse(BaseModel):
    id: UUID
    auth0_user_id: str
    email: EmailStr
    email_verified: bool
    first_name: str | None
    last_name: str | None
    full_name: str
    profile_image_url: str | None
    subscription_tier: UserTier
    monthly_credits: int
    topup_credits: int
    total_credits: int
    subscription_status: SubscriptionStatus
    subscription_period_start: datetime | None
    subscription_period_end: datetime | None
    storage_used_bytes: int
    storage_limit_bytes: int
    storage_used_gb: float
    storage_limit_gb: float
    storage_percentage: float
    account_status: AccountStatus
    created_at: datetime
    last_login_at: datetime | None
    
    class Config:
        from_attributes = True
```

---

## Authentication Flow Designs

### Sign Up Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Sign Up Flow                              │
└─────────────────────────────────────────────────────────────────┘

1. User visits /sign-up page
   ↓
2. Next.js renders Auth0 signup UI
   ↓
3. User enters email + password OR clicks social login
   ↓
4. Auth0 creates user account
   ↓
5. Auth0 sends verification email
   ↓
6. User clicks verification link
   ↓
7. Auth0 marks email as verified
   ↓
8. Auth0 redirects back to /api/auth/callback
   ↓
9. Next.js Auth0 SDK creates session
   ↓
10. Next.js stores JWT in secure httpOnly cookie
   ↓
11. Frontend calls POST /api/v1/users/sync
   ↓
12. Backend creates user record in PostgreSQL
    - Set tier = 'free'
    - Set monthly_credits = 3
    - Set storage_limit_bytes = 0
   ↓
13. Backend returns user profile
   ↓
14. Frontend redirects to /onboarding
   ↓
15. User completes onboarding
   ↓
16. Frontend redirects to /dashboard
```

### Sign In Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Sign In Flow                              │
└─────────────────────────────────────────────────────────────────┘

1. User visits /sign-in page
   ↓
2. Next.js renders Auth0 login UI
   ↓
3. User enters credentials OR clicks social login
   ↓
4. Auth0 verifies credentials
   ↓
5. Auth0 creates session + generates JWT
   ↓
6. Auth0 redirects to /api/auth/callback
   ↓
7. Next.js Auth0 SDK validates callback
   ↓
8. Next.js stores JWT in secure httpOnly cookie
   ↓
9. Frontend calls GET /api/v1/users/me
   ↓
10. Backend:
    - Verifies JWT signature
    - Extracts auth0_user_id from token
    - Fetches user from database
    - Updates last_login_at
    - Returns user profile
   ↓
11. Frontend loads user into state
   ↓
12. Frontend redirects to /dashboard
```

### Protected API Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   Protected API Request                          │
└─────────────────────────────────────────────────────────────────┘

1. User makes API request (e.g., GET /api/v1/photos)
   ↓
2. Frontend extracts JWT from session
   ↓
3. Frontend adds Authorization: Bearer <JWT> header
   ↓
4. Backend receives request
   ↓
5. JWT Middleware (deps.py):
   - Extract JWT from Authorization header
   - Verify JWT signature using Auth0 public keys
   - Check JWT expiration
   - Extract auth0_user_id from JWT payload
   ↓
6. Fetch user from database:
   - Query: SELECT * FROM users WHERE auth0_user_id = ?
   - Check account_status = 'active'
   ↓
7. Inject User object into request context
   ↓
8. Route handler processes request with user context
   ↓
9. Check permissions (tier, credits, etc.)
   ↓
10. Execute business logic
   ↓
11. Return response
```

### JWT Token Refresh Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Token Refresh Flow                           │
└─────────────────────────────────────────────────────────────────┘

1. User makes API request
   ↓
2. Frontend checks JWT expiration (stored in cookie)
   ↓
3. IF token expires in <5 minutes:
   ↓
4. Frontend calls Auth0 SDK refresh method
   ↓
5. Auth0 SDK uses refresh token to get new JWT
   ↓
6. Auth0 issues new JWT (1-hour lifetime)
   ↓
7. Next.js updates session cookie with new JWT
   ↓
8. Frontend retries original request with new JWT
   ↓
9. Request succeeds
```

### QR Code + Biometric Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              QR Code Cross-Device Upload Flow                    │
└─────────────────────────────────────────────────────────────────┘

DESKTOP SESSION (User already logged in)
────────────────────────────────────────────────────────────────
1. User clicks "Upload from Phone"
   ↓
2. Frontend calls POST /api/v1/sessions/qr-token
   ↓
3. Backend:
   - Generates random token (UUID)
   - Stores token → user_id mapping in Redis (5-min TTL)
   - Returns token
   ↓
4. Frontend generates QR code:
   URL: https://rekindle.app/upload?token=abc123
   ↓
5. Frontend opens WebSocket connection to listen for upload events
   ↓
6. Desktop displays QR code and "Waiting for scan..." message


MOBILE SESSION - SCENARIO A: User already logged in
────────────────────────────────────────────────────────────────
7a. User scans QR code on mobile
   ↓
8a. Opens: https://rekindle.app/upload?token=abc123
   ↓
9a. Frontend detects Auth0 session exists
   ↓
10a. Frontend calls GET /api/v1/sessions/qr-token/abc123
   ↓
11a. Backend:
   - Verifies token exists in Redis
   - Extracts desktop user_id from token
   - Verifies mobile user_id matches desktop user_id
   - Marks token as consumed (delete from Redis)
   - Returns success
   ↓
12a. Mobile proceeds directly to upload page (INSTANT, 0 friction)


MOBILE SESSION - SCENARIO B: User NOT logged in
────────────────────────────────────────────────────────────────
7b. User scans QR code on mobile
   ↓
8b. Opens: https://rekindle.app/upload?token=abc123
   ↓
9b. Frontend detects NO Auth0 session
   ↓
10b. Check if biometric authentication available:
   - iOS: Check Face ID / Touch ID
   - Android: Check Fingerprint / Face Unlock
   ↓
11b. IF biometric available:
     ┌────────────────────────────────────────────────────┐
     │  Show "Confirm it's you" modal                     │
     │  [Face ID icon]                                    │
     │  "Scan your face to continue"                      │
     └────────────────────────────────────────────────────┘
   ↓
12b. Prompt biometric authentication:
   - iOS: Use LocalAuthentication framework
   - Android: Use BiometricPrompt API
   - Web: Use WebAuthn API
   ↓
13b. User authenticates with Face ID / Touch ID / Fingerprint
   ↓
14b. ON SUCCESS:
   - Frontend calls POST /api/v1/sessions/biometric-auth
   - Sends: { token: "abc123", biometric_proof: {...} }
   ↓
15b. Backend:
   - Verifies token exists in Redis
   - Extracts desktop user_id from token
   - Validates biometric proof (device signature)
   - Generates temporary JWT (1-hour expiry)
   - Creates temporary session record
   - Marks token as consumed
   - Returns temporary JWT
   ↓
16b. Frontend:
   - Stores temporary JWT in sessionStorage
   - Redirects to upload page
   ↓
17b. Upload page validates JWT and proceeds

14c. ON FAILURE (biometric rejected, 3 attempts):
   - Show "Unable to verify. Please sign in."
   - Redirect to Auth0 login: /api/auth/login?returnTo=/upload?token=abc123
   - After Auth0 login, return to upload page
   ↓
15c. IF biometric NOT available:
   - Redirect to Auth0 login immediately
   - After Auth0 login, return to upload page


UPLOAD COMPLETION (Both scenarios converge here)
────────────────────────────────────────────────────────────────
18. User uploads photo on mobile
   ↓
19. Backend:
   - Stores photo associated with user_id
   - Publishes WebSocket event to desktop session
   - Event: { type: "upload_complete", photo_id: "xyz" }
   ↓
20. Desktop WebSocket receives event
   ↓
21. Desktop UI updates:
   - Hide QR code
   - Show "Photo uploaded from mobile! ✓"
   - Display uploaded photo
   - User continues workflow on desktop


ERROR SCENARIOS
────────────────────────────────────────────────────────────────
- Token expired (>5 minutes): Show "QR code expired. Please try again."
- Token already used: Show "QR code already used. Generate a new one."
- User mismatch: Show "This QR code belongs to a different account."
- Biometric failure (3x): Fallback to Auth0 login
- WebSocket disconnect: Fallback to polling (every 2 seconds)
```

---

## Authorization Design

### Permission Checking Architecture

```python
# backend/app/api/deps.py

from functools import wraps
from typing import List, Callable
from fastapi import HTTPException, status

def require_tier(min_tier: UserTier | List[UserTier]) -> Callable:
    """
    Decorator to require minimum subscription tier.
    
    Usage:
        @require_tier("remember")
        async def animate_photo(...):
            pass
    """
    tier_levels = {
        "free": 0,
        "remember": 1,
        "cherish": 2,
        "forever": 3,
    }
    
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_user = kwargs.get("current_user")
            
            if current_user is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                )
            
            user_tier_level = tier_levels.get(current_user.subscription_tier, 0)
            
            if isinstance(min_tier, list):
                if current_user.subscription_tier not in min_tier:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"This feature requires one of: {', '.join(min_tier)}",
                    )
            else:
                required_level = tier_levels.get(min_tier, 0)
                if user_tier_level < required_level:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"This feature requires at least {min_tier.capitalize()} tier",
                    )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def require_credits(min_credits: int) -> Callable:
    """
    Decorator to check sufficient credits.
    
    Usage:
        @require_credits(2)
        async def process_photo(...):
            pass
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_user = kwargs.get("current_user")
            
            if current_user is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                )
            
            if current_user.total_credits < min_credits:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail=f"Insufficient credits. Required: {min_credits}, Available: {current_user.total_credits}",
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator
```

### Frontend Permission Hooks

```typescript
// frontend/src/hooks/usePermissions.ts

import { useCurrentUser } from './useCurrentUser';
import { UserTier } from '@/types/user';

export function usePermissions() {
  const { user } = useCurrentUser();

  const tierLevels: Record<UserTier, number> = {
    free: 0,
    remember: 1,
    cherish: 2,
    forever: 3,
  };

  const hasTier = (minTier: UserTier): boolean => {
    if (!user) return false;
    return tierLevels[user.subscriptionTier] >= tierLevels[minTier];
  };

  const hasCredits = (required: number): boolean => {
    if (!user) return false;
    return user.totalCredits >= required;
  };

  const canAnimate = (): boolean => {
    return hasTier('remember') && hasCredits(8);
  };

  const canBatchUpload = (): boolean => {
    return hasTier('cherish');
  };

  const canAccessAPI = (): boolean => {
    return hasTier('forever');
  };

  const getMaxResolution = (): '480p' | '720p' => {
    return user?.subscriptionTier === 'free' ? '480p' : '720p';
  };

  const hasWatermark = (): boolean => {
    return user?.subscriptionTier === 'free';
  };

  return {
    hasTier,
    hasCredits,
    canAnimate,
    canBatchUpload,
    canAccessAPI,
    getMaxResolution,
    hasWatermark,
  };
}
```

### Biometric Authentication Hook

```typescript
// frontend/src/hooks/useBiometric.ts

import { useState } from 'react';

interface BiometricCapability {
  available: boolean;
  type: 'face' | 'fingerprint' | 'iris' | 'none';
  deviceName: string;
}

export function useBiometric() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const checkBiometricCapability = async (): Promise<BiometricCapability> => {
    // Check if Web Authentication API is available
    if (!window.PublicKeyCredential) {
      return { available: false, type: 'none', deviceName: 'unknown' };
    }

    // Check if device supports biometrics
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    
    if (!available) {
      return { available: false, type: 'none', deviceName: 'unknown' };
    }

    // Detect biometric type based on user agent
    const userAgent = navigator.userAgent.toLowerCase();
    let type: 'face' | 'fingerprint' | 'iris' = 'fingerprint'; // Default
    
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      // iOS devices - could be Face ID or Touch ID
      type = userAgent.includes('iphone x') || userAgent.includes('iphone 1') ? 'face' : 'fingerprint';
    } else if (userAgent.includes('android')) {
      // Android devices - fingerprint or face
      type = 'fingerprint';
    }

    return { available: true, type, deviceName: navigator.userAgent };
  };

  const authenticateBiometric = async (
    token: string
  ): Promise<{ success: boolean; accessToken?: string; error?: string }> => {
    setIsAuthenticating(true);

    try {
      // Create WebAuthn credential request
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        rpId: window.location.hostname,
        userVerification: 'required',
        timeout: 60000, // 60 seconds
      };

      // Request biometric authentication
      const credential = await navigator.credentials.get({
        publicKey: publicKeyOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        return { success: false, error: 'Biometric authentication cancelled' };
      }

      // Send credential to backend for verification
      const response = await fetch('/api/v1/sessions/biometric-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          biometric_proof: {
            id: credential.id,
            type: credential.type,
            rawId: arrayBufferToBase64(credential.rawId),
            response: {
              authenticatorData: arrayBufferToBase64(
                (credential.response as AuthenticatorAssertionResponse).authenticatorData
              ),
              clientDataJSON: arrayBufferToBase64(
                credential.response.clientDataJSON
              ),
              signature: arrayBufferToBase64(
                (credential.response as AuthenticatorAssertionResponse).signature
              ),
            },
          },
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.detail || 'Authentication failed' };
      }

      const data = await response.json();
      return { success: true, accessToken: data.access_token };
    } catch (error: any) {
      console.error('Biometric authentication error:', error);
      
      // User cancelled
      if (error.name === 'NotAllowedError') {
        return { success: false, error: 'Authentication cancelled' };
      }
      
      // Timeout
      if (error.name === 'AbortError') {
        return { success: false, error: 'Authentication timed out' };
      }
      
      return { success: false, error: 'Authentication failed. Please try again.' };
    } finally {
      setIsAuthenticating(false);
    }
  };

  return {
    checkBiometricCapability,
    authenticateBiometric,
    isAuthenticating,
  };
}

// Helper function
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

### QR Code Upload Component

```typescript
// frontend/src/components/QRCodeUpload.tsx

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useBiometric } from '@/hooks/useBiometric';

export function QRCodeUploadFlow() {
  const [qrToken, setQRToken] = useState<string | null>(null);
  const [qrUrl, setQRUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'waiting' | 'completed'>('waiting');

  const generateQRCode = async () => {
    const response = await fetch('/api/v1/sessions/qr-token', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });

    const data = await response.json();
    setQRToken(data.token);
    setQRUrl(data.url);

    // Connect WebSocket to listen for upload
    connectWebSocket(data.token);
  };

  const connectWebSocket = (token: string) => {
    const ws = new WebSocket(`wss://rekindle.app/ws/upload/${token}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'upload_complete') {
        setUploadStatus('completed');
      }
    };
  };

  return (
    <div className="qr-upload-container">
      {uploadStatus === 'waiting' && qrUrl && (
        <>
          <h2>Scan with your phone</h2>
          <QRCodeSVG value={qrUrl} size={256} />
          <p>Waiting for upload...</p>
        </>
      )}
      
      {uploadStatus === 'completed' && (
        <>
          <h2>Photo uploaded! ✓</h2>
          <p>Continue editing on desktop</p>
        </>
      )}
    </div>
  );
}


// frontend/src/app/upload/page.tsx

export default function MobileUploadPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const { user } = useUser();
  const { checkBiometricCapability, authenticateBiometric, isAuthenticating } = useBiometric();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      const token = searchParams.token;
      if (!token) {
        setError('Invalid QR code');
        return;
      }

      // If already logged in, validate token and proceed
      if (user) {
        await validateTokenAndProceed(token);
        return;
      }

      // Check if biometric available
      const capability = await checkBiometricCapability();
      if (capability.available) {
        setBiometricAvailable(true);
        setShowBiometricPrompt(true);
      } else {
        // Fallback to Auth0 login
        window.location.href = `/api/auth/login?returnTo=/upload?token=${token}`;
      }
    };

    initAuth();
  }, [user, searchParams.token]);

  const handleBiometricAuth = async () => {
    const token = searchParams.token!;
    const result = await authenticateBiometric(token);

    if (result.success) {
      // Store temporary JWT
      sessionStorage.setItem('temp_jwt', result.accessToken!);
      // Redirect to upload
      window.location.href = '/upload/camera';
    } else {
      setError(result.error || 'Authentication failed');
    }
  };

  const handleFallbackLogin = () => {
    const token = searchParams.token!;
    window.location.href = `/api/auth/login?returnTo=/upload?token=${token}`;
  };

  if (showBiometricPrompt) {
    return (
      <div className="biometric-prompt">
        <h2>Confirm it's you</h2>
        <button
          onClick={handleBiometricAuth}
          disabled={isAuthenticating}
          className="biometric-button"
        >
          {isAuthenticating ? 'Authenticating...' : 'Scan Face / Fingerprint'}
        </button>
        {error && <p className="error">{error}</p>}
        <button onClick={handleFallbackLogin} className="fallback-button">
          Sign in instead
        </button>
      </div>
    );
  }

  return <div>Loading...</div>;
}
```

---

## Security Design

### JWT Token Structure

```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT",
    "kid": "ins_..."
  },
  "payload": {
    "sub": "auth0|abc123...",
    "email": "user@example.com",
    "email_verified": true,
    "iat": 1729533600,
    "exp": 1729537200,
    "iss": "https://rekindle.auth0.com",
    "aud": "https://api.rekindle.app"
  },
  "signature": "..."
}
```

### Session Cookie Configuration

```typescript
// Next.js Auth0 configuration
export const authConfig = {
  secret: process.env.AUTH0_SECRET,
  baseURL: process.env.AUTH0_BASE_URL,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  session: {
    cookie: {
      httpOnly: true,      // Prevent XSS
      secure: true,        // HTTPS only
      sameSite: 'lax',     // CSRF protection
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
    rolling: true,         // Extend session on activity
    rollingDuration: 60 * 60 * 24 * 7, // 7 days inactivity
  },
};
```

### Rate Limiting

```python
# backend/app/api/routes.py

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

@router.post("/users/sync")
@limiter.limit("5/minute")
async def sync_user(request: Request, ...):
    """Rate limited: 5 user creations per minute per IP"""
    pass

@router.post("/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, ...):
    """Rate limited: 10 login attempts per minute per IP"""
    pass

@router.post("/photos/upload")
@limiter.limit("30/minute")
async def upload_photo(request: Request, ...):
    """Rate limited: 30 uploads per minute per user"""
    pass
```

---

## Frontend Implementation

### Auth0 Provider Setup

```typescript
// frontend/src/app/layout.tsx

import { UserProvider } from '@auth0/nextjs-auth0/client';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
```

### Protected Routes Middleware

```typescript
// frontend/src/middleware.ts

import { withMiddlewareAuthRequired } from '@auth0/nextjs-auth0/edge';

export default withMiddlewareAuthRequired();

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/photos/:path*',
    '/settings/:path*',
    '/api/v1/:path*',
  ],
};
```

### Sign-In Page

```typescript
// frontend/src/app/sign-in/page.tsx

export default function SignIn() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-8">
          Welcome Back
        </h1>
        <a
          href="/api/auth/login"
          className="w-full btn btn-primary"
        >
          Sign In
        </a>
      </div>
    </div>
  );
}
```

---

## Error Handling

### Backend Error Responses

```python
# Standardized error responses

# 401 Unauthorized
{
    "detail": "Could not validate credentials",
    "error_code": "INVALID_TOKEN"
}

# 403 Forbidden (Tier)
{
    "detail": "This feature requires at least Remember tier",
    "error_code": "INSUFFICIENT_TIER",
    "required_tier": "remember",
    "current_tier": "free"
}

# 402 Payment Required (Credits)
{
    "detail": "Insufficient credits. Required: 8, Available: 2",
    "error_code": "INSUFFICIENT_CREDITS",
    "required_credits": 8,
    "available_credits": 2
}
```

### Frontend Error Handling

```typescript
// frontend/src/utils/apiClient.ts

export async function apiCall(url: string, options: RequestInit) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      
      if (response.status === 401) {
        // Redirect to login
        window.location.href = '/api/auth/login';
      } else if (response.status === 403) {
        // Show upgrade modal
        showUpgradeModal(error.required_tier);
      } else if (response.status === 402) {
        // Show buy credits modal
        showBuyCreditsModal(error.required_credits);
      }
      
      throw new Error(error.detail);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

---

## Testing Strategy

### Unit Tests (Backend)

```python
# tests/test_auth.py

def test_jwt_verification_success():
    """Test successful JWT verification"""
    token = create_test_jwt(user_id="auth0|123")
    user = verify_jwt(token)
    assert user.auth0_user_id == "auth0|123"

def test_jwt_verification_expired():
    """Test expired JWT handling"""
    token = create_expired_jwt(user_id="auth0|123")
    with pytest.raises(HTTPException) as exc:
        verify_jwt(token)
    assert exc.value.status_code == 401

def test_require_tier_success():
    """Test tier requirement check success"""
    user = create_test_user(tier="remember")
    result = check_tier_requirement(user, "remember")
    assert result is True

def test_require_tier_failure():
    """Test tier requirement check failure"""
    user = create_test_user(tier="free")
    with pytest.raises(HTTPException) as exc:
        check_tier_requirement(user, "remember")
    assert exc.value.status_code == 403

def test_require_credits_success():
    """Test credit requirement check"""
    user = create_test_user(monthly_credits=25)
    result = check_credit_requirement(user, 2)
    assert result is True
```

### Integration Tests (Backend)

```python
# tests/integration/test_auth_flow.py

@pytest.mark.integration
async def test_complete_signup_flow(client, db):
    """Test complete signup from Auth0 webhook to user creation"""
    
    # Simulate Auth0 webhook
    webhook_payload = {
        "type": "user.created",
        "data": {
            "user_id": "auth0|new123",
            "email": "new@example.com",
            "given_name": "John",
            "family_name": "Doe",
        }
    }
    
    response = client.post("/api/webhooks/auth0", json=webhook_payload)
    assert response.status_code == 200
    
    # Verify user created
    user = db.query(User).filter(User.auth0_user_id == "auth0|new123").first()
    assert user is not None
    assert user.email == "new@example.com"
    assert user.subscription_tier == "free"
    assert user.monthly_credits == 3
```

---

**Document Status:** ✅ Approved  
**Last Updated:** October 21, 2025  
**Next Step:** Create tasks.md

