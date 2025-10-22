# Authentication & Authorization Specification - Executive Summary

## 📋 Quick Reference

**Created:** October 21, 2025  
**Status:** Ready for implementation  
**Full Spec:** [00-specification.md](./00-specification.md)

---

## 🎯 Key Recommendation

**Stick with Auth0** for MVP authentication (Updated)

### Why Auth0? ⭐

1. ✅ **Excellent Free Tier:** 25,000 MAU (2.5x better than Clerk's 10,000)
2. ✅ **Enterprise-Grade:** Battle-tested security, trusted by target demographic
3. ✅ **Cost Savings:** $0 until 25K users vs Clerk's $325/month at 25K
4. ✅ **Complete Package:** Social logins, email management, MFA included
5. ✅ **Mature Ecosystem:** Better docs, more integrations

**Trade-off:** Clerk is 3-4 days faster to implement, but Auth0 saves **$3,900/year** during growth phase (10K-25K users).

### Cost Comparison (CORRECTED)

| Users | Auth0 ⭐ | Clerk | Supabase |
|-------|---------|-------|----------|
| 10K | $0 | $0 | $0 |
| 15K | $0 | $125 | $0 |
| 25K | $0 | $325 | $0 |
| 30K | $35+ | $425 | $0 |
| 50K | $240+ | $825 | $513 |

**Critical Insight:** Auth0 is **FREE** for your entire MVP validation phase (0-25K users)!

---

## 🏗️ Architecture Overview

```
User Device
    ↓
Next.js Frontend (Clerk SDK)
    ↓ JWT Token
FastAPI Backend (JWT Verification)
    ↓
PostgreSQL (User Database)
```

**Key Components:**
- **Frontend:** Clerk React components + hooks
- **Backend:** JWT verification + user management
- **Database:** PostgreSQL user table
- **Session:** Clerk-managed sessions (1-hour JWT, auto-refresh)

---

## 👥 User Model

### Database Schema

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    
    -- Subscription
    subscription_tier VARCHAR(20) DEFAULT 'free',
    monthly_credits INTEGER DEFAULT 3,
    topup_credits INTEGER DEFAULT 0,
    stripe_customer_id VARCHAR(255),
    
    -- Storage
    storage_used_bytes BIGINT DEFAULT 0,
    storage_limit_bytes BIGINT DEFAULT 0,
    
    -- Metadata
    account_status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP
);
```

### User Tiers

| Tier | Monthly Price | Credits | Quality | Storage | Priority |
|------|---------------|---------|---------|---------|----------|
| **Free (Try)** | $0 | 3 | 480p | 7-day expiry | Standard |
| **Remember** | $9.99 | 25 | 720p | 10GB | Priority |
| **Cherish** | $19.99 | 60 | 720p | 50GB | Priority |
| **Forever** | $39.99 | 150 | 720p | 200GB | Highest |

---

## 🔐 Authentication Flows

### 1. Sign Up
```
User → Clerk Sign-Up Component
  ↓
Clerk creates account + sends verification email
  ↓
User verifies email
  ↓
Clerk webhook → Backend creates user record
  ↓
User redirected to /dashboard with 3 free credits
```

### 2. Sign In
```
User → Clerk Sign-In Component
  ↓
Clerk verifies credentials
  ↓
Clerk creates session + JWT
  ↓
Frontend fetches user profile from backend
  ↓
User redirected to /dashboard
```

### 3. Social Login (Google, Facebook, Apple)
```
User → Click "Continue with Google"
  ↓
Clerk → Google OAuth
  ↓
Google returns user info
  ↓
Clerk creates/links account
  ↓
Backend creates user record (if new)
  ↓
User redirected to /dashboard
```

---

## 🛡️ Authorization Model

### Tier-Based Access Control

**Permission Matrix:**

| Feature | Free | Remember | Cherish | Forever |
|---------|------|----------|---------|---------|
| Restoration | ✅ | ✅ | ✅ | ✅ |
| Colourization | ✅ | ✅ | ✅ | ✅ |
| Animation | ❌ | ✅ | ✅ | ✅ |
| Bring Together | ❌ | ✅ | ✅ | ✅ |
| Batch Upload | ❌ | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ❌ | ✅ |
| Download Original | ❌ | ✅ | ✅ | ✅ |
| Max Resolution | 480p | 720p | 720p | 720p |
| Watermark | Yes | No | No | No |

### Backend Permission Checks

```python
@router.post("/photos/animate")
@require_tier("remember")  # Requires paid tier
@require_credits(8)  # Costs 8 credits
async def animate_photo(...):
    pass
```

### Frontend Permission Checks

```typescript
const { canAnimate, hasCredits } = usePermissions();

<Button
  onClick={handleAnimate}
  disabled={!canAnimate()}
  title={!canAnimate() ? 'Requires Remember tier' : ''}
>
  Animate (8 credits) {!hasTier('remember') && '🔒'}
</Button>
```

---

## 🔒 Session Management

### Session Details

- **JWT Lifetime:** 1 hour (auto-refreshed by Clerk SDK)
- **Session Lifetime:** 30 days maximum
- **Inactivity Timeout:** 7 days
- **Storage:** Secure, httpOnly cookies
- **Refresh:** Automatic, transparent to user

### Session Security

```typescript
// Clerk handles:
- Cookie security (httpOnly, secure, sameSite)
- JWT signature verification (RS256)
- Automatic token refresh
- Session monitoring
- Device management
- Multi-session support
```

---

## 🚀 Implementation Timeline

### Phase 1: Authentication Setup (Week 1-2)

**Week 1:**
- Set up Clerk account and configure dashboard
- Install Clerk SDK in Next.js
- Create sign-in/sign-up pages
- Set up protected routes middleware
- Configure Clerk webhooks

**Week 2:**
- Create User model and database migration
- Implement user sync endpoint
- Set up JWT verification in backend
- Build user profile page
- Create `useCurrentUser` hook

**Deliverables:** Working authentication, user creation, JWT verification

### Phase 2: Authorization (Week 3)
- Implement tier-based permissions
- Create credit deduction system
- Build permission decorators
- Add upgrade prompts for locked features

**Deliverables:** Full authorization system, credit management

### Phase 3: Security & UX (Week 4-5)
- Rate limiting
- Security hardening
- Settings page (profile, security, sessions)
- Account deletion flow
- Data export (GDPR)

**Deliverables:** Production-ready auth system

---

## 📊 Testing Requirements

### Unit Tests
- JWT verification (valid/invalid tokens)
- Tier-based access control
- Credit deduction logic
- Permission checks

### Integration Tests
- Complete signup flow (Clerk webhook → user creation)
- Complete signin flow
- Protected route access
- Social login flows

### Security Tests
- Rate limiting
- Input validation
- Session expiration
- Token refresh

**Target:** 80%+ code coverage on authentication modules

---

## 🔑 Environment Variables

### Frontend (.env.local)
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (.env)
```bash
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
DATABASE_URL=postgresql://user:pass@localhost:5432/rekindle_dev
```

---

## 📦 Required Packages

### Frontend
```bash
npm install @clerk/nextjs
```

### Backend
```bash
pip install python-jose[cryptography] pydantic sqlalchemy
```

---

## ⚠️ Important Decisions

### 1. **Auth0 over Clerk** (CORRECTED)
- **Reason:** 2.5x larger free tier (25K vs 10K MAU), saves $3,900/year in growth phase
- **Trade-off:** 3-4 days slower implementation than Clerk
- **Mitigation:** Worth the extra setup time for significantly better economics

### 2. **JWT-Based Sessions**
- **Reason:** Stateless, scalable, standard
- **Trade-off:** Can't invalidate individual JWTs (rely on short expiration)
- **Mitigation:** 1-hour JWT lifetime, Auth0 handles session revocation

### 3. **Tier-Based RBAC**
- **Reason:** Simple, aligns with business model
- **Trade-off:** Less granular than attribute-based access control
- **Mitigation:** Sufficient for MVP, can extend later

---

## 🎯 Success Metrics

### MVP Launch Targets
- ✅ 100% authentication success rate
- ✅ <2s sign-in/sign-up completion time
- ✅ 95%+ JWT verification success rate
- ✅ Zero security vulnerabilities (critical/high)
- ✅ 80%+ test coverage

### User Experience Targets
- ✅ <3 clicks to complete signup
- ✅ Social login success rate >95%
- ✅ Session persistence across devices
- ✅ <1% account creation failures

---

## 📚 Additional Resources

- **Full Specification:** [00-specification.md](./00-specification.md)
- **Clerk Documentation:** https://clerk.com/docs
- **JWT Best Practices:** https://tools.ietf.org/html/rfc8725
- **OWASP Auth Cheatsheet:** https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

---

## 🏁 Next Steps

1. **Review this specification** with technical team
2. **Get sign-off** from product and security
3. **Set up Clerk test account** and explore dashboard
4. **Create database migration** for users table
5. **Start Phase 1 implementation** (Week 1-2)

---

**Questions or concerns?** Review the full specification or consult with the team.

**Ready to implement?** Follow the 5-week roadmap in the full spec.

