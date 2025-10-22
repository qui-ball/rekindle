# Authentication Solutions - Comprehensive Comparison (2025)

## Research Methodology

**Date:** October 21, 2025  
**Sources:** Official pricing pages, community forums, recent blog posts, comparison articles  
**Note:** Pricing and features change frequently. Verify with official sources before final decision.

---

## Complete Feature & Pricing Matrix

### Core Comparison Table

| Provider          | Free Tier MAU | After Free    | Social Logins | MFA         | Email Mgmt | Next.js Support | Setup    | Trust Factor |
|-------------------|---------------|---------------|---------------|-------------|------------|-----------------|----------|--------------|
| **Auth0**         | 25,000*       | $35-240/mo    | ✅ 30+        | Basic, Adv Paid | ✅ Included | Good       | 5-7 days | Excellent    |
| **Clerk**         | 10,000        | $25+$0.02/MAU | ✅ All major  | ✅ Included | ✅ Included | Excellent      | 2-3 days | Good         |
| **AWS Cognito**   | 50,000        | $0.0055/MAU   | ✅ All major  | ✅ Included | Custom SMTP | Fair           | 7-10 days| Excellent    |
| **Supabase Auth** | 50,000        | $25/mo (Pro)  | ✅ All major  | ✅ Included | Custom SMTP | Good           | 5-7 days | Growing      |
| **Firebase Auth** | Unlimited†    | Pay-as-you-go | ✅ All major  | ✅ Included | ✅ Included | Good           | 3-5 days | Excellent    |

*\*Conflicting sources: some say 7,500 MAU. User reports website shows 25,000 MAU.*  
*†Firebase free for basic auth, SMS/phone costs extra*

---

## Detailed Analysis by Provider

### 1. Auth0 (Okta)

**Official Status:** Owned by Okta, enterprise-focused

#### Pricing Structure

```
Free Tier:
- 25,000 MAU (some sources say 7,500 - needs verification)
- 2 social identity providers
- Basic features only
- No custom domains
- Community support only

B2C Essentials: $35/month base
- 500 MAU included
- $0.07/MAU beyond base
- Unlimited social providers
- Custom domains
- Email support
- At 25,000 MAU: ~$1,750/month

B2C Professional: $240/month base
- 1,000 MAU included
- $0.245/MAU beyond base
- Advanced MFA
- Attack protection
- Priority support
- At 25,000 MAU: ~$6,120/month

B2B Pricing:
- Essentials: $150/mo (500 MAU)
- Professional: $800/mo (500 MAU)
- Enterprise: Custom pricing
```

#### Features

**Included in Free:**
- ✅ Email/password authentication
- ✅ 2 social providers (Google, Facebook)
- ✅ Password resets
- ✅ Email verification
- ✅ Basic user management
- ✅ JWT tokens
- ✅ Universal Login (limited customization)

**Paid Only:**
- ❌ Custom domains (Essentials+)
- ❌ Advanced MFA (Professional+)
- ❌ RBAC (Essentials+)
- ❌ Custom email templates (Essentials+)
- ❌ Breached password detection (Professional+)
- ❌ Attack protection (Professional+)

#### Pros
- ✅ **Largest free tier** (if 25,000 MAU is correct)
- ✅ **Enterprise-grade security** - SOC 2 Type II, HIPAA compliant
- ✅ **Mature platform** - 13+ years, trusted by Fortune 500
- ✅ **Extensive integrations** - 30+ social providers, enterprise SSO
- ✅ **Great documentation** - comprehensive guides, SDKs
- ✅ **Trust factor** - Well-known brand for 30-60 y/o demographic

#### Cons
- ❌ **Steep cost scaling** - $1,750/mo at 25K MAU (Essentials)
- ❌ **Complex setup** - Steep learning curve
- ❌ **Feature gating** - Many essential features require paid plans
- ❌ **Vendor lock-in** - Difficult to migrate away
- ❌ **Documentation issues** - Some reports of outdated/contradictory docs
- ❌ **B2B limitations** - Limited enterprise SSO connections on paid plans

#### Best For
- Enterprises with budget
- Applications requiring advanced security compliance
- Projects with >25K users who can afford enterprise pricing
- Organizations needing extensive audit logs and compliance features

---

### 2. Clerk (clerk.com)

**Official Status:** Modern auth platform, Y Combinator backed

#### Pricing Structure

```
Free Tier:
- 10,000 MAU
- All features included
- Community support

Pro Plan: $25/month base
- $0.02 per MAU beyond 10,000
- All features included
- Email support
- 
At 15,000 MAU: $25 + (5,000 × $0.02) = $125/month
At 25,000 MAU: $25 + (15,000 × $0.02) = $325/month
At 50,000 MAU: $25 + (40,000 × $0.02) = $825/month

Enterprise:
- Custom pricing
- Volume discounts
- SLA guarantees
- Dedicated support
```

#### Features

**Included in Free:**
- ✅ Pre-built React/Next.js components
- ✅ All social providers
- ✅ MFA (SMS, authenticator app, backup codes)
- ✅ Session management
- ✅ User profile management
- ✅ Organization/tenant management
- ✅ WebAuthn/Passkeys
- ✅ Magic links
- ✅ Custom email templates
- ✅ Webhooks
- ✅ RBAC
- ✅ Device management

**No Feature Gating:**
- All features available on free tier
- Only MAU limit scales with pricing

#### Pros
- ✅ **Best Next.js integration** - Drop-in components, middleware
- ✅ **Fastest implementation** - 2-3 days to production
- ✅ **Modern UX** - Beautiful pre-built UI, customizable
- ✅ **All features included** - No feature gating at any tier
- ✅ **Excellent DX** - Developer-friendly, great docs
- ✅ **Transparent pricing** - Simple, predictable
- ✅ **RBAC included** - Perfect for tier-based access control
- ✅ **Active development** - Rapid feature releases

#### Cons
- ❌ **Smaller free tier** - 10,000 vs Auth0's 25,000 (or Cognito's 50,000)
- ❌ **Cost at scale** - $325/mo at 25K users, $825/mo at 50K
- ❌ **Less mature** - Founded 2020 vs Auth0's 2013
- ❌ **React-focused** - Best experience requires React/Next.js
- ❌ **Newer platform** - Less battle-tested than Auth0/Cognito
- ❌ **Less enterprise features** - No advanced fraud detection, limited compliance certs

#### Best For
- Next.js/React applications
- Startups prioritizing speed to market
- Projects valuing developer experience
- Applications needing <25K MAU with tight budgets
- SaaS apps requiring org/tenant management

---

### 3. AWS Cognito

**Official Status:** Amazon managed service, part of AWS ecosystem

#### Pricing Structure

```
Free Tier:
- 50,000 MAU
- Basic features included
- No time limit

Standard Pricing (beyond free):
- $0.0055 per MAU

At 75,000 MAU: (25,000 × $0.0055) = $137.50/month
At 100,000 MAU: (50,000 × $0.0055) = $275/month
At 200,000 MAU: (150,000 × $0.0055) = $825/month

Additional Costs:
- SMS MFA: $0.00645 per message
- Advanced security features: Additional fees
```

#### Features

**Included in Free:**
- ✅ User pools (authentication)
- ✅ Identity pools (AWS resource access)
- ✅ Social identity providers
- ✅ SAML/OIDC enterprise federation
- ✅ Basic MFA (SMS, TOTP)
- ✅ Lambda triggers (custom auth flows)
- ✅ User groups and attributes
- ✅ Password policies

**Additional Features:**
- ✅ Advanced security features (adaptive auth, bot detection) - $0.05/MAU
- ✅ Deep AWS integration (S3, Lambda, API Gateway)
- ✅ User migration triggers

#### Pros
- ✅ **Largest free tier** - 50,000 MAU (beats everyone)
- ✅ **Most cost-effective at scale** - $0.0055/MAU is lowest
- ✅ **AWS integration** - Perfect for AWS-centric architectures
- ✅ **Highly scalable** - Proven to handle millions of users
- ✅ **Lambda triggers** - Extreme customization flexibility
- ✅ **No vendor lock-in** (if using standard protocols)
- ✅ **Trust factor** - Amazon infrastructure

#### Cons
- ❌ **Complex setup** - Steepest learning curve
- ❌ **Poor UI** - Hosted UI is minimal, hard to customize
- ❌ **Confusing documentation** - AWS docs can be overwhelming
- ❌ **Manual email setup** - Requires configuring SES or custom SMTP
- ❌ **Immutable schema** - Can't modify user pool attributes after creation
- ❌ **Error handling** - Cryptic error messages
- ❌ **Requires AWS knowledge** - Not beginner-friendly

#### Best For
- AWS-centric applications
- Large-scale applications (>50K users)
- Cost-sensitive projects with technical teams
- Applications requiring custom auth flows
- Projects already using AWS infrastructure

---

### 4. Supabase Auth

**Official Status:** Open-source Firebase alternative

#### Pricing Structure

```
Free Tier:
- 50,000 MAU
- 500MB database
- 1GB file storage
- 2GB bandwidth

Pro Plan: $25/month
- 100,000 MAU
- 8GB database
- 100GB file storage
- 50GB bandwidth
- Additional MAU: $0.00325/user

At 150,000 MAU: $25 + (50,000 × $0.00325) = $187.50/month
At 200,000 MAU: $25 + (100,000 × $0.00325) = $350/month

Team & Enterprise:
- Custom pricing
- Advanced features
```

#### Features

**Included in Free:**
- ✅ Email/password authentication
- ✅ Social OAuth providers
- ✅ Phone/SMS authentication
- ✅ Row Level Security (RLS)
- ✅ PostgreSQL database
- ✅ Real-time subscriptions
- ✅ File storage
- ✅ Auto-generated APIs

**Additional Features:**
- ✅ MFA (TOTP)
- ✅ SSO/SAML (Enterprise)
- ✅ Webhooks
- ✅ PostgreSQL full-text search

#### Pros
- ✅ **Large free tier** - 50,000 MAU
- ✅ **Most cost-effective** - $0.00325/MAU is lowest
- ✅ **Full backend suite** - Auth + DB + Storage + Realtime
- ✅ **Open source** - Self-hostable, no vendor lock-in
- ✅ **PostgreSQL native** - Direct database access
- ✅ **Row Level Security** - Database-level authorization
- ✅ **Great DX** - Modern, developer-friendly
- ✅ **Active development** - Rapid feature releases

#### Cons
- ❌ **Requires migration** - Must move from AWS RDS to Supabase PostgreSQL
- ❌ **All-or-nothing** - Best value when using full suite
- ❌ **S3 migration** - Need to migrate from AWS S3 to Supabase Storage
- ❌ **Email setup** - Custom SMTP required for production
- ❌ **Less mature** - Newer platform (2020)
- ❌ **Limited compliance certs** - Fewer than Auth0/AWS
- ❌ **Architecture change** - Complete rewrite of current setup

#### Best For
- New projects (greenfield)
- Open-source advocates
- PostgreSQL-centric applications
- Cost-sensitive projects at scale (>100K users)
- Projects wanting full backend suite
- Applications requiring real-time features

---

### 5. Firebase Authentication

**Official Status:** Google managed service

#### Pricing Structure

```
Free Tier (Spark Plan):
- Unlimited users for email/password
- 10,000 phone auth verifications/month
- 50,000 daily active users (hard limit)

Pay-as-you-go (Blaze Plan):
- Email/password: Free
- Phone auth: ~$0.01-0.06 per verification (region-dependent)
- No per-user fees

Estimated costs at scale:
- 25,000 users (email): $0/month
- 25,000 users (phone auth): ~$250/month (if all use phone)
- 50,000 users (email): $0/month
- 100,000 users (email): $0/month
```

#### Features

**Included in Free:**
- ✅ Email/password authentication
- ✅ Social providers (Google, Facebook, etc.)
- ✅ Anonymous authentication
- ✅ Custom authentication
- ✅ Email verification
- ✅ Password reset
- ✅ User management
- ✅ Security rules

**Additional Features:**
- ✅ Phone authentication (pay-per-use)
- ✅ Multi-tenancy (paid)
- ✅ SAML/OIDC (paid)
- ✅ Realtime database integration
- ✅ Cloud Firestore integration
- ✅ Firebase Cloud Messaging

#### Pros
- ✅ **Unlimited email auth** - No MAU limits for basic auth
- ✅ **Google infrastructure** - Reliable, scalable
- ✅ **Full ecosystem** - Database, storage, hosting, analytics
- ✅ **Mobile-first** - Excellent iOS/Android SDKs
- ✅ **Trust factor** - Google brand
- ✅ **Good DX** - Simple to implement
- ✅ **Generous free tier** - 50K daily active users

#### Cons
- ❌ **Phone auth costs** - Can get expensive
- ❌ **Limited customization** - Hosted UI is basic
- ❌ **Google lock-in** - Hard to migrate away
- ❌ **Limited features** - No built-in MFA (email/password)
- ❌ **Not ideal for web** - Best for mobile apps
- ❌ **No RBAC** - Must build yourself
- ❌ **Compliance** - Fewer certs than Auth0/AWS

#### Best For
- Mobile applications
- Projects already using Firebase
- Applications not using phone authentication
- Cost-sensitive projects with email-only auth
- Rapid prototyping

---

## Cost Comparison at Key User Counts

### At 10,000 MAU

| Provider | Monthly Cost | Notes |
|----------|--------------|-------|
| Auth0 | $0 | Within free tier |
| Clerk | $0 | At free tier limit |
| AWS Cognito | $0 | Within free tier |
| Supabase | $0 | Within free tier |
| Firebase | $0 | Unlimited (email only) |

**Winner:** All providers are free at 10K

---

### At 25,000 MAU

| Provider | Monthly Cost | Notes |
|----------|--------------|-------|
| Auth0 | $0 or $1,750 | Free if 25K limit is correct, otherwise Essentials plan |
| Clerk | $325 | $25 + (15,000 × $0.02) |
| AWS Cognito | $0 | Within free tier |
| Supabase | $0 | Within free tier |
| Firebase | $0 | Unlimited (email only) |

**Winner:** Auth0 (if 25K free), AWS Cognito, Supabase, Firebase

---

### At 50,000 MAU

| Provider | Monthly Cost | Notes |
|----------|--------------|-------|
| Auth0 | $1,750+ | B2C Essentials required |
| Clerk | $825 | $25 + (40,000 × $0.02) |
| AWS Cognito | $0 | At free tier limit |
| Supabase | $0 | Pro plan recommended ($25) but free works |
| Firebase | $0 | Unlimited (email only) |

**Winner:** AWS Cognito, Supabase, Firebase

---

### At 100,000 MAU

| Provider | Monthly Cost | Notes |
|----------|--------------|-------|
| Auth0 | $3,500+ | B2C Essentials |
| Clerk | $1,825 | $25 + (90,000 × $0.02) |
| AWS Cognito | $275 | $0.0055 × 50,000 |
| Supabase | $187.50 | $25 + (50,000 × $0.00325) |
| Firebase | $0 | Unlimited (email only) |

**Winner:** Firebase (if email only), Supabase, AWS Cognito

---

## Decision Matrix

### Prioritize Developer Velocity & Next.js

**Winner:** Clerk
- Fastest implementation (2-3 days)
- Best Next.js integration
- Beautiful pre-built UI
- **Cost at 25K:** $325/month

### Prioritize Cost (Long-term)

**Winner:** AWS Cognito or Supabase
- AWS Cognito: Most cost-effective at scale ($275/mo at 100K)
- Supabase: Best for PostgreSQL apps ($187.50/mo at 100K)
- **Trade-off:** More complex setup

### Prioritize Free Tier Runway

**Winner:** Auth0 (if 25K confirmed) or AWS Cognito/Supabase (50K)
- Auth0: 25,000 MAU free (needs verification)
- AWS Cognito: 50,000 MAU free
- Supabase: 50,000 MAU free
- **Trade-off:** Auth0 expensive after, AWS/Supabase complex

### Prioritize Trust & Compliance

**Winner:** Auth0 or AWS Cognito
- Auth0: SOC 2, HIPAA, PCI DSS certified
- AWS Cognito: AWS compliance portfolio
- **Trade-off:** Higher cost (Auth0) or complexity (Cognito)

### Prioritize Mobile Apps

**Winner:** Firebase
- Best mobile SDKs
- Unlimited email auth
- Full mobile backend
- **Trade-off:** Limited web features

---

## Final Recommendation for Rekindle

### Your Context
- **Tech Stack:** Next.js (frontend) + FastAPI (backend) + PostgreSQL + AWS S3
- **Current Setup:** Partially implemented Auth0 (in steering docs)
- **Target Users:** 30-60 y/o families (need trust, simplicity)
- **MVP Goal:** Launch quickly, validate, scale if successful
- **Expected Growth:** 0-25K users in first year

### Analysis

#### Option 1: Auth0 (RECOMMENDED IF 25K FREE TIER CONFIRMED) ⭐

**Pros:**
- ✅ 25,000 MAU free tier (if confirmed) - covers entire MVP phase
- ✅ Trusted brand for target demographic
- ✅ Already in steering docs (less decision friction)
- ✅ Enterprise-grade security
- ✅ Handles all email management

**Cons:**
- ❌ 5-7 days implementation time
- ❌ Expensive after 25K ($1,750/mo+)
- ❌ Complex dashboard configuration

**Cost Projection:**
```
Year 1 (0-25K users): $0/month
Year 2 (25-50K users): $1,750/month ($21,000/year)
Year 3 (50-100K users): $3,500/month ($42,000/year)
```

**Decision:** ✅ **Go with Auth0** IF website confirms 25,000 MAU free tier

---

#### Option 2: AWS Cognito (RECOMMENDED FOR COST OPTIMIZATION) ⭐⭐

**Pros:**
- ✅ 50,000 MAU free tier - covers MVP + early growth
- ✅ Most cost-effective at scale
- ✅ Already using AWS (S3, possibly RDS)
- ✅ No vendor lock-in concerns
- ✅ Lambda triggers for custom flows

**Cons:**
- ❌ 7-10 days implementation time
- ❌ Complex setup, steep learning curve
- ❌ Manual email configuration (SES required)
- ❌ Poor hosted UI (will need custom)
- ❌ Less trusted brand than Auth0

**Cost Projection:**
```
Year 1 (0-50K users): $0/month
Year 2 (50-100K users): $0-275/month
Year 3 (100-200K users): $275-825/month
```

**Decision:** ✅ **Strong alternative** if you have AWS expertise and want lowest cost at scale

---

#### Option 3: Clerk (RECOMMENDED FOR SPEED) ⭐

**Pros:**
- ✅ 2-3 days implementation (FASTEST)
- ✅ Best Next.js integration
- ✅ Beautiful pre-built UI (matches brand)
- ✅ All features included (RBAC, MFA, orgs)
- ✅ Excellent developer experience

**Cons:**
- ❌ Only 10,000 MAU free
- ❌ $325/month at 25K users
- ❌ Less trusted brand (newer company)

**Cost Projection:**
```
Year 1 (0-25K users): $0-325/month ($0-3,900/year)
Year 2 (25-50K users): $325-825/month ($3,900-9,900/year)
Year 3 (50-100K users): $825-1,825/month ($9,900-21,900/year)
```

**Decision:** ✅ **Best if speed to market is critical** and you have budget for $3,900/year

---

#### Option 4: Supabase (RECOMMENDED FOR GREENFIELD)

**Pros:**
- ✅ 50,000 MAU free
- ✅ Lowest cost at scale ($187.50/mo at 100K)
- ✅ Full backend suite included
- ✅ PostgreSQL native
- ✅ Open source

**Cons:**
- ❌ Requires database migration from AWS RDS
- ❌ Requires storage migration from AWS S3
- ❌ 7-10 days implementation
- ❌ Complete architecture change

**Decision:** ❌ **Not recommended** - too much migration risk for MVP

---

#### Option 5: Firebase

**Decision:** ❌ **Not recommended** - primarily for mobile apps, not ideal for your web-focused PWA

---

## FINAL RECOMMENDATION

### Primary: **Auth0** (IF 25,000 MAU Free Tier Confirmed)

**Why:**
1. **Covers MVP entirely at $0** (0-25K users)
2. **Trusted brand** for your 30-60 y/o target demographic
3. **Already in steering docs** - less change management
4. **Enterprise security** out of the box
5. **Complete email management** included

**Action Items:**
1. ✅ **VERIFY Auth0's free tier** - check official website
2. ✅ If 25,000 MAU confirmed → Proceed with Auth0
3. ✅ If only 7,500 MAU → Consider alternatives below

---

### Alternative 1: **AWS Cognito** (IF Cost is Priority)

**Why:**
1. **50,000 MAU free** - best free tier runway
2. **Most cost-effective at scale** - $275/mo at 100K vs $3,500 (Auth0)
3. **Already using AWS** - fits existing infrastructure
4. **Savings over 3 years:** ~$75,000 compared to Auth0

**Trade-off:**
- 2-3 days more implementation time
- Need to handle email (SES) separately
- Steeper learning curve

---

### Alternative 2: **Clerk** (IF Speed is Priority)

**Why:**
1. **Fastest to market** - 2-3 days vs 5-7 (Auth0)
2. **Best Next.js DX** - drop-in components
3. **Modern UI** - matches "emotional" brand
4. **All features included** - no surprises

**Trade-off:**
- Smaller free tier (10K MAU)
- Costs $3,900/year in growth phase (10K-25K)
- Less brand recognition

---

## Action Plan

### Step 1: Verify Auth0 Free Tier
- [ ] Visit auth0.com/pricing
- [ ] Check free tier MAU limit
- [ ] Screenshot for documentation

### Step 2: Decision Tree

```
IF Auth0 free tier = 25,000 MAU:
  → Choose Auth0
  → Timeline: 5-7 days
  → Cost Year 1: $0
  
ELSE IF team has AWS expertise AND cost is priority:
  → Choose AWS Cognito
  → Timeline: 7-10 days
  → Cost Year 1: $0
  
ELSE IF speed to market is critical:
  → Choose Clerk
  → Timeline: 2-3 days
  → Cost Year 1: $0-3,900
  
ELSE:
  → Default to Auth0 (even if 7,500 MAU)
  → Timeline: 5-7 days
  → Cost Year 1: $0 (if under 7.5K)
```

### Step 3: Implementation
- [ ] Create detailed implementation plan
- [ ] Set up test account
- [ ] Implement MVP auth flow
- [ ] Test thoroughly
- [ ] Deploy to production

---

## Verification Checklist

Before making final decision, verify:

- [ ] Auth0 free tier MAU limit (25,000 or 7,500?)
- [ ] Team's AWS expertise level
- [ ] Implementation timeline requirements
- [ ] Budget for Year 1-2
- [ ] Required features (MFA, social logins, etc.)
- [ ] Compliance requirements
- [ ] Migration complexity tolerance

---

**Document Status:** Ready for decision  
**Next Step:** Verify Auth0 free tier, then choose based on decision tree above

