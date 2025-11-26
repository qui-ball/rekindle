# Authentication & Authorization - Requirements

## Document Info

**Created:** October 21, 2025  
**Status:** Approved  
**Decision:** Supabase Auth (50,000 MAU free tier)  
**Priority:** P0 - Critical for MVP launch

---

## Executive Summary

Implement user authentication and authorization system using Supabase Auth to enable:
- User registration and login (email/password + social)
- Session management with JWT tokens
- Tier-based access control (Free, Remember, Cherish, Forever)
- Credit-based feature gating
- User profile and account management

**Key Decision:** Supabase Auth selected for authentication
- **Reason:** 50,000 MAU free tier covers entire MVP phase ($0 cost)
- **Benefit:** Modern developer experience, built-in email template testing, lower cost at scale
- **Architecture:** Supabase Auth standalone (no database or storage migration required)

---

## Business Context

### Target Users
- **Primary:** 30-60 year old families
- **Needs:** Simple, trustworthy authentication
- **Expectations:** Social login options, familiar interfaces

### Business Model
- **Free Tier:** 3 trial credits, 480p quality, 7-day storage
- **Remember:** $9.99/mo, 25 credits, 720p, 10GB storage
- **Cherish:** $19.99/mo, 60 credits, 720p, 50GB storage
- **Forever:** $39.99/mo, 150 credits, 720p, 200GB storage

### Success Criteria
- 100% authentication success rate
- <2s sign-in/sign-up completion time
- 95%+ JWT verification success rate
- Zero critical security vulnerabilities
- 80%+ test coverage

---

## Functional Requirements

### FR-1: User Registration

**FR-1.1: Email/Password Registration**
- User can register with email and password
- Password must meet security requirements (8+ chars, mix of upper/lower/numbers)
- Email verification required before full access
- Auto-create user record in backend database
- Initialize with Free tier (3 credits)

**FR-1.2: Social Registration**
- User can register with Google account
- User can register with Facebook account
- User can register with Apple account
- Extract profile info (name, email, photo) from provider
- Auto-create user record in backend database
- Initialize with Free tier (3 credits)

**FR-1.3: Registration Validation**
- Email must be unique (no duplicates)
- Email format validation
- Password strength validation
- Display clear error messages for validation failures
- Prevent registration spam (rate limiting)

### FR-2: User Login

**FR-2.1: Email/Password Login**
- User can login with email and password
- Support "Remember me" functionality
- Display clear error for incorrect credentials
- Lock account after 5 failed attempts (Supabase handles)
- Support password reset flow

**FR-2.2: Social Login**
- User can login with Google
- User can login with Facebook
- User can login with Apple
- Link social accounts to existing email accounts
- Handle OAuth callback and token exchange

**FR-2.3: Session Management**
- Create JWT token on successful login (1-hour lifetime)
- Auto-refresh token before expiration
- Store session in secure httpOnly cookies
- Support multi-device sessions
- Provide "Sign out from all devices" option

### FR-3: User Profile Management

**FR-3.1: View Profile**
- Display user's email, name, profile photo
- Show subscription tier
- Show credit balance (monthly + topup)
- Show storage used/limit
- Show account creation date

**FR-3.2: Edit Profile**
- Update first name
- Update last name
- Update profile photo
- Change password (if email/password account)
- Update email (with re-verification)

**FR-3.3: Account Management**
- Request account deletion (30-day grace period)
- Export all user data (GDPR compliance)
- View active sessions
- Revoke individual sessions
- View login history (last 10 logins)

### FR-4: Authorization & Access Control

**FR-4.1: Tier-Based Permissions**
- Free tier: All features allowed (credit-gated), 480p max, watermark applied
- Remember tier: All features, 720p, no watermark
- Cherish tier: All features, 720p, batch upload enabled
- Forever tier: All features, 720p, API access enabled

**Note:** Credit availability determines feature usage, not tier restrictions. Free users can use animation if they have sufficient credits.

**FR-4.2: Feature Gating**
- Check tier before allowing tier-specific features (batch upload, API access)
- Show upgrade prompt for tier-locked features
- Display tier requirements clearly
- Gracefully handle permission errors with actionable messages

**FR-4.3: Quality & Branding Controls**
- Free tier: Maximum 480p output resolution
- Paid tiers: Maximum 720p output resolution
- Free tier: Apply small watermark to processed images
- Paid tiers: No watermark on processed images

**FR-4.4: Photo Storage Isolation**
- Every uploaded asset (raw, processed, thumbnails) must be tied to a single owning user ID.
- Users can only list, download, or delete assets where `user_id` matches their authenticated identity.
- Storage keys must follow a per-user namespace (`s3://rekindle-uploads/users/{user_id}/...`) to prevent collisions.
- Presigned URLs must embed ownership validation (server-side verification before issuance).
- Administrative tooling must support secure impersonation workflows without exposing other users’ assets.

### FR-5: Cross-Device Session Management

**FR-5.1: QR Code Upload Flow**
- Desktop user can generate QR code for mobile upload
- QR code contains one-time token (5-minute expiry)
- Mobile user scans QR code to open upload page

**IF mobile user already logged in (Supabase session exists):**
- Validate token and proceed to upload instantly (zero friction)

**IF mobile user NOT logged in:**
- Show "Confirm it's you" modal
- Prompt for biometric authentication (Face ID / Touch ID / Fingerprint)
- On biometric success: Create temporary session (1-hour lifetime)
- On biometric failure: Show error, allow retry (3 attempts)
- On biometric unavailable: Fallback to Supabase login flow
- After authentication: Validate token and proceed to upload

**General:**
- Upload on mobile is associated with desktop user's account
- Desktop receives real-time notification when upload completes
- Session expires after 1 hour of inactivity (for biometric-created sessions)

**FR-5.2: Biometric Authentication**
- Support Face ID (iOS/iPadOS)
- Support Touch ID (iOS/iPadOS/macOS)
- Support Android Fingerprint
- Support Android Face Unlock
- Support Android Iris Scanner (Samsung)
- Detect biometric capability on device
- Provide clear error messages if biometric fails
- Limit to 3 biometric attempts before fallback
- Log biometric authentication attempts (for security)

**FR-5.3: Session Linking**
- Generate one-time token linked to user session
- Store token-to-session mapping (Redis, 5-min TTL)
- Validate token on mobile device
- Ensure same user on both devices (security check)
- Clean up expired tokens automatically
- Prevent token reuse (mark as consumed after validation)

**FR-5.4: Cross-Device Notifications**
- Real-time upload status updates from mobile to desktop
- WebSocket connection or polling mechanism
- Desktop shows upload progress from mobile
- Handle connection drops gracefully

### FR-6: Password Management

**FR-6.1: Password Reset**
- User can request password reset via email
- Supabase sends reset link (valid 24 hours)
- User creates new password
- Invalidate all sessions after password change
- Send confirmation email

**FR-6.2: Password Change**
- User can change password from settings
- Require current password verification
- New password must meet strength requirements
- Invalidate other sessions after change
- Send notification email

### FR-7: Email Verification

**FR-7.1: Initial Verification**
- Send verification email on registration
- Provide "Resend verification" option
- Mark account as verified after confirmation
- Limit features until verified (Supabase handles)

**FR-7.2: Email Change Verification**
- Send verification to new email address
- Require confirmation before updating
- Keep old email until verified
- Notify both emails of change

### FR-8: Multi-Factor Authentication (Optional)

**FR-8.1: MFA Setup**
- User can enable MFA from settings
- Support authenticator app (TOTP)
- Support SMS (paid feature, later)
- Generate backup codes

**FR-8.2: MFA Login**
- Prompt for MFA code after password
- Allow use of backup codes
- Remember trusted devices (30 days)

---

## Non-Functional Requirements

### NFR-1: Security

**NFR-1.1: Data Protection**
- All communication over HTTPS/TLS 1.3
- Passwords hashed with bcrypt (Supabase handles)
- JWT tokens signed with RS256
- Session cookies: httpOnly, secure, sameSite=lax
- User data encrypted at rest (PostgreSQL)

**NFR-1.2: Authentication Security**
- Rate limiting: 5 requests/minute per IP (login attempts)
- Rate limiting: 10 requests/minute per user (API calls)
- Account lockout after 5 failed login attempts
- JWT token expires after 1 hour
- Refresh tokens expire after 30 days

**NFR-1.3: Authorization Security**
- Validate user permissions on every request
- Check tier eligibility before feature access
- Verify credit balance before deduction
- Prevent concurrent credit usage (race conditions)
- Log all permission denials

**NFR-1.4: Compliance**
- GDPR compliant (data export, deletion)
- Store only necessary user data
- Clear privacy policy and terms of service
- User consent for data processing
- Audit logs for sensitive operations

### NFR-2: Performance

**NFR-2.1: Response Times**
- Login/registration: <2 seconds
- JWT verification: <100ms
- Profile fetch: <200ms
- Permission check: <50ms

**NFR-2.2: Availability**
- 99.9% uptime (Supabase SLA)
- Graceful degradation if Supabase unavailable
- Queue authentication during outages
- Display clear status messages

**NFR-2.3: Scalability**
- Support 25,000 concurrent users (free tier limit)
- Handle 100 logins/second
- Database connections pooled
- JWT verification cached (1 hour)

### NFR-3: Usability

**NFR-3.1: User Experience**
- Simple, clear sign-up flow (<3 clicks)
- Social login prominently displayed
- Clear error messages in plain language
- Mobile-responsive design
- Loading states for all async operations

**NFR-3.2: Accessibility**
- WCAG 2.1 Level AA compliance
- Keyboard navigation support
- Screen reader friendly
- High contrast mode support
- Clear focus indicators

### NFR-4: Reliability

**NFR-4.1: Error Handling**
- Graceful handling of Supabase errors
- Retry logic for transient failures
- Fallback messaging when services unavailable
- User-friendly error messages
- Comprehensive error logging

**NFR-4.2: Data Consistency**
- User data synced between Supabase and backend
- Credit deductions are atomic
- Session state consistent across devices
- Handle race conditions in credit usage

### NFR-5: Maintainability

**NFR-5.1: Code Quality**
- 80%+ test coverage
- Type-safe (TypeScript, Python type hints)
- Clear separation of concerns
- Comprehensive documentation
- Consistent naming conventions

**NFR-5.2: Monitoring**
- Log all authentication events
- Track failed login attempts
- Monitor JWT verification failures
- Alert on unusual patterns
- Track Supabase API usage

---

## Technical Constraints

### TC-1: Authentication Provider
- **Must use:** Supabase Auth for authentication
- **Reason:** 50,000 MAU free tier, modern developer experience
- **Limitation:** Vendor lock-in, complex dashboard

### TC-2: Tech Stack
- **Frontend:** Next.js 14 with App Router
- **Backend:** FastAPI with Python 3.11+
- **Database:** PostgreSQL for user data
- **Session:** JWT tokens via Supabase Auth

### TC-3: Integration Points
- **Supabase APIs:** User management, authentication
- **Stripe:** Subscription and payment sync
- **Backend API:** User profile, credits, permissions
- **Frontend:** React components, hooks, middleware

### TC-4: Browser Support
- Chrome 90+
- Safari 14+
- Firefox 88+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## User Stories

### US-1: New User Registration
**As a** new user  
**I want to** create an account  
**So that** I can access photo restoration features

**Acceptance Criteria:**
- Can register with email/password
- Can register with Google/Facebook/Apple
- Receive email verification
- Auto-redirected to onboarding
- Start with 3 free credits

### US-2: Returning User Login
**As a** returning user  
**I want to** log into my account  
**So that** I can access my photos and credits

**Acceptance Criteria:**
- Can login with email/password
- Can login with social accounts
- Session persists across page refreshes
- See credit balance on dashboard
- Access all my previous photos

### US-3: Password Recovery
**As a** user who forgot password  
**I want to** reset my password  
**So that** I can regain access to my account

**Acceptance Criteria:**
- Request password reset via email
- Receive reset link within 5 minutes
- Create new secure password
- All other sessions invalidated
- Receive confirmation email

### US-4: Profile Management
**As a** logged-in user  
**I want to** update my profile  
**So that** my information is current

**Acceptance Criteria:**
- Update name and profile photo
- Change email address (with verification)
- Change password
- View account details
- See subscription status

### US-5: Feature Access Control
**As a** free tier user  
**I want to** understand feature limitations  
**So that** I know what I can access

**Acceptance Criteria:**
- Clearly see tier limitations
- Understand credit requirements
- See upgrade prompts for locked features
- Know current credit balance
- Understand what each tier includes

### US-6: Account Deletion
**As a** user  
**I want to** delete my account  
**So that** my data is removed

**Acceptance Criteria:**
- Request account deletion
- 30-day grace period to cancel
- Export data before deletion
- Receive confirmation email
- All data permanently removed after 30 days

---

## Integration Requirements

### INT-1: Supabase Auth Integration

**INT-1.1: Configuration**
- Set up Supabase project
- Configure social identity providers (Google, Facebook, Apple)
- Set up email templates (verification, password reset)
- Configure JWT token settings
- Set up webhook endpoints

**INT-1.2: Frontend Integration**
- Install `@supabase/supabase-js` SDK
- Create Supabase client instance
- Implement auth hooks and context
- Create sign-in/sign-up components
- Handle OAuth callbacks

**INT-1.3: Backend Integration**
- Verify JWT tokens from Supabase
- Validate token signatures
- Extract user ID from JWT
- Handle token expiration
- Sync users from Supabase webhooks

### INT-2: Backend API Integration

**INT-2.1: User Management**
- `POST /api/v1/users/sync` - Create user from Supabase
- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update user profile
- `DELETE /api/v1/users/me` - Request account deletion
- `GET /api/v1/users/me/export` - Export user data

**INT-2.2: Authentication**
- All API calls require `Authorization: Bearer <token>` header
- Backend verifies JWT on every request
- Extract user from token and inject into request
- Check user is active (not suspended/deleted)
- Update last_login_at timestamp

**INT-2.3: Webhooks**
- `POST /api/webhooks/supabase` - Handle Supabase events
  - `user.created` - Create user in database
  - `user.updated` - Update user in database
  - `user.deleted` - Mark user as deleted
  - `session.created` - Log session start
  - `session.ended` - Log session end

### INT-3: Cross-Device Session Integration

**INT-3.1: QR Code Token Service**
- `POST /api/v1/sessions/qr-token` - Generate one-time upload token
- `GET /api/v1/sessions/qr-token/:token` - Validate and consume token
- `POST /api/v1/sessions/biometric-auth` - Create temporary session after biometric
- `POST /api/v1/sessions/qr-link` - Link mobile upload to desktop session
- Redis storage for token-to-session mapping (5-minute TTL)
- Rate limiting: 5 QR tokens per hour per user

**INT-3.2: Biometric Authentication**
- Frontend uses Web Authentication API (WebAuthn)
- Fallback to Credential Management API
- Detect biometric capability: Face ID, Touch ID, Fingerprint
- On success: Send proof to backend
- Backend generates temporary JWT (1-hour expiry)
- Frontend stores temp JWT in sessionStorage (not localStorage)

**INT-3.3: Real-time Notifications**
- WebSocket connection for desktop session
- Publish upload events from mobile to desktop
- Handle connection drops and reconnection
- Fallback to polling if WebSocket unavailable

### INT-4: Stripe Integration

**INT-4.1: Subscription Sync**
- Update user tier on subscription change
- Reset monthly credits on billing cycle
- Handle subscription cancellation
- Sync payment status

---

## Data Requirements

### DR-1: User Data Storage

**DR-1.1: Required Fields**
- User ID (UUID, primary key)
- Supabase User ID (unique, indexed)
- Email (unique, indexed)
- Email verified (boolean)
- First name
- Last name
- Profile image URL

**DR-1.2: Subscription Fields**
- Subscription tier (enum: free, remember, cherish, forever)
- Monthly credits (integer)
- Topup credits (integer)
- Stripe customer ID
- Stripe subscription ID
- Subscription status (enum: active, cancelled, past_due, paused)
- Subscription period start/end

**DR-1.3: Storage Fields**
- Storage used (bytes)
- Storage limit (bytes)

**DR-1.4: Account Fields**
- Account status (enum: active, suspended, deleted)
- Deletion requested at (timestamp)
- Created at (timestamp)
- Updated at (timestamp)
- Last login at (timestamp)

### DR-2: Data Retention

**DR-2.1: Active Users**
- User data retained indefinitely while account active
- Login history: 90 days
- Session data: 30 days
- Audit logs: 1 year

**DR-2.2: Deleted Users**
- 30-day grace period before permanent deletion
- Data export available during grace period
- All data purged after grace period
- Anonymize audit logs (replace user ID)

---

## Security Requirements

### SEC-1: Authentication Security
- Passwords hashed with bcrypt (Supabase)
- JWT tokens signed with RS256
- Token expiration: 1 hour
- Refresh token rotation
- Rate limiting on login attempts

### SEC-2: Session Security
- HttpOnly cookies (prevent XSS)
- Secure flag (HTTPS only)
- SameSite=lax (CSRF protection)
- Session timeout after 7 days inactivity
- Maximum session duration: 30 days

### SEC-3: API Security
- All endpoints require authentication (except public)
- JWT verification on every request
- Rate limiting per user
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)

### SEC-4: Data Security
- Database encryption at rest
- HTTPS/TLS for all communication
- No sensitive data in logs
- Secure credential storage (environment variables)
- Regular security audits

### SEC-5: Biometric Authentication Security
- Use Web Authentication API (WebAuthn) where available
- Never store biometric data on server
- Biometric verification handled by device OS
- Generate temporary session token after biometric success
- Temporary sessions limited to 1 hour
- Log all biometric authentication attempts
- Rate limit QR token generation (5 per hour per user)
- QR tokens single-use only (consumed after validation)
- Validate user identity matches on both devices

---

## Testing Requirements

### TEST-1: Unit Tests (80% coverage)
- JWT token verification
- Permission checks (tier requirements)
- User CRUD operations
- Session management
- QR token generation and validation
- Biometric capability detection
- Temporary session creation

### TEST-2: Integration Tests
- Complete signup flow
- Complete login flow
- Social login flows
- Password reset flow
- User profile updates
- QR code generation and validation
- Cross-device session linking
- Real-time upload notifications

### TEST-3: Security Tests
- SQL injection attempts
- XSS attempts
- CSRF protection
- Rate limiting
- Token tampering
- Expired token handling

### TEST-4: E2E Tests (Optional for MVP)
- User registration journey
- Login and access dashboard
- Use features with tier restrictions
- QR code scan and biometric authentication
- Cross-device photo upload
- Account deletion

---

## Migration & Rollout

### Phase 1: Development (Week 1-2)
- Set up Supabase project
- Configure social providers
- Implement frontend auth flow
- Implement backend JWT verification
- Create user database schema
- Implement user sync

### Phase 2: Integration (Week 3)
- Implement tier-based permissions
- Add profile management
- Set up webhooks
- Implement QR code token service
- Add cross-device session linking
- Set up WebSocket/polling for notifications

### Phase 3: Security & Polish (Week 4-5)
- Rate limiting
- Security hardening
- Error handling
- User settings page
- Account deletion

### Phase 4: Testing (Week 5)
- Unit tests
- Integration tests
- Security testing
- Load testing
- User acceptance testing

### Phase 5: Production Launch
- Deploy to production
- Monitor authentication metrics
- Track error rates
- Gather user feedback

---

## Risks & Mitigations

### Risk 1: Supabase Outage
- **Impact:** Users cannot login
- **Probability:** Low (99.9% SLA)
- **Mitigation:** Queue requests, clear error messages, status page

### Risk 2: Supabase Cost Overrun
- **Impact:** Unexpected costs if exceeding 50K MAU
- **Probability:** Medium
- **Mitigation:** Monitor MAU daily, alerts at 45K, plan for upgrade

### Risk 3: Security Vulnerability
- **Impact:** User data breach
- **Probability:** Low (using Supabase)
- **Mitigation:** Regular security audits, penetration testing, monitoring

### Risk 4: Complex Setup
- **Impact:** Delayed launch
- **Probability:** Medium
- **Mitigation:** 5-7 day buffer, Supabase documentation, community support

### Risk 5: User Adoption
- **Impact:** Low signups
- **Probability:** Medium
- **Mitigation:** Prominent social login, simple flow, clear value prop

---

## Open Questions

1. ✅ **RESOLVED:** Supabase free tier limit? **Answer:** 50,000 MAU confirmed
2. **PENDING:** Should we implement MFA in MVP or defer to Phase 2?
3. **PENDING:** What login methods to prioritize? (Email first? Social first?)
4. **PENDING:** Account deletion: immediate or grace period? **Recommendation:** 30-day grace
5. **PENDING:** Session timeout: 7 days or 30 days inactivity?

---

## Success Metrics

### Authentication Metrics
- Signup conversion rate: >60%
- Login success rate: >95%
- Social login adoption: >40%
- Email verification rate: >80%
- Session duration: >15 minutes average

### Performance Metrics
- Login time: <2s (p95)
- JWT verification: <100ms (p95)
- API response time: <200ms (p95)
- Error rate: <1%

### Security Metrics
- Zero critical vulnerabilities
- Zero data breaches
- Failed login rate: <5%
- Account lockouts: <2%

---

## Appendix

### A. Supabase Configuration Checklist
- [ ] Create Supabase project
- [ ] Configure Google OAuth
- [ ] Configure Facebook OAuth
- [ ] Configure Apple OAuth
- [ ] Set up email templates (testable in dashboard)
- [ ] Configure JWT settings
- [ ] Set up webhook URLs
- [ ] Configure allowed callback URLs
- [ ] Configure allowed logout URLs
- [ ] Set session timeout
- [ ] Enable MFA (TOTP) if needed

### B. Environment Variables
```bash
# Frontend
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# Backend
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx  # Backend only, keep secret!
SUPABASE_WEBHOOK_SECRET=xxx
```

### C. Reference Documents
- Supabase Auth Documentation: https://supabase.com/docs/guides/auth
- Supabase JS Client: https://supabase.com/docs/reference/javascript/auth-api
- JWT Best Practices: https://tools.ietf.org/html/rfc8725
- OWASP Auth Cheatsheet: https://cheatsheetseries.owasp.org

---

**Document Status:** ✅ Approved  
**Last Updated:** October 21, 2025  
**Next Step:** Create designs.md

