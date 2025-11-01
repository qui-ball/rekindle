# Authentication & Authorization - Implementation Tasks

## Document Info

**Created:** October 21, 2025  
**Status:** Ready for implementation  
**Related:** requirements.md, designs.md  
**Timeline:** 6-7 weeks

---

## Task Overview

### Phase Summary

| Phase | Duration | Tasks | Status |
|-------|----------|-------|--------|
| Phase 1: Auth0 Setup | Week 1 | 8 tasks | Not Started |
| Phase 2: Frontend Auth | Week 2 | 10 tasks | Not Started |
| Phase 3: Backend Auth | Week 2-3 | 12 tasks | Not Started |
| Phase 4: User Management | Week 3-4 | 11 tasks | Not Started |
| Phase 5: Cross-Device & Biometric | Week 4 | 9 tasks | Not Started |
| Phase 6: Authorization | Week 5 | 9 tasks | Not Started |
| Phase 7: Testing & Security | Week 6-7 | 8 tasks | Not Started |

**Total Tasks:** 67  
**Frontend Tasks:** 28  
**Backend Tasks:** 30  
**Infrastructure Tasks:** 9

---

## Phase 1: Auth0 Setup & Configuration
**Duration:** Week 1 (3-5 days)  
**Dependencies:** None

### Task 1.1: Create Auth0 Tenant
**Type:** Infrastructure  
**Priority:** P0  
**Estimated Time:** 2 hours  
**Status:** ✅ COMPLETED

**Description:**
Set up Auth0 account and create tenant with development and production applications.

**Note:** Free tier allows only 1 tenant (25,000 MAU total). Using single-tenant, multiple-application strategy:
- Single tenant for both dev and prod
- Separate applications for environment isolation
- Callback URLs differentiate environments

**Subtasks:**
- [x] Create Auth0 account at auth0.com
- [x] Development tenant auto-created (e.g., `dev-xxxxx.us.auth0.com`)
- [x] Choose region (US - auto-selected)
- [x] Note down tenant domain
- [x] Take screenshot of tenant dashboard
- [x] Verify free tier limits (25,000 MAU, 1 tenant limit confirmed)
- [x] Create "Rekindle Development" application (Regular Web App)
- [x] Create "Rekindle Production" application (Regular Web App)
- [x] Document Client IDs and Secrets for both applications
- [x] Configure Grant Types (Authorization Code, Refresh Token)

**Acceptance Criteria:**
- ✅ Auth0 tenant created and accessible
- ✅ Tenant domain confirmed
- ✅ Free tier limits verified (25,000 MAU, 1 tenant on free tier)
- ✅ Development application created with credentials documented
- ✅ Production application created with credentials documented
- ✅ Single-tenant strategy documented

**Environment Strategy:**
```
Tenant: [your-tenant].us.auth0.com (shared)
├── App 1: Rekindle Development → localhost:3000
└── App 2: Rekindle Production → rekindle.app
```

**Resources:**
- Auth0 Docs: https://auth0.com/docs/get-started/auth0-overview/create-tenants
- Applications: https://auth0.com/docs/get-started/applications

---

### Task 1.2: Configure Social Identity Providers (Google Only - MVP)
**Type:** Infrastructure  
**Priority:** P0  
**Estimated Time:** 1 hour (reduced from 3 hours)  
**Status:** In Progress

**Description:**
Set up Google OAuth for "Continue with Google" functionality. Facebook and Apple Sign In deferred to post-launch.

**MVP Decision:** 
- ✅ **Google OAuth** - Primary social login for MVP
- ⏭️ **Facebook** - Deferred to post-launch (Task 1.2b)
- ⏭️ **Apple Sign In** - Deferred to post-launch (Task 1.2c)

**Important Notes:**
- Auth0 Callback URL: `https://[your-tenant].us.auth0.com/login/callback`
- Configure at tenant level (shared across both Dev and Prod applications)
- Enable for both "Rekindle Development" and "Rekindle Production" applications
- Start with Auth0 dev keys for speed, upgrade to own OAuth app before production launch

**Subtasks:**
- [ ] Enable Google OAuth in Auth0
  - [ ] Navigate to Authentication → Social in Auth0 Dashboard
  - [ ] Select "Google / Gmail" connection
  - [ ] Option A: Use Auth0 developer keys (quick setup - shows "Unverified App")
  - [ ] Enable for both "Rekindle Development" and "Rekindle Production" applications
  - [ ] Test connection with "Try Connection" button
  - [ ] Verify email retrieved successfully
- [ ] Document credentials and setup
- [ ] (Optional) Create production Google OAuth app:
  - [ ] Create Google Cloud Project
  - [ ] Configure OAuth consent screen
  - [ ] Create OAuth Client ID
  - [ ] Add callback URL: `https://[your-tenant].us.auth0.com/login/callback`
  - [ ] Replace Auth0 dev keys with your own credentials
  - [ ] Test connection again

**Acceptance Criteria:**
- ✅ Google OAuth configured and active in Auth0 Dashboard
- ✅ Test login successful (can use Auth0 dev keys for now)
- ✅ Auth0 callback URL correctly set
- ✅ User email retrieved from Google
- ✅ Both Development and Production applications enabled for Google
- ✅ Connection shows "Active" status in Auth0

**Deferred to Post-Launch:**
- Facebook Login (Task 1.2b)
- Apple Sign In (Task 1.2c)

**Resources:**
- Google: https://auth0.com/docs/connections/social/google
- Google Cloud Console: https://console.cloud.google.com/ (for production OAuth app)

---

### Task 1.3: Configure Email Templates
**Type:** Infrastructure  
**Priority:** P1  
**Estimated Time:** 2 hours

**Description:**
Customize Auth0 email templates for verification and password reset.

**Subtasks:**
- [ ] Navigate to Branding > Email Templates
- [ ] Customize "Verification Email" template
  - Update subject line
  - Update email body
  - Add Rekindle branding
  - Test with real email
- [ ] Customize "Change Password" template
  - Update subject line
  - Update email body
  - Add Rekindle branding
  - Test with real email
- [ ] Customize "Welcome Email" template (optional)
- [ ] Configure "From" email address
- [ ] Set up custom email provider (optional, SendGrid/AWS SES)

**Acceptance Criteria:**
- Email templates branded with Rekindle look and feel
- Test emails received successfully
- All links work correctly
- Email deliverability tested

---

### Task 1.4: Configure Universal Login
**Type:** Infrastructure  
**Priority:** P1  
**Estimated Time:** 2 hours

**Description:**
Customize Auth0 Universal Login page to match Rekindle branding.

**Subtasks:**
- [ ] Navigate to Branding > Universal Login
- [ ] Choose "New Universal Login Experience"
- [ ] Customize colors (primary, background)
- [ ] Upload Rekindle logo
- [ ] Customize page layout
- [ ] Add "Remember me" checkbox
- [ ] Test login page appearance
- [ ] Test on mobile devices

**Acceptance Criteria:**
- Login page matches Rekindle brand
- Mobile responsive
- All social login buttons visible
- Clear error messages

---

### Task 1.5: Configure JWT Settings
**Type:** Infrastructure  
**Priority:** P0  
**Estimated Time:** 1 hour

**Description:**
Configure JWT token settings for API authentication.

**Subtasks:**
- [ ] Navigate to Applications > APIs
- [ ] Create API: "Rekindle Backend API"
- [ ] Set identifier: `https://api.rekindle.app`
- [ ] Configure token expiration: 1 hour
- [ ] Enable RS256 signing algorithm
- [ ] Add custom claims (if needed)
- [ ] Test JWT generation
- [ ] Download JWKS for verification

**Acceptance Criteria:**
- API created in Auth0
- JWT tokens generated with correct audience
- Token expiration set to 1 hour
- JWKS URL accessible

---

### Task 1.6: Set Up Webhooks
**Type:** Infrastructure  
**Priority:** P1  
**Estimated Time:** 1 hour

**Description:**
Configure Auth0 webhooks to sync user events to backend.

**Subtasks:**
- [ ] Navigate to Monitoring > Streams
- [ ] Create new webhook stream
- [ ] Set endpoint: `https://api.rekindle.app/api/webhooks/auth0`
- [ ] Select events to subscribe:
  - user.created
  - user.updated
  - user.deleted
  - session.created (optional)
  - session.ended (optional)
- [ ] Generate webhook secret
- [ ] Save webhook secret to environment variables
- [ ] Test webhook delivery (once backend is ready)

**Acceptance Criteria:**
- Webhook stream configured
- Correct events subscribed
- Webhook secret generated and stored
- Endpoint URL set correctly

---

### Task 1.7: Configure Security Settings
**Type:** Infrastructure  
**Priority:** P0  
**Estimated Time:** 2 hours

**Description:**
Configure security settings including brute force protection and MFA.

**Subtasks:**
- [ ] Navigate to Security > Attack Protection
- [ ] Enable Brute Force Protection
  - Set max attempts: 5
  - Set block duration: 15 minutes
- [ ] Enable Breached Password Detection (free tier)
- [ ] Configure MFA (optional for MVP)
  - Enable authenticator apps
  - Enable SMS (paid, later)
  - Generate backup codes
- [ ] Set session timeouts:
  - Inactivity timeout: 7 days
  - Absolute timeout: 30 days
- [ ] Review and accept Auth0 security recommendations

**Acceptance Criteria:**
- Brute force protection enabled
- Account lockout after 5 failed attempts
- Breached passwords blocked
- Session timeouts configured

---

### Task 1.8: Configure Allowed URLs
**Type:** Infrastructure  
**Priority:** P0  
**Estimated Time:** 30 minutes

**Description:**
Configure allowed callback URLs, logout URLs, and web origins.

**Subtasks:**
- [ ] Navigate to Applications > Rekindle App
- [ ] Add Allowed Callback URLs:
  - http://localhost:3000/api/auth/callback (dev)
  - https://rekindle.app/api/auth/callback (prod)
- [ ] Add Allowed Logout URLs:
  - http://localhost:3000 (dev)
  - https://rekindle.app (prod)
- [ ] Add Allowed Web Origins:
  - http://localhost:3000 (dev)
  - https://rekindle.app (prod)
- [ ] Save settings
- [ ] Test redirect flows

**Acceptance Criteria:**
- All URLs configured correctly
- Dev and prod environments work
- Redirects function properly
- CORS errors resolved

---

## Phase 2: Frontend Authentication Implementation
**Duration:** Week 2 (5 days)  
**Dependencies:** Phase 1 complete

### Task 2.1: Install Auth0 Next.js SDK
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 30 minutes

**Description:**
Install and configure Auth0 Next.js SDK in frontend.

**Subtasks:**
- [ ] Install package: `npm install @auth0/nextjs-auth0`
- [ ] Create `.env.local` with Auth0 credentials
- [ ] Add environment variables:
  - AUTH0_SECRET
  - AUTH0_BASE_URL
  - AUTH0_ISSUER_BASE_URL
  - AUTH0_CLIENT_ID
  - AUTH0_CLIENT_SECRET
- [ ] Create `app/api/auth/[auth0]/route.ts`
- [ ] Export handleAuth()

**Acceptance Criteria:**
- Package installed successfully
- Environment variables set
- Auth0 API routes working
- No build errors

**Files to Create:**
- `frontend/.env.local`
- `frontend/app/api/auth/[auth0]/route.ts`

---

### Task 2.2: Set Up UserProvider
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 1 hour

**Description:**
Wrap application with Auth0 UserProvider.

**Subtasks:**
- [ ] Update `app/layout.tsx`
- [ ] Import and wrap with `<UserProvider>`
- [ ] Test user context accessibility
- [ ] Handle loading states
- [ ] Handle error states

**Acceptance Criteria:**
- UserProvider wraps entire app
- User context accessible in all components
- Loading states handled gracefully

**Files to Modify:**
- `frontend/app/layout.tsx`

---

### Task 2.3: Create Sign-In Page
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 3 hours

**Description:**
Create branded sign-in page with social login options.

**Subtasks:**
- [ ] Create `app/sign-in/page.tsx`
- [ ] Add "Sign In" heading
- [ ] Add email/password form (redirects to Auth0)
- [ ] Add social login buttons (Google, Facebook, Apple)
- [ ] Add "Don't have an account?" link to sign-up
- [ ] Add "Forgot password?" link
- [ ] Style to match Rekindle brand
- [ ] Make mobile responsive
- [ ] Add loading states
- [ ] Test all login methods

**Acceptance Criteria:**
- Sign-in page branded and styled
- All login methods work
- Mobile responsive
- Clear error messages
- Links to sign-up and password reset

**Files to Create:**
- `frontend/app/sign-in/page.tsx`

---

### Task 2.4: Create Sign-Up Page
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 3 hours

**Description:**
Create branded sign-up page with social registration options.

**Subtasks:**
- [ ] Create `app/sign-up/page.tsx`
- [ ] Add "Get Started Free" heading
- [ ] Add "3 free credits" value proposition
- [ ] Add email/password form (redirects to Auth0)
- [ ] Add social signup buttons
- [ ] Add "Already have an account?" link
- [ ] Add terms of service checkbox
- [ ] Style to match Rekindle brand
- [ ] Make mobile responsive
- [ ] Test all signup methods

**Acceptance Criteria:**
- Sign-up page branded and styled
- All signup methods work
- Mobile responsive
- Clear value proposition
- Terms of service linked

**Files to Create:**
- `frontend/app/sign-up/page.tsx`

---

### Task 2.5: Implement Protected Routes Middleware
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 2 hours

**Description:**
Create middleware to protect authenticated routes.

**Subtasks:**
- [ ] Create `middleware.ts`
- [ ] Import `withMiddlewareAuthRequired` from Auth0
- [ ] Define protected route patterns:
  - /dashboard/*
  - /photos/*
  - /settings/*
- [ ] Add redirect to /sign-in if unauthenticated
- [ ] Test protection on all routes
- [ ] Handle loading states
- [ ] Add public routes exception

**Acceptance Criteria:**
- Unauthenticated users redirected to sign-in
- Protected routes accessible after login
- Public routes work without auth
- Smooth redirect experience

**Files to Create:**
- `frontend/middleware.ts`

---

### Task 2.6: Create useCurrentUser Hook
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 2 hours

**Description:**
Create hook to fetch and manage current user data from backend.

**Subtasks:**
- [ ] Create `hooks/useCurrentUser.ts`
- [ ] Use Auth0's `useUser()` hook
- [ ] Fetch user profile from backend API
- [ ] Handle loading state
- [ ] Handle error state
- [ ] Cache user data
- [ ] Provide refresh function
- [ ] Add TypeScript types

**Acceptance Criteria:**
- Hook returns current user data
- Loading and error states handled
- User data cached appropriately
- TypeScript types defined

**Files to Create:**
- `frontend/src/hooks/useCurrentUser.ts`

---

### Task 2.7: Create User Profile Component
**Type:** Frontend  
**Priority:** P1  
**Estimated Time:** 3 hours

**Description:**
Create component to display user profile information.

**Subtasks:**
- [ ] Create `components/UserProfile.tsx`
- [ ] Display user email
- [ ] Display user name
- [ ] Display profile photo
- [ ] Display subscription tier
- [ ] Display credit balance
- [ ] Display storage used/limit
- [ ] Add "Edit Profile" button
- [ ] Style component
- [ ] Make responsive

**Acceptance Criteria:**
- Profile displays all user information
- Credit balance prominently shown
- Tier displayed with badge/icon
- Responsive design

**Files to Create:**
- `frontend/src/components/UserProfile.tsx`

---

### Task 2.8: Create User Settings Page
**Type:** Frontend  
**Priority:** P1  
**Estimated Time:** 4 hours

**Description:**
Create page for users to manage account settings.

**Subtasks:**
- [ ] Create `app/settings/page.tsx`
- [ ] Add tabs: Profile, Security, Subscription, Sessions
- [ ] Profile tab:
  - Edit name
  - Change email
  - Update profile photo
- [ ] Security tab:
  - Change password
  - Enable MFA (if implemented)
  - View login history
- [ ] Sessions tab:
  - View active sessions
  - Revoke sessions
- [ ] Account tab:
  - Export data
  - Delete account
- [ ] Style and make responsive

**Acceptance Criteria:**
- All tabs functional
- Forms validate input
- Changes saved successfully
- Confirmations shown for actions

**Files to Create:**
- `frontend/app/settings/page.tsx`
- `frontend/src/components/settings/*.tsx`

---

### Task 2.9: Create Sign-Out Functionality
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 1 hour

**Description:**
Implement sign-out functionality throughout the app.

**Subtasks:**
- [ ] Create sign-out button component
- [ ] Add sign-out to user menu/dropdown
- [ ] Call Auth0 logout endpoint
- [ ] Clear local user state
- [ ] Redirect to homepage
- [ ] Add confirmation modal (optional)
- [ ] Test sign-out flow

**Acceptance Criteria:**
- Sign-out button accessible from all pages
- Logout successful
- User redirected appropriately
- Session cleared

**Files to Create:**
- `frontend/src/components/SignOutButton.tsx`

---

### Task 2.10: Create API Client with Auth
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 2 hours

**Description:**
Create API client that automatically includes JWT tokens.

**Subtasks:**
- [ ] Create `services/apiClient.ts`
- [ ] Configure base URL from environment
- [ ] Add request interceptor to include JWT
- [ ] Add response interceptor for error handling
- [ ] Handle 401 errors (redirect to login)
- [ ] Handle 403 errors (show upgrade modal)
- [ ] Handle 402 errors (show buy credits)
- [ ] Add retry logic for transient errors
- [ ] Add TypeScript types

**Acceptance Criteria:**
- API client includes JWT automatically
- Error handling comprehensive
- Redirects work correctly
- TypeScript types defined

**Files to Create:**
- `frontend/src/services/apiClient.ts`

---

## Phase 3: Backend Authentication Implementation
**Duration:** Week 2-3 (5-7 days)  
**Dependencies:** Phase 1 complete

### Task 3.1: Create User Model
**Type:** Backend  
**Priority:** P0  
**Estimated Time:** 2 hours

**Description:**
Create SQLAlchemy User model with all required fields.

**Subtasks:**
- [ ] Create `app/models/user.py`
- [ ] Define User class with all fields (see designs.md)
- [ ] Add table constraints and checks
- [ ] Add computed properties (total_credits, full_name, etc.)
- [ ] Add indexes
- [ ] Add __repr__ method
- [ ] Add type hints

**Acceptance Criteria:**
- User model matches database schema
- All constraints defined
- Properties work correctly
- Type hints added

**Files to Create:**
- `backend/app/models/user.py`

---

### Task 3.2: Create Database Migration
**Type:** Backend  
**Priority:** P0  
**Estimated Time:** 1 hour

**Description:**
Create Alembic migration for users table.

**Subtasks:**
- [ ] Generate migration: `alembic revision --autogenerate -m "create_users_table"`
- [ ] Review generated migration
- [ ] Add custom indexes if needed
- [ ] Add triggers (updated_at)
- [ ] Test migration up
- [ ] Test migration down
- [ ] Commit migration file

**Acceptance Criteria:**
- Migration creates users table correctly
- All indexes created
- Triggers work
- Migration reversible

**Files to Create:**
- `backend/migrations/versions/XXX_create_users_table.py`

---

### Task 3.3: Create User Schemas
**Type:** Backend  
**Priority:** P0  
**Estimated Time:** 2 hours

**Description:**
Create Pydantic schemas for user operations.

**Subtasks:**
- [ ] Create `app/schemas/user.py`
- [ ] Define UserSyncRequest schema
- [ ] Define UserUpdateRequest schema
- [ ] Define UserResponse schema
- [ ] Add validators (name format, etc.)
- [ ] Add field descriptions
- [ ] Add examples
- [ ] Add type hints

**Acceptance Criteria:**
- All schemas defined
- Validation works correctly
- Type hints complete
- Documentation clear

**Files to Create:**
- `backend/app/schemas/user.py`

---

### Task 3.4: Implement JWT Verification
**Type:** Backend  
**Priority:** P0  
**Estimated Time:** 3 hours

**Description:**
Implement JWT token verification middleware.

**Subtasks:**
- [ ] Update `app/api/deps.py`
- [ ] Implement `get_current_user()` function
- [ ] Verify JWT signature using Auth0 JWKS
- [ ] Extract auth0_user_id from token
- [ ] Fetch user from database
- [ ] Check account status (active)
- [ ] Update last_login_at
- [ ] Handle token expiration
- [ ] Handle invalid tokens
- [ ] Add comprehensive error handling
- [ ] Add type hints

**Acceptance Criteria:**
- Valid JWTs accepted
- Invalid JWTs rejected with 401
- User fetched from database
- Last login timestamp updated
- Error messages clear

**Files to Modify:**
- `backend/app/api/deps.py`

---

### Task 3.5: Create User Sync Endpoint
**Type:** Backend  
**Priority:** P0  
**Estimated Time:** 2 hours

**Description:**
Create endpoint to sync users from Auth0 to backend.

**Subtasks:**
- [ ] Create `app/api/v1/users.py`
- [ ] Implement POST `/users/sync`
- [ ] Accept UserSyncRequest
- [ ] Check if user already exists
- [ ] Create new user if not exists
- [ ] Initialize with free tier (3 credits)
- [ ] Set storage limits based on tier
- [ ] Return user profile
- [ ] Handle duplicate errors
- [ ] Add logging

**Acceptance Criteria:**
- Endpoint creates users successfully
- Duplicates handled gracefully
- Free tier initialized correctly
- Returns complete user profile

**Files to Create:**
- `backend/app/api/v1/users.py`

---

### Task 3.6: Create Get Current User Endpoint
**Type:** Backend  
**Priority:** P0  
**Estimated Time:** 1 hour

**Description:**
Create endpoint to get current authenticated user's profile.

**Subtasks:**
- [ ] Implement GET `/users/me`
- [ ] Require authentication
- [ ] Return UserResponse schema
- [ ] Include computed fields (total_credits, storage_percentage)
- [ ] Test with various user tiers
- [ ] Add API documentation

**Acceptance Criteria:**
- Endpoint returns complete user profile
- Authentication required
- Computed fields correct
- API docs complete

**Files to Modify:**
- `backend/app/api/v1/users.py`

---

### Task 3.7: Create Update User Endpoint
**Type:** Backend  
**Priority:** P1  
**Estimated Time:** 2 hours

**Description:**
Create endpoint to update user profile.

**Subtasks:**
- [ ] Implement PUT `/users/me`
- [ ] Accept UserUpdateRequest
- [ ] Validate input (name format)
- [ ] Update user in database
- [ ] Return updated UserResponse
- [ ] Handle validation errors
- [ ] Add logging
- [ ] Test with various inputs

**Acceptance Criteria:**
- Profile updates successfully
- Validation works correctly
- Invalid input rejected
- Returns updated profile

**Files to Modify:**
- `backend/app/api/v1/users.py`

---

### Task 3.8: Create Delete Account Endpoint
**Type:** Backend  
**Priority:** P1  
**Estimated Time:** 2 hours

**Description:**
Create endpoint to request account deletion (30-day grace period).

**Subtasks:**
- [ ] Implement DELETE `/users/me`
- [ ] Set deletion_requested_at timestamp
- [ ] Send confirmation email
- [ ] Return success message
- [ ] Schedule deletion job (30 days later)
- [ ] Add cancellation endpoint (optional)
- [ ] Test deletion flow

**Acceptance Criteria:**
- Deletion request recorded
- 30-day grace period implemented
- Email sent
- Can be cancelled (optional)

**Files to Modify:**
- `backend/app/api/v1/users.py`

---

### Task 3.9: Create Export Data Endpoint
**Type:** Backend  
**Priority:** P1  
**Estimated Time:** 3 hours

**Description:**
Create endpoint to export all user data (GDPR compliance).

**Subtasks:**
- [ ] Implement GET `/users/me/export`
- [ ] Collect user profile data
- [ ] Collect all photos data
- [ ] Collect all processing jobs
- [ ] Collect all payment history
- [ ] Format as JSON
- [ ] Generate downloadable file
- [ ] Add data export logging
- [ ] Test with various user data

**Acceptance Criteria:**
- All user data exported
- JSON format valid
- File downloadable
- GDPR compliant

**Files to Modify:**
- `backend/app/api/v1/users.py`

---

### Task 3.10: Create Auth0 Webhook Handler
**Type:** Backend  
**Priority:** P1  
**Estimated Time:** 3 hours

**Description:**
Create webhook endpoint to handle Auth0 events.

**Subtasks:**
- [ ] Create `app/api/webhooks/auth0.py`
- [ ] Implement POST `/webhooks/auth0`
- [ ] Verify webhook signature
- [ ] Handle user.created event
- [ ] Handle user.updated event
- [ ] Handle user.deleted event
- [ ] Add comprehensive logging
- [ ] Test with sample payloads
- [ ] Handle errors gracefully

**Acceptance Criteria:**
- Webhook signature verified
- All events handled correctly
- User data synced properly
- Errors logged and handled

**Files to Create:**
- `backend/app/api/webhooks/auth0.py`

---

### Task 3.11: Add Rate Limiting
**Type:** Backend  
**Priority:** P1  
**Estimated Time:** 2 hours

**Description:**
Add rate limiting to protect authentication endpoints.

**Subtasks:**
- [ ] Install slowapi: `pip install slowapi`
- [ ] Configure limiter in main app
- [ ] Add rate limits to /users/sync (5/minute)
- [ ] Add rate limits to /users/me (60/minute)
- [ ] Add rate limits to webhooks (100/minute)
- [ ] Return 429 Too Many Requests
- [ ] Test rate limiting
- [ ] Add to documentation

**Acceptance Criteria:**
- Rate limiting active on all endpoints
- 429 status returned when exceeded
- Different limits per endpoint
- Does not block legitimate usage

**Files to Modify:**
- `backend/app/main.py`
- `backend/app/api/v1/users.py`
- `backend/app/api/webhooks/auth0.py`

---

### Task 3.12: Add Authentication Logging
**Type:** Backend  
**Priority:** P1  
**Estimated Time:** 2 hours

**Description:**
Add comprehensive logging for authentication events.

**Subtasks:**
- [ ] Log all login attempts
- [ ] Log all JWT verification failures
- [ ] Log all permission denials
- [ ] Log all rate limit hits
- [ ] Log user creation
- [ ] Log user updates
- [ ] Log user deletions
- [ ] Add log levels appropriately
- [ ] Test logging output

**Acceptance Criteria:**
- All auth events logged
- Log levels appropriate
- No sensitive data in logs
- Logs structured and searchable

**Files to Modify:**
- Multiple files across `app/api/`

---

## Phase 4: User Management Features
**Duration:** Week 3-4 (5-7 days)  
**Dependencies:** Phase 2 and 3 complete

### Task 4.1: Create User Service
**Type:** Backend  
**Priority:** P0  
**Estimated Time:** 3 hours

**Description:**
Create service layer for user operations.

**Subtasks:**
- [ ] Create `app/services/user_service.py`
- [ ] Implement create_user()
- [ ] Implement get_user_by_auth0_id()
- [ ] Implement update_user()
- [ ] Implement delete_user()
- [ ] Implement initialize_tier()
- [ ] Add transaction handling
- [ ] Add error handling
- [ ] Add type hints

**Acceptance Criteria:**
- Service layer complete
- All operations transactional
- Error handling comprehensive
- Type hints complete

**Files to Create:**
- `backend/app/services/user_service.py`

---

### Task 4.2: Create Credit Management Service
**Type:** Backend  
**Priority:** P0  
**Estimated Time:** 3 hours

**Description:**
Create service for credit operations.

**Subtasks:**
- [ ] Create `app/services/credit_service.py`
- [ ] Implement deduct_credits()
- [ ] Implement add_credits()
- [ ] Implement reset_monthly_credits()
- [ ] Handle monthly vs topup credits
- [ ] Add atomic transactions
- [ ] Handle insufficient credits
- [ ] Add logging
- [ ] Add type hints

**Acceptance Criteria:**
- Credit operations atomic
- Monthly credits handled correctly
- Topup credits carry over
- Insufficient credits prevented

**Files to Create:**
- `backend/app/services/credit_service.py`

---

### Task 4.3: Implement Profile Edit Form (Frontend)
**Type:** Frontend  
**Priority:** P1  
**Estimated Time:** 3 hours

**Description:**
Create form for editing user profile.

**Subtasks:**
- [ ] Create `components/ProfileEditForm.tsx`
- [ ] Add fields: first_name, last_name
- [ ] Add profile photo upload
- [ ] Add form validation
- [ ] Handle submit
- [ ] Show success message
- [ ] Show error messages
- [ ] Add loading state
- [ ] Test form

**Acceptance Criteria:**
- Form validates input
- Profile updates successfully
- Error messages clear
- Loading state shown

**Files to Create:**
- `frontend/src/components/ProfileEditForm.tsx`

---

### Task 4.4: Implement Change Email Flow (Frontend)
**Type:** Frontend  
**Priority:** P1  
**Estimated Time:** 2 hours

**Description:**
Create flow for changing email address.

**Subtasks:**
- [ ] Create change email form
- [ ] Trigger Auth0 email change
- [ ] Show verification required message
- [ ] Handle verification callback
- [ ] Update backend after verification
- [ ] Test flow end-to-end

**Acceptance Criteria:**
- Email change triggers verification
- Verification email sent
- Backend updated after verification
- Old email notified

**Files to Create:**
- `frontend/src/components/ChangeEmailForm.tsx`

---

### Task 4.5: Implement Change Password Flow (Frontend)
**Type:** Frontend  
**Priority:** P1  
**Estimated Time:** 2 hours

**Description:**
Create form for changing password.

**Subtasks:**
- [ ] Create change password form
- [ ] Validate current password
- [ ] Validate new password strength
- [ ] Trigger Auth0 password change
- [ ] Show success message
- [ ] Invalidate other sessions
- [ ] Test flow

**Acceptance Criteria:**
- Password strength validated
- Current password required
- Other sessions invalidated
- Success confirmed

**Files to Create:**
- `frontend/src/components/ChangePasswordForm.tsx`

---

### Task 4.6: Create Session Management UI (Frontend)
**Type:** Frontend  
**Priority:** P2  
**Estimated Time:** 3 hours

**Description:**
Create UI for viewing and managing active sessions.

**Subtasks:**
- [ ] Create `components/SessionsList.tsx`
- [ ] Fetch active sessions from Auth0
- [ ] Display session details (device, location, last active)
- [ ] Add "Revoke" button for each session
- [ ] Add "Revoke all others" button
- [ ] Confirm revocation
- [ ] Test session management

**Acceptance Criteria:**
- Active sessions displayed
- Session details shown
- Sessions can be revoked
- Current session cannot be revoked

**Files to Create:**
- `frontend/src/components/SessionsList.tsx`

---

### Task 4.7: Implement Account Deletion UI (Frontend)
**Type:** Frontend  
**Priority:** P1  
**Estimated Time:** 2 hours

**Description:**
Create UI for account deletion request.

**Subtasks:**
- [ ] Create `components/DeleteAccountForm.tsx`
- [ ] Add warning message
- [ ] Require password confirmation
- [ ] Add "I understand" checkbox
- [ ] Call DELETE /users/me
- [ ] Show 30-day grace period message
- [ ] Redirect to confirmation page
- [ ] Test deletion flow

**Acceptance Criteria:**
- Clear warnings shown
- Password required
- 30-day grace explained
- Confirmation received

**Files to Create:**
- `frontend/src/components/DeleteAccountForm.tsx`

---

### Task 4.8: Implement Data Export UI (Frontend)
**Type:** Frontend  
**Priority:** P1  
**Estimated Time:** 2 hours

**Description:**
Create UI for exporting user data (GDPR).

**Subtasks:**
- [ ] Create `components/ExportDataButton.tsx`
- [ ] Call GET /users/me/export
- [ ] Show loading state
- [ ] Download JSON file
- [ ] Show success message
- [ ] Handle errors
- [ ] Test export

**Acceptance Criteria:**
- Export button accessible
- Data downloads as JSON
- Loading state shown
- Success confirmed

**Files to Create:**
- `frontend/src/components/ExportDataButton.tsx`

---

### Task 4.9: Create User Onboarding Flow (Frontend)
**Type:** Frontend  
**Priority:** P2  
**Estimated Time:** 4 hours

**Description:**
Create onboarding flow for new users.

**Subtasks:**
- [ ] Create `app/onboarding/page.tsx`
- [ ] Add welcome message
- [ ] Explain 3 free credits
- [ ] Show feature overview
- [ ] Add "Get Started" button
- [ ] Redirect to dashboard
- [ ] Skip if already onboarded
- [ ] Test flow

**Acceptance Criteria:**
- Onboarding shown to new users only
- Value proposition clear
- Smooth transition to dashboard
- Can be skipped

**Files to Create:**
- `frontend/app/onboarding/page.tsx`

---

### Task 4.10: Add User Menu/Dropdown (Frontend)
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 2 hours

**Description:**
Create user menu dropdown in navigation.

**Subtasks:**
- [ ] Create `components/UserMenu.tsx`
- [ ] Show user name and photo
- [ ] Add "Dashboard" link
- [ ] Add "Settings" link
- [ ] Add credit balance
- [ ] Add tier badge
- [ ] Add "Sign Out" button
- [ ] Style dropdown
- [ ] Test on mobile

**Acceptance Criteria:**
- User menu accessible from all pages
- Credit balance visible
- All links work
- Mobile friendly

**Files to Create:**
- `frontend/src/components/UserMenu.tsx`

---

### Task 4.11: Create Dashboard Overview (Frontend)
**Type:** Frontend  
**Priority:** P1  
**Estimated Time:** 4 hours

**Description:**
Create main dashboard page showing user overview.

**Subtasks:**
- [ ] Create `app/dashboard/page.tsx`
- [ ] Show welcome message with name
- [ ] Display credit balance prominently
- [ ] Show subscription tier
- [ ] Show storage usage
- [ ] Show recent photos
- [ ] Add "Upload Photo" CTA
- [ ] Add "Upgrade" prompt if free tier
- [ ] Test with various tiers

**Acceptance Criteria:**
- Dashboard shows key metrics
- Credits prominent
- Recent activity shown
- Clear call-to-action

**Files to Create:**
- `frontend/app/dashboard/page.tsx`

---

## Phase 5: Cross-Device Upload & Biometric Authentication
**Duration:** Week 4 (5-7 days)  
**Dependencies:** Phase 2 and 3 complete

### Task 5.1: Implement QR Token Service (Backend)
**Type:** Backend  
**Priority:** P0  
**Estimated Time:** 3 hours

**Description:**
Create backend service for generating and validating QR code tokens.

**Subtasks:**
- [ ] Create `backend/app/api/v1/sessions.py`
- [ ] Implement `POST /sessions/qr-token` endpoint
- [ ] Generate UUID token
- [ ] Store token → user_id mapping in Redis (5-min TTL)
- [ ] Add rate limiting (5 tokens/hour/user)
- [ ] Implement `GET /sessions/qr-token/{token}` endpoint
- [ ] Validate token exists in Redis
- [ ] Verify user_id matches
- [ ] Consume token (delete from Redis)
- [ ] Add logging for security
- [ ] Write unit tests

**Acceptance Criteria:**
- QR tokens generated successfully
- Tokens expire after 5 minutes
- Rate limiting enforced
- Token validation works
- Single-use enforcement

**Files to Create:**
- `backend/app/api/v1/sessions.py`
- `backend/tests/api/test_sessions.py`

---

### Task 5.2: Implement Biometric Auth Endpoint (Backend)
**Type:** Backend  
**Priority:** P0  
**Estimated Time:** 4 hours

**Description:**
Create endpoint for biometric authentication and temporary JWT generation.

**Subtasks:**
- [ ] Add `POST /sessions/biometric-auth` endpoint
- [ ] Validate QR token exists
- [ ] Validate WebAuthn biometric proof
- [ ] Generate temporary JWT (1-hour expiry)
- [ ] Add custom claims to JWT
- [ ] Log biometric authentication attempts
- [ ] Handle biometric failures (3 max attempts)
- [ ] Add rate limiting
- [ ] Write unit tests
- [ ] Integration tests

**Acceptance Criteria:**
- Biometric proof validated
- Temporary JWT generated
- JWT expires after 1 hour
- Failed attempts logged
- Rate limiting works

**Files to Create:**
- `backend/app/services/biometric_service.py`
- `backend/tests/services/test_biometric_service.py`

---

### Task 5.3: Create Biometric Hook (Frontend)
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 4 hours

**Description:**
Create React hook for biometric authentication using WebAuthn API.

**Subtasks:**
- [ ] Create `frontend/src/hooks/useBiometric.ts`
- [ ] Implement `checkBiometricCapability()` function
- [ ] Detect Face ID / Touch ID / Fingerprint
- [ ] Implement `authenticateBiometric()` function
- [ ] Use Web Authentication API (WebAuthn)
- [ ] Handle credential request
- [ ] Send biometric proof to backend
- [ ] Handle success/failure states
- [ ] Add error handling
- [ ] Write unit tests

**Acceptance Criteria:**
- Biometric capability detected correctly
- WebAuthn API called successfully
- Biometric proof sent to backend
- Error messages clear
- Works on iOS and Android

**Files to Create:**
- `frontend/src/hooks/useBiometric.ts`
- `frontend/src/__tests__/hooks/useBiometric.test.ts`

---

### Task 5.4: Create QR Code Upload Component (Frontend)
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 3 hours

**Description:**
Create component for desktop to generate and display QR code.

**Subtasks:**
- [ ] Create `frontend/src/components/QRCodeUpload.tsx`
- [ ] Install `qrcode.react` package
- [ ] Call `/sessions/qr-token` to generate token
- [ ] Display QR code with token URL
- [ ] Add "Waiting for upload..." message
- [ ] Open WebSocket connection to listen for upload
- [ ] Handle upload completion event
- [ ] Show success message
- [ ] Add error handling
- [ ] Test on desktop

**Acceptance Criteria:**
- QR code displayed correctly
- WebSocket connection established
- Upload events received
- UI updates on completion
- Errors handled gracefully

**Files to Create:**
- `frontend/src/components/QRCodeUpload.tsx`

---

### Task 5.5: Create Mobile Upload Page (Frontend)
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 5 hours

**Description:**
Create mobile page for QR code scanning and biometric authentication.

**Subtasks:**
- [ ] Create `frontend/src/app/upload/page.tsx`
- [ ] Extract QR token from URL params
- [ ] Check if user already logged in
- [ ] If logged in: validate token and proceed
- [ ] If not logged in: check biometric availability
- [ ] Show "Confirm it's you" modal
- [ ] Call biometric authentication
- [ ] Store temporary JWT in sessionStorage
- [ ] Redirect to upload camera page
- [ ] Handle fallback to Auth0 login
- [ ] Add error states
- [ ] Test on mobile devices

**Acceptance Criteria:**
- QR scan opens correct page
- Biometric prompt shown
- Authentication successful
- Temporary JWT stored
- Fallback to Auth0 works
- Mobile-responsive

**Files to Create:**
- `frontend/src/app/upload/page.tsx`
- `frontend/src/components/BiometricPrompt.tsx`

---

### Task 5.6: Implement WebSocket Upload Notifications (Backend)
**Type:** Backend  
**Priority:** P0  
**Estimated Time:** 4 hours

**Description:**
Set up WebSocket server for real-time upload notifications.

**Subtasks:**
- [ ] Install `fastapi-websocket` or similar
- [ ] Create WebSocket endpoint: `/ws/upload/{token}`
- [ ] Authenticate WebSocket connection
- [ ] Store active WebSocket connections (Redis)
- [ ] Publish upload events when photo uploaded
- [ ] Handle WebSocket disconnects
- [ ] Add connection timeout (5 minutes)
- [ ] Test WebSocket communication
- [ ] Write integration tests

**Acceptance Criteria:**
- WebSocket endpoint functional
- Connections authenticated
- Events published correctly
- Disconnects handled
- Timeout enforced

**Files to Create:**
- `backend/app/api/websockets/upload.py`
- `backend/tests/websockets/test_upload.py`

---

### Task 5.7: Add Rate Limiting for QR Tokens (Backend)
**Type:** Backend  
**Priority:** P1  
**Estimated Time:** 2 hours

**Description:**
Add rate limiting to prevent QR token abuse.

**Subtasks:**
- [ ] Install `slowapi` package
- [ ] Configure rate limiter
- [ ] Add rate limit to QR token generation (5/hour/user)
- [ ] Add rate limit to biometric auth (10/hour/token)
- [ ] Store rate limit data in Redis
- [ ] Return clear error messages
- [ ] Test rate limiting
- [ ] Write unit tests

**Acceptance Criteria:**
- Rate limits enforced
- Redis stores rate limit data
- Error messages clear
- Tests pass

**Files to Modify:**
- `backend/app/api/v1/sessions.py`

---

### Task 5.8: Add Security Logging (Backend)
**Type:** Backend  
**Priority:** P1  
**Estimated Time:** 2 hours

**Description:**
Add comprehensive logging for security events.

**Subtasks:**
- [ ] Log QR token generation
- [ ] Log QR token validation attempts
- [ ] Log biometric authentication attempts
- [ ] Log biometric failures
- [ ] Log temporary JWT creation
- [ ] Include user_id, IP, timestamp
- [ ] Add log rotation
- [ ] Test logging
- [ ] Create monitoring alerts

**Acceptance Criteria:**
- All security events logged
- Logs include necessary context
- Log rotation configured
- Alerts set up

**Files to Modify:**
- `backend/app/api/v1/sessions.py`
- `backend/app/services/biometric_service.py`

---

### Task 5.9: Test Cross-Device Flow End-to-End
**Type:** Testing  
**Priority:** P0  
**Estimated Time:** 3 hours

**Description:**
Test complete cross-device upload flow.

**Subtasks:**
- [ ] Test Scenario A: User already logged in on mobile
- [ ] Test Scenario B: User not logged in, biometric success
- [ ] Test Scenario C: User not logged in, biometric failure
- [ ] Test Scenario D: Token expiry
- [ ] Test Scenario E: Token reuse
- [ ] Test WebSocket notifications
- [ ] Test rate limiting
- [ ] Test on iOS Safari
- [ ] Test on Android Chrome
- [ ] Document test results

**Acceptance Criteria:**
- All scenarios pass
- Works on iOS and Android
- WebSocket works
- Rate limiting works
- Documentation complete

---

## Phase 6: Authorization & Permissions
**Duration:** Week 5 (5 days)  
**Dependencies:** Phase 3, 4, and 5 complete

### Task 6.1: Create Permission Decorators (Backend)
**Type:** Backend  
**Priority:** P0  
**Estimated Time:** 3 hours

**Description:**
Create decorators for tier and credit requirements.

**Subtasks:**
- [ ] Update `app/api/deps.py`
- [ ] Implement @require_tier decorator
- [ ] Implement @require_credits decorator
- [ ] Implement @require_storage decorator
- [ ] Add proper error responses
- [ ] Test each decorator
- [ ] Add type hints
- [ ] Document usage

**Acceptance Criteria:**
- Decorators work correctly
- Proper HTTP status codes (403, 402, 507)
- Clear error messages
- Easy to use

**Files to Modify:**
- `backend/app/api/deps.py`

---

### Task 6.2: Apply Permissions to Photo Endpoints (Backend)
**Type:** Backend  
**Priority:** P0  
**Estimated Time:** 2 hours

**Description:**
Add tier and credit requirements to photo processing endpoints.

**Subtasks:**
- [ ] Add @require_credits(2) to restoration endpoint
- [ ] Add @require_credits(3) to colourization endpoint
- [ ] Add @require_credits(4) to combined endpoint
- [ ] Add @require_tier("remember") to animation endpoint
- [ ] Add @require_credits(8) to animation endpoint
- [ ] Add @require_tier("cherish") to batch upload
- [ ] Test each permission
- [ ] Document requirements

**Acceptance Criteria:**
- All endpoints properly protected
- Free tier cannot access paid features
- Credits checked before processing
- Error messages helpful

**Files to Modify:**
- `backend/app/api/v1/photos.py` (when created)

---

### Task 6.3: Create usePermissions Hook (Frontend)
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 2 hours

**Description:**
Create hook for checking user permissions.

**Subtasks:**
- [ ] Create `hooks/usePermissions.ts`
- [ ] Implement hasTier() function
- [ ] Implement hasCredits() function
- [ ] Implement canAnimate() function
- [ ] Implement canBatchUpload() function
- [ ] Implement getMaxResolution() function
- [ ] Implement hasWatermark() function
- [ ] Add type hints
- [ ] Test hook

**Acceptance Criteria:**
- Hook returns correct permissions
- Easy to use in components
- TypeScript types correct
- Caches appropriately

**Files to Create:**
- `frontend/src/hooks/usePermissions.ts`

---

### Task 6.4: Add Feature Gating to UI (Frontend)
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 3 hours

**Description:**
Gate features in UI based on user permissions.

**Subtasks:**
- [ ] Disable animation button for free tier
- [ ] Show "Upgrade" badge on locked features
- [ ] Disable processing when insufficient credits
- [ ] Show credit requirement on buttons
- [ ] Add tooltips explaining requirements
- [ ] Test with each tier
- [ ] Test with various credit balances

**Acceptance Criteria:**
- Free users cannot access paid features
- UI clearly shows requirements
- Upgrade prompts helpful
- No confusing states

**Files to Modify:**
- Various components throughout frontend

---

### Task 6.5: Create Upgrade Modal (Frontend)
**Type:** Frontend  
**Priority:** P1  
**Estimated Time:** 3 hours

**Description:**
Create modal prompting users to upgrade tier.

**Subtasks:**
- [ ] Create `components/UpgradeModal.tsx`
- [ ] Show tier comparison table
- [ ] Highlight required tier for feature
- [ ] Add "Upgrade" button
- [ ] Add "Maybe Later" button
- [ ] Link to pricing page
- [ ] Style modal
- [ ] Test on mobile

**Acceptance Criteria:**
- Modal shows when accessing locked feature
- Tier benefits clear
- Required tier highlighted
- Easy to dismiss

**Files to Create:**
- `frontend/src/components/UpgradeModal.tsx`

---

### Task 6.6: Create Low Credits Warning (Frontend)
**Type:** Frontend  
**Priority:** P1  
**Estimated Time:** 2 hours

**Description:**
Show warning when user has low credits (<5).

**Subtasks:**
- [ ] Create `components/LowCreditsWarning.tsx`
- [ ] Check credit balance on load
- [ ] Show banner when <5 credits
- [ ] Add "Buy Credits" button
- [ ] Add "Upgrade" button
- [ ] Make dismissible
- [ ] Test warning

**Acceptance Criteria:**
- Warning shows at <5 credits
- Clear call to action
- Can be dismissed
- Not intrusive

**Files to Create:**
- `frontend/src/components/LowCreditsWarning.tsx`

---

### Task 6.7: Create Buy Credits Modal (Frontend)
**Type:** Frontend  
**Priority:** P2  
**Estimated Time:** 3 hours

**Description:**
Create modal for purchasing credit top-ups.

**Subtasks:**
- [ ] Create `components/BuyCreditsModal.tsx`
- [ ] Show credit packages:
  - 10 credits - $4.99
  - 30 credits - $12.99
  - 100 credits - $39.99
- [ ] Add "Purchase" button for each
- [ ] Integrate with Stripe (stub for now)
- [ ] Show success message
- [ ] Update credit balance
- [ ] Test modal

**Acceptance Criteria:**
- Credit packages displayed
- Purchase flow works
- Credits added after payment
- Success confirmed

**Files to Create:**
- `frontend/src/components/BuyCreditsModal.tsx`

---

### Task 6.8: Add Tier Badges Throughout UI (Frontend)
**Type:** Frontend  
**Priority:** P2  
**Estimated Time:** 2 hours

**Description:**
Add visual tier badges throughout the application.

**Subtasks:**
- [ ] Create `components/TierBadge.tsx`
- [ ] Design badges for each tier (colors, icons)
- [ ] Add to user menu
- [ ] Add to settings page
- [ ] Add to dashboard
- [ ] Style badges
- [ ] Make responsive

**Acceptance Criteria:**
- Badges visually distinct
- Shown consistently
- Mobile friendly
- Accessible

**Files to Create:**
- `frontend/src/components/TierBadge.tsx`

---

### Task 6.9: Create Permission Error Pages (Frontend)
**Type:** Frontend  
**Priority:** P1  
**Estimated Time:** 2 hours

**Description:**
Create pages for permission errors (403, 402).

**Subtasks:**
- [ ] Create `app/forbidden/page.tsx` (403)
- [ ] Create `app/insufficient-credits/page.tsx` (402)
- [ ] Show error message
- [ ] Explain requirement
- [ ] Add upgrade CTA
- [ ] Add "Go Back" button
- [ ] Style pages
- [ ] Test navigation

**Acceptance Criteria:**
- Error pages user-friendly
- Clear explanation
- Path to resolution shown
- Navigation works

**Files to Create:**
- `frontend/app/forbidden/page.tsx`
- `frontend/app/insufficient-credits/page.tsx`

---

## Phase 7: Testing & Security Hardening
**Duration:** Week 6-7 (7-10 days)  
**Dependencies:** All previous phases complete

### Task 7.1: Write Backend Unit Tests
**Type:** Backend  
**Priority:** P0  
**Estimated Time:** 8 hours

**Description:**
Write comprehensive unit tests for authentication logic.

**Subtasks:**
- [ ] Test JWT verification (valid, invalid, expired)
- [ ] Test user CRUD operations
- [ ] Test permission decorators
- [ ] Test credit operations
- [ ] Test tier checking
- [ ] Aim for 80%+ coverage
- [ ] Fix any bugs found

**Acceptance Criteria:**
- 80%+ code coverage
- All critical paths tested
- Tests pass consistently
- No flaky tests

**Files to Create:**
- `backend/tests/test_auth.py`
- `backend/tests/test_user_service.py`
- `backend/tests/test_permissions.py`

---

### Task 7.2: Write Backend Integration Tests
**Type:** Backend  
**Priority:** P0  
**Estimated Time:** 6 hours

**Description:**
Write integration tests for authentication flows.

**Subtasks:**
- [ ] Test complete signup flow
- [ ] Test complete login flow
- [ ] Test Auth0 webhook handling
- [ ] Test protected endpoint access
- [ ] Test permission denials
- [ ] Test error responses
- [ ] Fix any bugs found

**Acceptance Criteria:**
- All flows tested end-to-end
- Database interactions tested
- External services mocked
- Tests pass consistently

**Files to Create:**
- `backend/tests/integration/test_auth_flow.py`
- `backend/tests/integration/test_webhooks.py`

---

### Task 7.3: Write Frontend Unit Tests
**Type:** Frontend  
**Priority:** P1  
**Estimated Time:** 6 hours

**Description:**
Write unit tests for frontend authentication components.

**Subtasks:**
- [ ] Test useCurrentUser hook
- [ ] Test usePermissions hook
- [ ] Test sign-in/sign-up pages
- [ ] Test protected route middleware
- [ ] Test API client
- [ ] Aim for 70%+ coverage
- [ ] Fix any bugs found

**Acceptance Criteria:**
- 70%+ code coverage
- All hooks tested
- Component rendering tested
- Tests pass consistently

**Files to Create:**
- `frontend/src/hooks/__tests__/*.test.ts`
- `frontend/src/components/__tests__/*.test.tsx`

---

### Task 7.4: Perform Security Audit
**Type:** Backend + Frontend  
**Priority:** P0  
**Estimated Time:** 4 hours

**Description:**
Conduct security audit of authentication implementation.

**Subtasks:**
- [ ] Review JWT verification implementation
- [ ] Check for SQL injection vulnerabilities
- [ ] Check for XSS vulnerabilities
- [ ] Verify CSRF protection
- [ ] Check rate limiting effectiveness
- [ ] Review permission checks
- [ ] Test with common attack vectors
- [ ] Document findings
- [ ] Fix all critical issues

**Acceptance Criteria:**
- No critical vulnerabilities
- No high-risk vulnerabilities
- Medium/low risks documented
- Fixes implemented and tested

---

### Task 7.5: Load Testing
**Type:** Backend  
**Priority:** P1  
**Estimated Time:** 3 hours

**Description:**
Test authentication endpoints under load.

**Subtasks:**
- [ ] Set up load testing tool (k6, locust)
- [ ] Test login endpoint (100 req/s)
- [ ] Test /users/me endpoint (200 req/s)
- [ ] Test JWT verification performance
- [ ] Test rate limiting triggers
- [ ] Identify bottlenecks
- [ ] Optimize if needed
- [ ] Document results

**Acceptance Criteria:**
- Can handle expected load
- Rate limiting works under load
- No performance regressions
- Bottlenecks identified

---

### Task 7.6: End-to-End Testing (Optional)
**Type:** Frontend + Backend  
**Priority:** P2  
**Estimated Time:** 6 hours

**Description:**
Write E2E tests for critical authentication flows.

**Subtasks:**
- [ ] Set up Playwright
- [ ] Test complete signup flow
- [ ] Test complete login flow
- [ ] Test social login (Google)
- [ ] Test password reset flow
- [ ] Test profile update
- [ ] Test permission denials
- [ ] Run tests in CI

**Acceptance Criteria:**
- Critical flows covered
- Tests run in CI
- Tests pass reliably
- Screenshots captured on failure

**Files to Create:**
- `e2e/auth.spec.ts`

---

### Task 7.7: Documentation
**Type:** Documentation  
**Priority:** P1  
**Estimated Time:** 4 hours

**Description:**
Document authentication system for developers.

**Subtasks:**
- [ ] Document API endpoints
- [ ] Document permission decorators
- [ ] Document frontend hooks
- [ ] Document environment variables
- [ ] Document Auth0 configuration
- [ ] Add code examples
- [ ] Create troubleshooting guide
- [ ] Update README

**Acceptance Criteria:**
- All endpoints documented
- Examples provided
- Troubleshooting guide complete
- README updated

**Files to Create/Modify:**
- `backend/docs/authentication.md`
- `frontend/docs/authentication.md`
- `README.md`

---

### Task 7.8: Production Deployment Checklist
**Type:** Infrastructure  
**Priority:** P0  
**Estimated Time:** 2 hours

**Description:**
Create and verify production deployment checklist.

**Subtasks:**
- [ ] Verify all environment variables set
- [ ] Verify Auth0 production tenant configured
- [ ] Verify social OAuth apps in production mode
- [ ] Verify callback URLs correct
- [ ] Verify webhook URLs correct
- [ ] Verify rate limits appropriate
- [ ] Run database migrations
- [ ] Test authentication in staging
- [ ] Monitor logs for errors
- [ ] Create rollback plan

**Acceptance Criteria:**
- All configurations verified
- Staging tests pass
- Production ready
- Rollback plan documented

---

## Summary & Next Steps

### Task Distribution

**By Type:**
- Frontend: 28 tasks (42%)
- Backend: 30 tasks (45%)
- Infrastructure: 9 tasks (13%)

**By Priority:**
- P0 (Critical): 41 tasks
- P1 (High): 22 tasks
- P2 (Medium): 4 tasks

### Timeline Estimate

- **Fastest:** 6 weeks (with 2 developers, parallel work)
- **Realistic:** 7 weeks (with 1-2 developers)
- **Conservative:** 8-9 weeks (with blockers/unknowns)

### Dependencies

Critical path:
1. Phase 1 (Auth0 Setup) → Phase 2 (Frontend Auth)
2. Phase 1 (Auth0 Setup) → Phase 3 (Backend Auth)
3. Phase 2 + Phase 3 → Phase 4 (User Management)
4. Phase 2 + Phase 3 → Phase 5 (Cross-Device & Biometric)
5. Phase 4 + Phase 5 → Phase 6 (Authorization)
6. All Phases → Phase 7 (Testing)

### Resource Requirements

**Developers:**
- 1 Frontend developer (full-time)
- 1 Backend developer (full-time)
- OR 1 Full-stack developer (will take longer)

**External Services:**
- Auth0 account (free tier)
- Email service (Auth0 included, or SendGrid/SES for custom)
- Testing tools (Jest, Pytest, Playwright)

---

**Document Status:** ✅ Ready for Implementation  
**Last Updated:** October 21, 2025  
**Next Step:** Begin Phase 1 - Auth0 Setup

