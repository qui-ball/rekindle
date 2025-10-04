# Product & Sales Strategy

## Product Vision & Purpose

### Core Mission
**"Bring your memories to life."**

Transform old, damaged, or faded family photos into vibrant, restored memories. Our service bridges the emotional gap between past and present by making family history accessible and engaging through professional-grade AI restoration and colourization.

### Target Market & Value Proposition
- **Primary Audience:** Casual users aged 30-60, particularly families with cherished baby/wedding photos
- **Positioning:** Emotional, magical, nostalgic — not "AI techy"
- **Core Value:** Turn static memories into living moments that spark joy and connection
- **Differentiation:** Credit-based subscription model with professional-grade AI processing at consumer-friendly prices

### Product Philosophy
- **Emotional First:** Every feature decision prioritizes emotional impact over technical complexity
- **Accessibility:** Simple, one-click experience that anyone can use regardless of technical skill
- **MVP Focus:** Deliver core features exceptionally well before adding complexity
- **Quality at Scale:** Professional-grade results at consumer-friendly prices

**Related Documents:**
- `technical-architecture.md` - Technical implementation of product vision
- `development-standards.md` - Code quality standards supporting product goals
- `integration-recommendations.md` - Service selections aligned with target market
- `photo-upload-strategy.md` - Comprehensive upload strategy for Phase 1 MVP and beyond

---

## Infrastructure Cost Analysis

### AI Processing Costs (Per Job)

**MVP Features (RunPod with Qwen 3 Image Edit):**
```
┌─────────────────┬──────────────────┬─────────────────┐
│ Service Type    │ RunPod Cost      │ Processing Time │
├─────────────────┼──────────────────┼─────────────────┤
│ Photo           │ $0.02 - $0.08    │ 10-30 seconds   │
│ Restoration     │ per image        │                 │
├─────────────────┼──────────────────┼─────────────────┤
│ Photo           │ $0.03 - $0.10    │ 15-45 seconds   │
│ Colourization   │ per image        │                 │
├─────────────────┼──────────────────┼─────────────────┤
│ Combined        │ $0.04 - $0.12    │ 20-50 seconds   │
│ (Restore+Color) │ per image        │                 │
└─────────────────┴──────────────────┴─────────────────┘
```

**Post-MVP Features:**
```
┌─────────────────┬──────────────────┬─────────────────┐
│ Service Type    │ RunPod Cost      │ Processing Time │
├─────────────────┼──────────────────┼─────────────────┤
│ Animation       │ $0.15 - $0.60    │ 30-120 seconds  │
│ (Wan 2.2 T2V)   │ per video        │                 │
├─────────────────┼──────────────────┼─────────────────┤
│ Bring Together  │ $0.10 - $0.25    │ 45-90 seconds   │
│ (Qwen Edit 2509)│ per composite    │                 │
└─────────────────┴──────────────────┴─────────────────┘
```

### Infrastructure Overhead Costs

```
┌─────────────────────────┬─────────────────┬──────────────────────────────┐
│ Service                 │ Monthly Cost    │ Notes                        │
├─────────────────────────┼─────────────────┼──────────────────────────────┤
│ Database (PostgreSQL)   │ $25 - $100     │ AWS RDS, scales with usage   │
├─────────────────────────┼─────────────────┼──────────────────────────────┤
│ Redis Queue             │ $15 - $50      │ Job processing queue         │
├─────────────────────────┼─────────────────┼──────────────────────────────┤
│ S3 Storage              │ $0.023/GB/mo   │ + transfer costs             │
│ (User Photos)           │ $25 - $1,000   │ Scales with paid users       │
│ (10GB-200GB per user)   │                 │ (generous storage limits)    │
├─────────────────────────┼─────────────────┼──────────────────────────────┤
│ CDN (CloudFront)        │ $0.085/GB      │ First 10TB                   │
├─────────────────────────┼─────────────────┼──────────────────────────────┤
│ Authentication (Auth0)  │ $0 - $105       │ Free up to 7.5K MAUs         │
├─────────────────────────┼─────────────────┼──────────────────────────────┤
│ Monitoring & Analytics  │ $0 - $25        │ Basic logging (MVP)          │
├─────────────────────────┼─────────────────┼──────────────────────────────┤
│ Domain & SSL            │ $20             │ Basic hosting costs          │
└─────────────────────────┴─────────────────┴──────────────────────────────┘
```

### Cost Scenarios by Usage Volume

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Growth Stage    │ Early (100/mo)  │ Growth (1K/mo)  │ Scale (10K/mo)  │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Restorations    │ $10 - $25       │ $100 - $250     │ $1K - $2.5K     │
│ (500/5K/50K)    │                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Colorizations   │ $9 - $21        │ $90 - $210      │ $900 - $2.1K    │
│ (300/3K/30K)    │                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Storage Costs   │ $15 - $40       │ $150 - $400     │ $1.5K - $4K     │
│ (Generous)      │                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Infrastructure  │ $100 - $260     │ $460 - $1,040   │ $2.45K - $5.6K  │
│ (Other)         │                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ TOTAL MONTHLY   │ $134 - $346     │ $800 - $1,900   │ $6.35K - $14.2K │
│ (MVP + Storage) │                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Cost per User   │ $1.34 - $3.46   │ $0.80 - $1.90   │ $0.64 - $1.42   │
│ (MVP + Storage) │                 │                 │                 │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

---

## Competitive Analysis & Market Positioning

### Competitor Comparison

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Competitor      │ MyHeritage      │ Remini          │ Deep Nostalgia  │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Business Model  │ Subscription    │ Freemium        │ Pay-per-use     │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Pricing         │ $79-209/year    │ $4.99/week      │ $0.99-2.99     │
│                 │                 │ $19.99/month    │ per animation   │
│                 │                 │ $99.99/year     │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Features        │ Animation +     │ AI enhancement  │ Simple          │
│                 │ family tree +   │ + restoration   │ animation only  │
│                 │ restoration     │                 │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Market Position │ Premium family  │ Mobile-first    │ Single-purpose  │
│                 │ history service │ casual users    │ tool            │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### Our Competitive Advantage
- **Credit-Based Model:** Flexible subscription + top-up system
- **Emotional Branding:** Focus on family memories, not technology
- **Professional Quality:** High-quality AI processing at consumer prices
- **Cost Efficiency:** Competitive pricing with superior quality

---

## Recommended Pricing Structure

### Credit-Based Pricing Model

**Credit Costs (MVP Features):**
- **Restoration:** 2 credits per image
- **Colourization:** 3 credits per image
- **Combined (Restoration + Colourization):** 4 credits per image (1 credit discount)

**Credit Costs (Post-MVP Features):**
- **Animation:** 8 credits per video
- **Bring Together:** 6 credits per composite image

### Subscription Tiers

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Tier            │ "Try" (Free)    │ "Remember"      │ "Cherish"       │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Monthly Price   │ Free            │ $9.99/month     │ $19.99/month    │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Annual Price    │ Free            │ $95.90/year     │ $191.90/year    │
│                 │                 │ (20% discount)  │ (20% discount)  │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Monthly Credits │ 3 (trial)       │ 25 credits      │ 60 credits      │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Quality         │ 480p            │ 720p HD         │ 720p HD         │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Watermark       │ Small logo      │ None            │ None            │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Storage         │ 7-day expiry    │ 10GB permanent  │ 50GB permanent  │
│                 │                 │ (≈2,000 photos)│ (≈10,000 photos)│
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Processing      │ Standard queue  │ Priority        │ Priority        │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Target Audience │ Trial users     │ Casual users    │ Active families │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

```
┌─────────────────┬─────────────────┬─────────────────┐
│ Tier            │ "Forever"       │ Credit Top-ups  │
├─────────────────┼─────────────────┼─────────────────┤
│ Monthly Price   │ $39.99/month    │ One-time        │
├─────────────────┼─────────────────┼─────────────────┤
│ Annual Price    │ $383.90/year    │ One-time        │
│                 │ (20% discount)  │                 │
├─────────────────┼─────────────────┼─────────────────┤
│ Monthly Credits │ 150 credits     │ 10 - 100 credits│
├─────────────────┼─────────────────┼─────────────────┤
│ Quality         │ 720p HD         │ Based on tier   │
├─────────────────┼─────────────────┼─────────────────┤
│ Watermark       │ None            │ Based on tier   │
├─────────────────┼─────────────────┼─────────────────┤
│ Storage         │ 200GB permanent │ Based on tier   │
│                 │ (≈40,000 photos)│                 │
├─────────────────┼─────────────────┼─────────────────┤
│ Processing      │ Highest priority│ Based on tier   │
├─────────────────┼─────────────────┼─────────────────┤
│ Price Range     │ $39.99/month    │ $4.99 - $39.99 │
├─────────────────┼─────────────────┼─────────────────┤
│ Target Audience │ Power users     │ All tiers       │
└─────────────────┴─────────────────┴─────────────────┘
```

### Credit System Rules
- **Monthly subscription credits** reset each month and are used first
- **Top-up credits** carry over month-to-month and are used after subscription credits
- **Annual billing** offers 20% discount on all paid tiers
- **Credit top-ups** available from any tier for overflow demand

### Storage Management & Abuse Prevention

**Storage Limits by Tier:**
- **Free Tier:** 7-day expiry (no permanent storage)
- **Remember:** 10GB permanent storage (≈2,000 photos at 5MB each)
- **Cherish:** 50GB permanent storage (≈10,000 photos at 5MB each)  
- **Forever:** 200GB permanent storage (≈40,000 photos at 5MB each)

**Storage Abuse Prevention:**
- **Upload Requirements:** Users must process photos to store them permanently
- **Unprocessed Photos:** Auto-deleted after 7 days if no processing credits used
- **Storage Monitoring:** Alert users when approaching 80% of storage limit
- **Upgrade Prompts:** Suggest tier upgrade when storage limit reached
- **Fair Use Policy:** Prevent bulk uploads without processing intent

**Storage Cost Protection:**
- **S3 Storage Cost:** ~$0.023/GB/month (AWS S3 Standard)
- **Cost per User:** $0.23-$4.60/month storage cost per paid user
- **Revenue Protection:** Storage costs <5% of subscription revenue
- **Abuse Detection:** Monitor for users uploading without processing

**Detailed Storage Cost Analysis:**
```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Tier            │ Remember        │ Cherish         │ Forever         │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Storage Limit   │ 10GB            │ 50GB            │ 200GB           │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Monthly Cost    │ $0.23           │ $1.15           │ $4.60           │
│ (S3 Storage)    │                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Subscription    │ $9.99           │ $19.99          │ $39.99          │
│ Revenue         │                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Storage % of    │ 2.3%            │ 5.8%            │ 11.5%           │
│ Revenue         │                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Photos Stored   │ ~2,000          │ ~10,000         │ ~40,000         │
│ (5MB each)      │                 │                 │                 │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

**Cost Justification:**
- **Remember Tier:** $0.23/month storage cost vs $9.99 revenue (2.3% overhead)
- **Cherish Tier:** $1.15/month storage cost vs $19.99 revenue (5.8% overhead)  
- **Forever Tier:** $4.60/month storage cost vs $39.99 revenue (11.5% overhead)
- **User Experience:** Generous storage eliminates user concerns about limits
- **Competitive Advantage:** Much more storage than competitors at similar price points

---

## Revenue Projections & Business Model

### Conservative Growth Model

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Timeline        │ Month 1-3       │ Month 4-6       │ Month 7-12      │
│                 │ (Beta)          │ (Launch)        │ (Growth)        │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Active Users    │ 100             │ 1,000           │ 5,000           │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Conversion Rate │ 20%             │ 15%             │ 18%             │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ ARPU            │ $8              │ $12             │ $15             │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Monthly Revenue │ $160            │ $1,800          │ $13,500         │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ AI Processing   │ $30             │ $300            │ $1,500          │
│ Costs           │                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Storage Costs   │ $5              │ $50             │ $250            │
│ (Generous)      │                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Infrastructure  │ $100            │ $400            │ $1,200          │
│ (Other)         │                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Total Costs     │ $135            │ $750            │ $2,950          │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Net Profit      │ $25             │ $1,050          │ $10,550         │
│                 │ (break-even)    │                 │                 │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### Optimistic Growth Model (Strong Product-Market Fit)

```
┌─────────────────┬─────────────────┬─────────────────┐
│ Timeline        │ Month 4-6       │ Month 7-12      │
├─────────────────┼─────────────────┼─────────────────┤
│ Active Users    │ 3,000           │ 15,000          │
├─────────────────┼─────────────────┼─────────────────┤
│ Conversion Rate │ 25%             │ 28%             │
├─────────────────┼─────────────────┼─────────────────┤
│ ARPU            │ $16             │ $19             │
├─────────────────┼─────────────────┼─────────────────┤
│ Monthly Revenue │ $12,000         │ $79,800         │
├─────────────────┼─────────────────┼─────────────────┤
│ AI Processing   │ $1,500          │ $7,500          │
│ Costs           │                 │                 │
├─────────────────┼─────────────────┼─────────────────┤
│ Storage Costs   │ $300            │ $1,500          │
│ (Generous)      │                 │                 │
├─────────────────┼─────────────────┼─────────────────┤
│ Infrastructure  │ $1,200          │ $6,000          │
│ (Other)         │                 │                 │
├─────────────────┼─────────────────┼─────────────────┤
│ Total Costs     │ $3,000          │ $15,000         │
├─────────────────┼─────────────────┼─────────────────┤
│ Net Profit      │ $9,000          │ $64,800         │
└─────────────────┴─────────────────┴─────────────────┘
```

---

## Key Success Metrics & KPIs (MVP Focus)

### Account Metrics
- **Total User Accounts:** Total registered users across all tiers
- **User Tier Distribution:** 
  - Free tier users (active in last 30 days)
  - Paid tier users by subscription level (Remember/Cherish/Forever)

### Financial Metrics
- **Average Revenue Per User (ARPU):** Monthly revenue divided by active paid users
- **Profit Margin:** (Revenue - Total Costs) / Revenue × 100
- **Monthly Recurring Revenue (MRR):** Predictable monthly subscription revenue
- **Monthly Operational Costs:** Infrastructure + AI model costs + other operational expenses

---

## Implementation Priority for Analytics
**Phase 1 (MVP Launch):** Focus on core account and financial metrics only
**Phase 2 (Growth):** Add user engagement and processing quality metrics
**Phase 3 (Scale):** Expand to comprehensive business intelligence and predictive analytics

This simplified framework focuses on essential business metrics for MVP while maintaining the foundation for future expansion.

---

## Go-to-Market Strategy

### Phase 1: Closed Beta (Weeks 1-4)
- **Audience:** Friends, family, and personal networks
- **Goals:** Validate core functionality, measure engagement, test Phase 1 upload methods
- **Success Criteria:** 
  - 80%+ upload completion rate across all three methods (camera, gallery, desktop)
  - 50%+ sharing rate
  - Mobile camera capture works reliably for physical photos
  - Smart cropping improves photo quality measurably
- **Budget:** $0 (organic only)
- **Upload Focus:** Test mobile camera capture, gallery access, and drag & drop functionality

### Phase 2: Public Launch (Months 2-6)  
- **Audience:** Targeted Facebook/Instagram ads to 30-60 demographic
- **Goals:** Achieve product-market fit, optimize core features
- **Success Criteria:** 15%+ conversion rate, positive unit economics
- **Budget:** $5,000-10,000/month in paid acquisition

### Phase 3: Scale & Optimize (Months 6-12)
- **Audience:** Expand to additional demographics and geographies
- **Goals:** Optimize conversion funnels, reduce acquisition costs
- **Success Criteria:** $50K+ monthly revenue, 20%+ conversion rate
- **Budget:** Scale based on proven unit economics

---

## Risk Management & Mitigation

### Technical Risks
- **AI Service Outages:** Multi-provider fallback strategy (Replicate → RunPod)
- **Cost Overruns:** Real-time monitoring with automatic spending limits
- **Quality Issues:** Comprehensive testing pipeline and user feedback loops

### Business Risks  
- **Low Conversion:** A/B testing framework for pricing and features
- **High Churn:** Focus on emotional engagement and product quality
- **Competitive Pressure:** Differentiate through credit system flexibility and pricing

### Financial Controls
- **Daily Spending Limits:** Automatic shutoffs at budget thresholds
- **Queue Limits:** Maximum concurrent jobs to control costs  
- **Fraud Prevention:** Rate limiting and payment validation
- **Revenue Protection:** Stripe fraud detection and retry logic

---

This product and sales strategy aligns all technical decisions with our core mission of bringing family memories to life through accessible, shareable AI technology. Every architectural choice, pricing decision, and feature prioritization supports the emotional connection that drives our target market.