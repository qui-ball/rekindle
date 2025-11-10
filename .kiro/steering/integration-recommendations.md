# Integration Recommendations (MVP)

## Overview
This document provides specific service recommendations for our MVP photo restoration service, focusing only on what we'll actually implement.

**MVP Services Stack:**
- **Payments:** Stripe (subscriptions + credits)
- **Authentication:** Supabase Auth (free tier)
- **AI Processing:** RunPod (Qwen 3 Image Edit)
- **Storage:** AWS S3 + CloudFront
- **Database:** PostgreSQL
- **Queue:** Redis
- **Analytics:** Basic logging (no paid tools)

## Payment Processing - Stripe

**Why Stripe:**
- Industry standard for SaaS subscriptions
- Built-in credit system support
- Excellent React integration
- Trusted by our target demographic (30-60 y/o)

**Implementation:**
```typescript
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Subscription creation
const createSubscription = async (priceId: string, userId: string) => {
  const response = await fetch('/api/subscriptions/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId, userId })
  });
  return response.json();
};

// Credit purchase
const purchaseCredits = async (creditPackId: string) => {
  const response = await fetch('/api/credits/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creditPackId })
  });
  return response.json();
};
```

**Pricing Setup:**
- Remember: $9.99/month (25 credits)
- Cherish: $19.99/month (60 credits)
- Forever: $39.99/month (150 credits)
- Top-ups: $4.99-$39.99 (10-100 credits)

## Authentication - Supabase Auth

**Why Supabase Auth:**
- Free up to 50,000 monthly active users
- Built-in email template testing (no external provider needed)
- Social login support (Google, Facebook, Apple)
- Modern developer experience with clean dashboard
- Lower cost at scale ($187.50/mo at 100K users vs $3,500/mo for alternatives)

**Cost:** Free for MVP (up to 50,000 users), then $25/mo base + $0.00325/user

**Implementation:**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Auth context hook
export function useAuth() {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    return { data, error };
  };

  return { user, signInWithGoogle };
}

// Social login component
const SocialLogin: React.FC = () => {
  const { signInWithGoogle } = useAuth();

  return (
    <div>
      <button onClick={signInWithGoogle}>
        Continue with Google
      </button>
    </div>
  );
};
```

## File Storage - AWS S3 + CloudFront

**Why S3 + CloudFront:**
- Cost-effective for image storage
- Global CDN for fast delivery
- Signed URLs for security
- Seamless integration

**Implementation:**
```typescript
// CDN URL generation
const getCDNUrl = (fileKey: string, contentType: 'processed' | 'thumbnail') => {
  const baseUrl = process.env.NEXT_PUBLIC_CDN_BASE_URL;
  
  switch (contentType) {
    case 'processed':
      return `${baseUrl}/results/${fileKey}`;
    case 'thumbnail':
      return `${baseUrl}/thumbs/${fileKey}`;
  }
};
```

## Database - PostgreSQL

**Why PostgreSQL:**
- ACID compliance for financial transactions
- JSON support for flexible metadata
- Reliable and well-supported

**Core Tables:**
```sql
-- Users with subscription tracking
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    supabase_id VARCHAR(255) UNIQUE NOT NULL,
    tier VARCHAR(20) DEFAULT 'free',
    monthly_credits INTEGER DEFAULT 0,
    topup_credits INTEGER DEFAULT 0,
    subscription_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Photos with processing metadata
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    original_filename VARCHAR(255) NOT NULL,
    file_key VARCHAR(255) NOT NULL,
    processing_options JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Processing jobs
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID REFERENCES photos(id),
    job_type VARCHAR(50) NOT NULL, -- 'restoration', 'coloring'
    status VARCHAR(20) DEFAULT 'pending',
    cost_cents INTEGER,
    result_file_key VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    tier VARCHAR(20) NOT NULL, -- 'remember', 'cherish', 'forever'
    stripe_subscription_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Queue Management - Redis

**Why Redis:**
- Simple and reliable
- Priority queues for free vs paid users
- Built-in retry logic
- Cost-effective

**Implementation:**
```typescript
import Queue from 'bull';

const freeQueue = new Queue('photo processing free');
const paidQueue = new Queue('photo processing paid');

// Job scheduling based on user tier
const schedulePhotoProcessing = async (photoData: any, userTier: string) => {
  const jobOptions = {
    attempts: 3,
    backoff: 'exponential'
  };

  if (userTier === 'free') {
    return freeQueue.add('process-photo', photoData, jobOptions);
  } else {
    return paidQueue.add('process-photo', photoData, { ...jobOptions, priority: 10 });
  }
};
```

## AI Processing - RunPod

**Models:**
- **MVP:** Qwen 3 Image Edit (restoration + colourization)
- **Post-MVP:** Wan 2.2 T2V A14B (animation), Qwen 3 Image Edit 2509 (bring together)

**Implementation:**
```python
class RunPodService:
    def __init__(self):
        self.api_key = settings.RUNPOD_API_KEY
        self.models = {
            'restoration': 'qwen-3-image-edit',
            'colourization': 'qwen-3-image-edit'
        }
    
    async def process_photo(self, image_data: bytes, job_type: str, user_tier: str) -> bytes:
        max_resolution = '720p' if user_tier != 'free' else '480p'
        
        result = await self._run_model(
            model=self.models[job_type],
            input={'image': image_data, 'task': job_type, 'max_resolution': max_resolution}
        )
        
        return result
```

## Basic Sharing (MVP)

**Simple sharing only:**
```typescript
// Native share API for mobile
const shareResult = async (resultUrl: string) => {
  if (navigator.share) {
    await navigator.share({
      title: 'Look how I restored this old photo!',
      url: resultUrl
    });
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(resultUrl);
    alert('Link copied to clipboard!');
  }
};
```

## Monitoring (MVP)

**Basic logging only:**
- Application logs to console/files
- Manual cost tracking
- Simple health checks
- No paid monitoring tools for MVP

**Future:** Add Sentry for error tracking when budget allows

## Key Events to Track (Manual)

**Essential metrics only:**
```typescript
// Basic event tracking (no analytics service for MVP)
const trackEvent = (event: string, data: any) => {
  console.log(`Event: ${event}`, data);
  // Store in database for manual analysis
};

// Track key user actions
trackEvent('user_registered', { userId, tier: 'free' });
trackEvent('photo_uploaded', { userId, fileSize, uploadMethod });
trackEvent('processing_completed', { userId, jobType, processingTime });
trackEvent('subscription_created', { userId, tier, price });
```

This minimal integration approach keeps costs low during MVP validation while providing all necessary functionality for core photo restoration and colourization features.