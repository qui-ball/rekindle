MVP Game Plan – Photo Restore & Animate Service

1. Vision & Value Proposition
Tagline: “Bring your memories to life.”
Core idea: Upload old photos → restore and/or animate → download or share results.
Positioning: Emotional, magical, nostalgic — not “AI techy.”
Target audience: Casual users (30–60 y/o), especially families with baby/wedding photos.
MVP hook: Animation = “wow factor” + viral engine.



2. User Flow (MVP)
Landing Page
Emotional branding (“Bring your memories to life ✨”).
Demo examples (baby/wedding photos).
Prominent CTA at top & bottom.


Upload Flow
Upload photo via browser.
Option: “Auto-restore before animating” (default ON).
Submit → job queued.


Processing
Backend resizes photo.
Runs Restore + Animate pipeline.
Free: low-res, bold watermark ( maybe L40s)
Paid: HD/(4K?), no watermark, priority => spin up on demand any time, even H200s


Delivery
Result emailed with link.
Free: no ETA. Paid: ETA?
Maybe not so useful


Share Page
Video playback.
For other users:
Emotional CTA: “Bring your memories to life — Try it yourself.”
Share buttons: Facebook, WhatsApp, Messenger, Email.
Download option.



3. Monetization & Pricing
Free users:
1 free trial (low-res, watermarked).
Shareable link.


Paid tiers (3, emotional names):
Remember (entry).
Cherish (middle, sweet spot).
Forever (premium).


Differentiation by usage, resolution, watermark, and queue priority.

4. Cost & Abuse Controls
1 free trial per email/IP/device.
One retry per upload.
Storage: delete raw uploads after processing; expire free outputs after 7–14 days.
Strong translucent watermark (animated to prevent easy removal) + nice frame
Only generate MP4/WebM for MVP.



5. Architecture (Minimal Survivable)
Frontend: React (Native) / SPA web app.
Backend: FastAPI (Python? Maybe Node) for presigned uploads, job queueing, billing, email triggers.
Storage/CDN: S3 + CloudFront with signed URLs.
Queue (for free tier): Redis/Rabbit/SQS with priority lanes.
GPU Workers: Cloud autoscaling pods for restore + animate (RunPod)
Email: Postmark/SendGrid/SES.
DB: Postgres for users, jobs, billing.
Analytics: PostHog/Mixpanel.
Monitoring: Basic logs + alerts (uptime, queue depth, GPU utilization).



6. Launch Plan
Closed Beta (Weeks): friends/family + demo content; measure engagement and sharing.
Public Launch (Months): polished branding, subscriptions, ad spend + targeted outreach.



7. Success Metrics (for Public Launch)
Acquisition: % of visitors uploading photos.
Creating accounts as well
Engagement: % of uploads completed + previewed.
Virality: % of results shared.
Also track how many people who clicked on a shared link
Conversion: Free → Paid.
Retention: How many months users stay subscribed



8. Legal & Trust
Basic Privacy Policy + Terms from launch.
Commitments:
Photos auto-deleted after X days (except for paid storage).
User retains ownership.
Links are unlisted but accessible by anyone with the link (for free users)

9. Key Decisions (Q&A Log)
Target audience → Casual users, not professionals.
 Primary use case → Both restore & animate, but animation = MVP hook.
 Customization → Sensible defaults with light options.
 Output → Download + shareable link (social integrations later).
 Monetization → Charge from day one (GPU expensive).
 Free trial → One free try; bold animated watermark; preview-only resolution.
 Pricing model → Subscription, 3 emotional tiers; middle optimized for conversion.
 Trust/privacy → Public-by-link sharing at launch; private links later.
 Brand → Emotional/story-first, not techy.
 Launch geo → English-only.
 Experience design → One-shot (no accounts for MVP); emotional CTA below video.
 Storage → Resize uploads; delete raws after processing; free outputs expire.
 Queue model → Priority (paid fast lane) vs. free queue; email-only notifications.
 Abuse controls → Email + IP/device rate limits; accept some abuse at MVP.
 Analytics → 3rd-party (PostHog/Mixpanel).
 Scaling philosophy → “Production-ready enough” (survivable virality without overbuilding).
 Launch plan → Scrappy beta (weeks) → polished public (months).
