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
| Phase 0: Cleanup Auth0 Setup | Week 1 (Day 1) | 3 tasks | Not Started |
| Phase 1: Supabase Setup | Week 1 (Day 1-2) | 9 tasks | Not Started |
| Phase 2: Frontend Auth | Week 2 | 10 tasks | Not Started |
| Phase 3: Backend Auth | Week 2-3 | 12 tasks | Not Started |
| Phase 4: User Management | Week 3-4 | 11 tasks | Not Started |
| Phase 5: Cross-Device & Biometric | Week 4 | 9 tasks | Not Started |
| Phase 6: Authorization | Week 5 | 9 tasks | Not Started |
| Phase 7: Testing & Security | Week 6-7 | 15 tasks | Not Started |

**Total Tasks:** 79 (3 cleanup + 76 implementation)  
**Frontend Tasks:** 35  
**Backend Tasks:** 30  
**Infrastructure Tasks:** 14 (3 cleanup + 11 setup)

---

## Phase 0: Cleanup Auth0 Setup
**Duration:** Day 1 (2-3 hours)  
**Dependencies:** None  
**Note:** Clean up completed Auth0 setup before starting Supabase implementation

### Task 0.1: Remove Auth0 Tenant
**Type:** Infrastructure  
**Priority:** P0  
**Estimated Time:** 30 minutes  
**Status:** Not Started

**Description:**
Clean up Auth0 tenant and applications that were previously set up.

**Subtasks:**
- [ ] Log into Auth0 Dashboard
- [ ] Navigate to Applications section
- [ ] Delete "Rekindle Development" application
- [ ] Delete "Rekindle Production" application
- [ ] Navigate to Settings > General
- [ ] Delete Auth0 tenant (if desired, or keep for reference)
- [ ] Document any credentials that may be needed for reference

**Acceptance Criteria:**
- ✅ All Auth0 applications deleted
- ✅ Tenant deleted or documented as deprecated
- ✅ Credentials documented if needed for reference

---

### Task 0.2: Clean Up Auth0 Email Templates
**Type:** Infrastructure  
**Priority:** P0  
**Estimated Time:** 15 minutes  
**Status:** Not Started

**Description:**
Remove any Auth0 email template customizations (if keeping tenant, templates will remain but are not used).

**Subtasks:**
- [ ] (Optional) Document any template content for reference
- [ ] (Optional) Reset email templates to defaults if tenant is kept
- [ ] Note: Templates can remain if tenant is kept for reference

**Acceptance Criteria:**
- ✅ Email template customizations documented if needed
- ✅ Templates reset to defaults (if tenant kept)

---

### Task 0.3: Clean Up Auth0 Universal Login Configuration
**Type:** Infrastructure  
**Priority:** P0  
**Estimated Time:** 15 minutes  
**Status:** Not Started

**Description:**
Remove Auth0 Universal Login customizations (if keeping tenant, configurations will remain but are not used).

**Subtasks:**
- [ ] (Optional) Document any branding settings for reference
- [ ] (Optional) Reset Universal Login to defaults if tenant is kept
- [ ] Note: Configurations can remain if tenant is kept for reference

**Acceptance Criteria:**
- ✅ Universal Login customizations documented if needed
- ✅ Configurations reset to defaults (if tenant kept)

---

## Phase 1: Supabase Setup & Configuration
**Duration:** Week 1 (2-3 days)  
**Dependencies:** Phase 0 complete

**Note:** This phase replaces the previous Auth0 setup. Supabase provides a simpler, more developer-friendly authentication solution with built-in email template testing.

### Task 1.1: Create Supabase Project
**Type:** Infrastructure  
**Priority:** P0  
**Estimated Time:** 30 minutes  
**Status:** Not Started

**Description:**
Set up Supabase account and create project for authentication.

**Note:** Free tier allows 50,000 MAU. Using single project strategy:
- Single project for both dev and prod (or separate projects)
- Environment variables differentiate environments
- Supabase Auth handles all authentication flows

**Subtasks:**
- [x] Create Supabase account at supabase.com
- [x] Click "New Project"
- [x] Fill in project details:
  - Name: "Rekindle" (or "Rekindle Development")
  - Database Password: Generate strong password
  - Region: Choose closest to your users (US East recommended)
- [x] Wait for project to provision (2-3 minutes)
- [x] Note down project URL (e.g., `https://xxx.supabase.co`)
- [x] Navigate to Settings > API
- [x] Document API keys:
  - Project URL
  - Anon/public key (for frontend)
  - Service role key (for backend - keep secret!)

**Acceptance Criteria:**
- ✅ Supabase project created and accessible
- ✅ Project URL confirmed
- ✅ Free tier limits verified (50,000 MAU)
- ✅ API keys documented securely
- ✅ Project status shows "Active"

**Resources:**
- Supabase Docs: https://supabase.com/docs/guides/auth
- Project Setup: https://supabase.com/docs/guides/getting-started

**Note:** This task sets up the cloud Supabase project for production use. For local development, see Task 1.1b below.

---

### Task 1.1b: Set Up Local Supabase Development (Docker)
**Type:** Infrastructure  
**Priority:** P0  
**Estimated Time:** 45 minutes  
**Status:** Not Started

**Description:**
Set up Supabase locally using Docker for smooth development experience. This will be integrated into the `./dev` script so everything starts together.

**Why Local Supabase:**
- Fast development (no network latency)
- No cloud API rate limits
- Free unlimited testing
- Works offline
- Matches production environment exactly
- Easy to reset/reset data

**Subtasks:**
- [x] Install Supabase CLI: `brew install supabase/tap/supabase` (macOS) or see https://supabase.com/docs/guides/cli/getting-started
- [x] Verify installation: `supabase --version`
- [x] Initialize Supabase in project root: `supabase init`
  - This creates `supabase/` directory with config
- [x] Start local Supabase: `supabase start`
  - This starts Docker containers for:
    - PostgreSQL (port 54322)
    - Supabase Studio (port 54323)
    - Auth API (port 54324)
    - Rest API (port 54325)
    - Realtime (port 54326)
    - Storage API (port 54327)
    - PostgREST (port 54328)
- [x] Note local credentials (shown after `supabase start`):
  - API URL: `http://localhost:54321`
  - GraphQL URL: `http://localhost:54321/graphql/v1`
  - DB URL: `postgresql://postgres:postgres@localhost:54322/postgres`
  - Studio URL: `http://localhost:54323`
  - Anon key: (shown in output)
  - Service role key: (shown in output)
- [x] Create `.env.local.example` with local Supabase variables:
  ```
  NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
  ```
- [x] Update `backend/.env.example` with local Supabase variables:
  ```
  SUPABASE_URL=http://localhost:54321
  SUPABASE_ANON_KEY=<local-anon-key>
  SUPABASE_SERVICE_KEY=<local-service-role-key>
  ```
- [x] Integrate Supabase into `./dev` script (see Task 1.1c)
- [x] Test local Supabase Studio: `open http://localhost:54323`
- [ ] Verify local auth works in frontend

**Acceptance Criteria:**
- ✅ Supabase CLI installed
- ✅ Local Supabase initialized
- ✅ Local Supabase running via Docker
- ✅ Environment variables configured for local development
- ✅ Supabase integrated into `./dev` script
- ✅ Local Supabase Studio accessible
- ✅ Can create test users locally

**Resources:**
- Supabase CLI Docs: https://supabase.com/docs/guides/cli
- Local Development: https://supabase.com/docs/guides/cli/local-development
- Docker Requirements: Docker Desktop must be running

**Note:** The local Supabase instance runs separately from your main `docker-compose.yml`. The Supabase CLI manages its own Docker containers. For production, use the cloud project from Task 1.1.

---

### Task 1.1c: Integrate Supabase into Dev Script
**Type:** Infrastructure  
**Priority:** P0  
**Estimated Time:** 30 minutes  
**Status:** Not Started

**Description:**
Update the `./dev` script to automatically start/stop Supabase along with other development services.

**Subtasks:**
- [x] Update `scripts/dev-docker.sh`:
  - [x] Check if Supabase CLI is installed (with helpful error if not)
  - [x] Run `supabase start` before starting docker-compose services
  - [x] Wait for Supabase to be ready before proceeding
  - [x] Set local Supabase environment variables automatically
  - [x] On stop (`./dev stop`), run `supabase stop` to stop local Supabase
- [x] Update `./dev` script:
  - [x] Add `supabase stop` to stop command
  - [x] Update help text to mention Supabase
- [x] Create helper script `scripts/supabase-status.sh` to check if Supabase is running
- [x] Test integration:
  - [x] Run `./dev start` - verify Supabase starts automatically
  - [x] Run `./dev stop` - verify Supabase stops automatically
  - [x] Verify environment variables are set correctly
  - [x] Verify frontend can connect to local Supabase
- [x] Document in README or development docs

**Acceptance Criteria:**
- ✅ `./dev start` automatically starts Supabase
- ✅ `./dev stop` automatically stops Supabase
- ✅ Environment variables automatically configured
- ✅ No manual steps needed for developers
- ✅ Helpful error messages if Supabase CLI missing

**Files to Modify:**
- `scripts/dev-docker.sh`
- `dev` (root script)

**Files to Create:**
- `scripts/supabase-status.sh` (optional helper)

**Note:** When switching between local and cloud Supabase, developers can change environment variables. Local development uses `http://localhost:54321`, production uses cloud URL.

---

### Task 1.2: Configure Social Identity Providers (Google Only - MVP)
**Type:** Infrastructure  
**Priority:** P0  
**Estimated Time:** 30 minutes  
**Status:** Not Started

**Description:**
Set up Google OAuth for "Continue with Google" functionality. Facebook and Apple Sign In deferred to post-launch.

**MVP Decision:** 
- ✅ **Google OAuth** - Primary social login for MVP
- ⏭️ **Facebook** - Deferred to post-launch (Task 1.2b)
- ⏭️ **Apple Sign In** - Deferred to post-launch (Task 1.2c)

**Important Notes:**
- Supabase Callback URL: `https://[project-id].supabase.co/auth/v1/callback`
- Much simpler setup than Auth0 - no need for separate apps
- **Configuration Location:** Supabase.com cloud dashboard (not available in local Studio UI)

**Where to Configure:**
- **Cloud Dashboard:** https://app.supabase.com (required for production)
- **Local Studio:** Not available - OAuth providers must be configured in cloud dashboard

**Subtasks:**
- [x] Create Google Cloud Project and OAuth credentials (if not using Supabase's built-in option)
  - [x] Go to https://console.cloud.google.com/
  - [x] Create a new project or select existing project
  - [x] Navigate to APIs & Services → Credentials
  - [x] Click "Create Credentials" → "OAuth client ID"
  - [x] Configure OAuth consent screen (if not already done)
  - [x] Select "Web application" as application type
  - [x] Add authorized redirect URI: `https://[project-id].supabase.co/auth/v1/callback`
  - [x] Copy the Client ID and Client Secret (you'll need these)

- [x] Configure Google OAuth in Supabase Cloud Dashboard
  - [x] Go to https://app.supabase.com
  - [x] Select your Rekindle project
  - [x] Navigate to Authentication → Providers
  - [x] Find and click on "Google" provider
  - [x] Toggle the "Enable Google provider" switch to ON
  - [x] Enter your Google OAuth credentials:
    - **Client ID (for Google OAuth):** Paste your Google Client ID
    - **Client Secret (for Google OAuth):** Paste your Google Client Secret
  - [x] Click "Save" to save the configuration
  - [x] Verify the provider shows "Enabled" status

- [ ] Test Google OAuth connection
  - [ ] Use the test login button in Supabase dashboard (if available)
  - [ ] Or wait until frontend auth is implemented (Task 2.1+) to test end-to-end
  - [ ] Verify email is retrieved successfully from Google account

- [x] Document credentials and setup
  - [x] Note the Supabase callback URL format
  - [x] Document Google OAuth Client ID (can be stored in environment variables)
  - [x] Store Google Client Secret securely (never commit to git)

**Acceptance Criteria:**
- ✅ Google OAuth configured and active in Supabase Dashboard
- ✅ Test login successful
- ✅ Supabase callback URL correctly set
- ✅ User email retrieved from Google
- ✅ Provider shows "Enabled" status in Supabase

**Deferred to Post-Launch:**
- Facebook Login (Task 1.2b)
- Apple Sign In (Task 1.2c)

**Resources:**
- Supabase Google OAuth: https://supabase.com/docs/guides/auth/social-login/auth-google
- Google Cloud Console: https://console.cloud.google.com/

---

### Task 1.3: Configure Email Templates
**Type:** Infrastructure  
**Priority:** P1  
**Estimated Time:** 1 hour

**Description:**
Customize Supabase email templates for verification and password reset.

**Note:** Supabase allows testing email templates directly in the dashboard without requiring an external email provider (unlike Auth0).

**Where to Configure:**
- **Cloud Dashboard:** https://app.supabase.com (required - email templates not configurable in local Studio)
- **Local Studio:** Not available - email templates are only configurable in cloud dashboard

**Subtasks:**
- [x] Navigate to Email Templates in Supabase Cloud Dashboard
  - [x] Go to https://app.supabase.com
  - [x] Select your Rekindle project
  - [x] Navigate to Authentication → Email Templates

- [x] Customize "Confirm signup" template
  - [x] Click on "Confirm signup" template
  - [x] Update subject line (e.g., "Confirm your Rekindle account")
  - [x] Update email body with Rekindle branding
  - [x] Include the confirmation link: `{{ .ConfirmationURL }}`
  - [x] Click "Save" to save changes
  - [x] Use "Send test email" button to test the template (if available)

- [x] Customize "Reset password" template
  - [x] Click on "Reset password" template
  - [x] Update subject line (e.g., "Reset your Rekindle password")
  - [x] Update email body with Rekindle branding
  - [x] Include the password reset link: `{{ .ConfirmationURL }}`
  - [x] Click "Save" to save changes
  - [x] Use "Send test email" button to test the template (if available)

- [x] Customize "Magic Link" template (optional)
  - [x] Click on "Magic Link" template
  - [x] Update subject line and body with Rekindle branding
  - [x] Include the magic link: `{{ .ConfirmationURL }}`
  - [x] Click "Save" to save changes

- [ ] Configure "From" email address
  - [ ] Navigate to Authentication → Settings
  - [ ] Find "SMTP Settings" section
  - [ ] Configure "From" email address (e.g., `noreply@rekindle.app`)
  - [ ] Note: Default emails use Supabase's email service (limited to 3 emails/hour on free tier)

- [ ] Test email delivery with real email address
  - [ ] Use the test email functionality in the dashboard
  - [ ] Send test emails to your own email address
  - [ ] Verify emails are received and formatted correctly

- [ ] (Optional for production) Set up custom SMTP provider
  - [ ] Navigate to Authentication → Settings → SMTP Settings
  - [ ] Configure custom SMTP provider (Gmail, SendGrid, etc.)
  - [ ] Enter SMTP host, port, username, and password
  - [ ] Test SMTP connection
  - [ ] Note: This is required for production to avoid email limits

**Acceptance Criteria:**
- ✅ Email templates branded with Rekindle look and feel
- ✅ Test emails can be sent from dashboard (no external provider needed!)
- ✅ All links work correctly
- ✅ Email deliverability tested
- ✅ Templates saved successfully

---

### Task 1.4: Configure Redirect URLs
**Type:** Infrastructure  
**Priority:** P0  
**Estimated Time:** 15 minutes

**Description:**
Configure allowed redirect URLs for Supabase authentication.

**Note:** Supabase doesn't require a hosted login page like Auth0. We'll build our own login UI, but need to configure allowed redirect URLs.

**Where to Configure:**
- **Cloud Dashboard:** https://app.supabase.com (required for production)
- **Local Studio:** Not available - URL configuration is only in cloud dashboard
- **Note:** For local development, you can use `http://localhost:3000` without configuring in cloud (it's allowed by default), but you should configure it for consistency and testing.

**Subtasks:**
- [x] Navigate to URL Configuration in Supabase Cloud Dashboard
  - [x] Go to https://app.supabase.com
  - [x] Select your Rekindle project
  - [x] Navigate to Authentication → URL Configuration

- [ ] Configure Site URL
  - [x] Find the "Site URL" field
  - [x] For development, set to: `http://localhost:3000`
  - [ ] For production (later), set to: `https://rekindle.app`
  - [x] Click "Save" after each change

- [ ] Add Redirect URLs
  - [x] Find the "Redirect URLs" section
  - [x] Click "Add URL" or use the multi-line text field
  - [-] Add the following URLs (one per line):
    - Development: `http://localhost:3000/auth/callback`
    - Development: `http://localhost:3000/**` (wildcard for all localhost routes)
    - Production (later): `https://rekindle.app/auth/callback`
    - Production (later): `https://rekindle.app/**` (wildcard for all production routes)
  - [x] Click "Save" to save the configuration
  - [x] Note: You can add multiple URLs, one per line

- [x] Verify configuration
  - [x] Confirm Site URL is set correctly
  - [x] Confirm all Redirect URLs are listed
  - [x] Verify configuration is saved (no unsaved changes warning)

- [ ] Add Production URLs when ready for production deployment
  - [ ] Follow the same steps above with production URLs
  - [ ] Ensure production URLs are added before deploying frontend

- [ ] Test redirect flow (see Testing Instructions below)

**Testing Instructions for Redirect Flow:**

Since Supabase doesn't have a built-in redirect testing feature, you'll need to test the redirect flow manually through your application:

1. **Basic Redirect Test (After Frontend Auth Setup):**
   - Once you've implemented the authentication flow (Task 2.1+), test the redirect:
   - Navigate to your sign-in page at `http://localhost:3000/sign-in`
   - Click "Continue with Google" (or any OAuth provider)
   - Verify you're redirected to Supabase auth
   - After authentication, verify you're redirected back to `http://localhost:3000/auth/callback`
   - Verify you're then redirected to your intended destination (dashboard, etc.)

2. **Manual URL Test:**
   - You can also test by directly accessing the callback URL:
   - `http://localhost:3000/auth/callback?code=[auth-code]`
   - If configured correctly, Supabase should accept the redirect
   - If not configured, you'll get an error about invalid redirect URL

3. **Error Testing:**
   - Try accessing an invalid redirect URL (not in your allowed list)
   - Should get a clear error message from Supabase
   - This confirms your allowed URLs list is working

**Note:** You won't be able to fully test the redirect flow until you implement the frontend authentication (Phase 2). For now, you can verify the configuration is saved in Supabase Dashboard.

**Acceptance Criteria:**
- ✅ Site URL configured for Development
- ✅ Redirect URLs configured correctly for Development
- ✅ Production URLs added when ready (can be deferred until production deployment)
- ✅ Configuration saved in Supabase Dashboard
- ✅ Redirect flow tested after frontend auth implementation (Task 2.1+)

---

### Task 1.5: Configure JWT and Session Settings
**Type:** Infrastructure  
**Priority:** P0  
**Estimated Time:** 1 hour

**Description:**
Configure JWT token and session settings for Supabase authentication.

**What is a JWT and why do we need this?**
- JWT (JSON Web Token) is a secure way for your frontend to authenticate API requests to your backend
- When a user logs in via Supabase, they get a JWT token that proves their identity
- Your backend needs to verify this token is valid before allowing access to protected routes
- Supabase automatically generates JWTs - we just need to configure token expiration and session settings

**Where to Configure:**
- **Cloud Dashboard:** https://app.supabase.com (required - JWT settings are in cloud dashboard)
- **Local Studio:** Limited settings available, but JWT configuration is primarily in cloud dashboard
- **Note:** For local development, JWT settings from cloud are used. Local Studio has limited JWT configuration options.

**Step-by-Step Instructions:**

**Step 1: Navigate to Authentication Settings**
1. Go to https://app.supabase.com
2. Select your Rekindle project
3. Navigate to Authentication → Settings
4. You'll see several sections: General, JWT Settings, Session Settings, Security, etc.

**Step 2: Configure JWT Settings**
1. Scroll down to find the "JWT Settings" section
2. Configure the following:

**JWT Expiration:**
- Find the "JWT expiry" or "JWT expiration" field
- Set to `3600` seconds (1 hour)
- **Why 1 hour?** Tokens expire for security - if someone steals a token, it won't work forever. 1 hour is a good balance between security and user experience.
- Click "Save" if there's a save button, or changes may auto-save

**JWT Secret:**
- Supabase automatically generates a JWT secret
- You can view it (but be careful - it's sensitive)
- **Important:** Never share this secret publicly or commit it to git
- This is used to sign and verify JWT tokens
- The secret is shown in the JWT Settings section (usually masked)

**Step 3: Configure Session Settings**
1. Scroll to find the "Session Settings" or "Session Management" section
2. Configure the following:

**Session Duration:**
- Find the "Session duration" or "Session expiry" field
- Set to `3600` seconds (1 hour) to match JWT expiration
- This controls how long a user session lasts before requiring re-authentication

**Refresh Token Rotation:**
- Find the "Refresh token rotation" toggle or checkbox
- Enable refresh token rotation (recommended for security)
- This automatically rotates refresh tokens when used, preventing token reuse attacks
- Click "Save" to save changes

**Step 4: Document Important Values**
Create a note with these values (you'll need them later):

```
Supabase Configuration:
- Project URL: https://[project-id].supabase.co
- JWKS URL: https://[project-id].supabase.co/.well-known/jwks.json
- Token Expiration: 3600 seconds (1 hour)
- Signing Algorithm: RS256 (default)
- Anon Key: [from Settings > API]
- Service Role Key: [from Settings > API - keep secret!]
```

**Note on JWT Verification:**
- Supabase automatically uses RS256 for JWT signing
- Your backend will verify tokens using the JWKS URL
- JWKS URL format: `https://[project-id].supabase.co/.well-known/jwks.json`
- We'll configure the backend to verify tokens in Task 3.4

**Subtasks:**
- [x] Navigate to Authentication → Settings in Supabase Dashboard
- [x] Review JWT Settings (default is usually correct)
- [x] Set JWT Expiration to 3600 seconds (1 hour)
- [x] Review Session Settings
- [x] Enable refresh token rotation
- [x] Document JWKS URL (format: `https://[project-id].supabase.co/.well-known/jwks.json`)
- [x] Document Project URL
- [x] Verify all settings saved

**Acceptance Criteria:**
- ✅ JWT expiration set to 3600 seconds (1 hour)
- ✅ Session duration configured
- ✅ Refresh token rotation enabled
- ✅ JWKS URL documented (for backend use)
- ✅ Project URL documented
- ✅ Settings saved successfully

---

### Task 1.6: Set Up Webhooks
**Type:** Infrastructure  
**Priority:** P1  
**Estimated Time:** 30 minutes

**Description:**
Configure Supabase webhooks to sync user events to backend.

**Where to Configure:**
- **Cloud Dashboard:** https://app.supabase.com (required - webhooks are only available in cloud)
- **Local Studio:** Not available - webhooks are cloud-only feature
- **Note:** Webhooks are for production use. For local development, you can use Supabase Realtime or direct database connections instead.

**Subtasks:**
- [x] Navigate to Webhooks in Supabase Cloud Dashboard
  - [x] Go to https://app.supabase.com
  - [x] Select your Rekindle project
  - [x] Navigate to Database → Webhooks (or Project Settings → Webhooks)

- [x] Create a new webhook
  - [x] Click "Create a new webhook" or "Add webhook" button
  - [x] You'll see a form to configure the webhook

- [x] Configure webhook settings
  - [x] **Name:** Enter a descriptive name (e.g., "User Events Webhook")
  - [x] **Endpoint URL:** Set to `https://api.rekindle.app/api/webhooks/supabase`
    - Note: For local testing, you may need to use a tunneling service like ngrok
  - [x] **HTTP Method:** Select "POST" (default)
  - [x] **Table:** Select `auth.users` from the dropdown
    - Note: You may need to select "auth" schema first, then "users" table

- [x] Configure webhook events
  - [x] Select events to subscribe to:
    - [x] Check "INSERT" (fires when user.created)
    - [x] Check "UPDATE" (fires when user.updated)
    - [x] Check "DELETE" (fires when user.deleted)
  - [x] You can select multiple events

- [ ] Generate webhook secret
  - [ ] Find the "Webhook Secret" or "Signing Secret" field
  - [ ] Click "Generate" or "Generate new secret" button
  - [ ] Copy the secret immediately (you won't be able to see it again)
  - [ ] Store this secret securely (you'll need it for backend verification)

- [x] Save webhook configuration
  - [x] Review all settings
  - [x] Click "Save" or "Create webhook" button
  - [x] Verify webhook appears in the list with "Active" status

- [ ] Save webhook secret to environment variables
  - [ ] Add `SUPABASE_WEBHOOK_SECRET` to your backend `.env` file
  - [ ] Set the value to the secret you generated
  - [ ] Never commit this secret to git

- [ ] Test webhook delivery (once backend is ready)
  - [ ] Create a test user in Supabase
  - [ ] Verify webhook is called (check backend logs)
  - [ ] Verify webhook payload is correct
  - [ ] Test UPDATE and DELETE events as well

**Acceptance Criteria:**
- ✅ Webhook configured in Supabase
- ✅ Correct events subscribed (INSERT, UPDATE, DELETE)
- ✅ Webhook secret generated and stored securely
- ✅ Endpoint URL set correctly

---

### Task 1.7: Configure Security Settings
**Type:** Infrastructure  
**Priority:** P0  
**Estimated Time:** 30 minutes

**Description:**
Configure security settings including rate limiting, MFA, and password requirements.

**Where to Configure:**
- **Cloud Dashboard:** https://app.supabase.com (required - security settings are in cloud dashboard)
- **Local Studio:** Limited settings available, but security configuration is primarily in cloud dashboard

**Subtasks:**
- [ ] Navigate to Security Settings in Supabase Cloud Dashboard
  - [ ] Go to https://app.supabase.com
  - [ ] Select your Rekindle project
  - [ ] Navigate to Authentication → Settings
  - [ ] Scroll to find "Security" or "Rate Limiting" section

- [ ] Configure Rate Limiting
  - [ ] Find the "Rate Limiting" section
  - [ ] Review the default rate limiting settings:
    - Maximum attempts per IP: Usually 5 per minute (default)
    - Lockout duration: Usually 60 seconds (default)
  - [ ] Adjust if needed (defaults are usually sufficient)
  - [ ] Ensure rate limiting is enabled (should be enabled by default)
  - [ ] Click "Save" if there's a save button

- [ ] Configure MFA (optional for MVP)
  - [ ] Find the "Multi-Factor Authentication" or "MFA" section
  - [ ] Review MFA options:
    - TOTP (Time-based One-Time Password) - recommended
    - SMS (may require additional setup)
  - [ ] For MVP: Leave MFA disabled (can be enabled later if needed)
  - [ ] If enabling: Toggle "Enable TOTP" to ON
  - [ ] Save changes

- [ ] Review Session Settings (already configured in Task 1.5)
  - [ ] Verify Session duration: 3600 seconds (1 hour)
  - [ ] Verify Refresh token rotation: Enabled
  - [ ] These should already be configured from Task 1.5

- [ ] Review Password Settings
  - [ ] Find the "Password" or "Password Requirements" section
  - [ ] Review password minimum length: 8 characters (default, usually sufficient)
  - [ ] Configure password complexity rules:
    - [ ] Enable "Require uppercase letter" (optional but recommended)
    - [ ] Enable "Require lowercase letter" (optional but recommended)
    - [ ] Enable "Require number" (optional but recommended)
    - [ ] Enable "Require special character" (optional but recommended)
  - [ ] Click "Save" to save password requirements
  - [ ] Note: More complex requirements improve security but may reduce user adoption

- [ ] Verify all security settings are saved
  - [ ] Review all sections to ensure no unsaved changes
  - [ ] Test that settings persist after page refresh

**Acceptance Criteria:**
- ✅ Rate limiting configured
- ✅ Session settings reviewed and confirmed
- ✅ Password requirements set
- ✅ Security settings saved

---

**Note:** This task was already covered in Task 1.4: Configure Redirect URLs. Task 1.8 is not needed for Supabase as redirect URLs are configured in Task 1.4.

**Task 1.8 is merged into Task 1.4: Configure Redirect URLs.**

---

## Phase 2: Frontend Authentication Implementation
**Duration:** Week 2 (5 days)  
**Dependencies:** Phase 1 complete

### Task 2.1: Install Supabase JavaScript Client
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 30 minutes

**Description:**
Install and configure Supabase JavaScript client in frontend.

**Subtasks:**
- [x] Install package: `npm install @supabase/supabase-js @supabase/auth-helpers-nextjs`
- [x] Create `.env.local` with Supabase credentials
- [x] Add environment variables:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
- [x] Create `lib/supabase.ts` to initialize Supabase client
- [x] Create `app/api/auth/callback/route.ts` for callback handling

**Acceptance Criteria:**
- Package installed successfully
- Environment variables set
- Supabase client initialized
- No build errors

**Files to Create:**
- `frontend/.env.local`
- `frontend/src/lib/supabase.ts`
- `frontend/app/api/auth/callback/route.ts`

---

### Task 2.2: Set Up Supabase Auth Context
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 1 hour  
**Status:** ✅ Completed

**Description:**
Create and configure Supabase authentication context provider.

**Subtasks:**
- [x] Create `contexts/AuthContext.tsx`
- [x] Use Supabase `createBrowserClient()` for auth (from @supabase/ssr)
- [x] Create `AuthProvider` component
- [x] Update `app/layout.tsx` to wrap with `<AuthProvider>`
- [x] Test user context accessibility
- [x] Handle loading states
- [x] Handle error states

**Acceptance Criteria:**
- AuthProvider wraps entire app
- User context accessible in all components
- Loading states handled gracefully

**Files to Create:**
- `frontend/src/contexts/AuthContext.tsx`

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
- [x] Create `app/sign-in/page.tsx`
- [x] Add "Sign In" heading
- [x] Add email/password form (uses Supabase auth)
- [x] Add social login buttons (Google, Facebook, Apple) using Supabase OAuth
- [x] Add "Don't have an account?" link to sign-up
- [x] Add "Forgot password?" link
- [x] Style to match Rekindle brand
- [x] Make mobile responsive
- [x] Add loading states
- [ ] Test all login methods
- [ ] `Implement Forgot Password page`

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
- [x] Create `app/sign-up/page.tsx`
- [x] Add "Get Started Free" heading
- [x] Add "3 free credits" value proposition
- [x] Add email/password form (uses Supabase auth)
- [x] Add social signup buttons (using Supabase OAuth)
- [x] Add "Already have an account?" link
- [x] Add terms of service checkbox
- [x] Style to match Rekindle brand
- [x] Make mobile responsive
- [ ] Test all signup methods
- [ ] `Implement Terms of Service page`
- [ ] `Implement Privacy Policy page`

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
- [x] Create `middleware.ts`
- [x] Use Supabase `createMiddlewareClient()` for auth checks
- [x] Define protected route patterns:
  - /dashboard/*
  - /photos/*
  - /settings/*
- [x] Check user session using Supabase auth
- [x] Add redirect to /sign-in if unauthenticated
- [x] Test protection on all routes
- [x] Handle loading states
- [x] Add public routes exception

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
- [ ] Use Supabase `useSession()` or auth context
- [ ] Fetch user from Supabase auth session
- [ ] Fetch additional user profile from backend API (if needed)
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
- [ ] Call Supabase `signOut()` method
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
- [ ] Verify JWT signature using Supabase JWKS
- [ ] Extract `supabase_user_id` (or `sub` claim) from token
- [ ] Fetch user from database by Supabase user ID
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
Create endpoint to sync users from Supabase to backend.

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

### Task 3.10: Create Supabase Webhook Handler
**Type:** Backend  
**Priority:** P1  
**Estimated Time:** 3 hours

**Description:**
Create webhook endpoint to handle Supabase events.

**Subtasks:**
- [ ] Create `app/api/webhooks/supabase.py`
- [ ] Implement POST `/webhooks/supabase`
- [ ] Verify webhook signature (Supabase webhook secret)
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
- `backend/app/api/webhooks/supabase.py`

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
- `backend/app/api/webhooks/supabase.py`

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
- [ ] Trigger Supabase email change using `updateUser()`
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
- [ ] Trigger Supabase password change using `updateUser()`
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
- [ ] Fetch active sessions from Supabase (or backend session management)
- [ ] Display session details (device, location, last active)
- [ ] Add "Revoke" button for each session
- [ ] Add "Revoke all others" button
- [ ] Confirm revocation
- [ ] Test session management

**Note:** Supabase handles session management automatically. You may need to track sessions in your backend or use Supabase's session management features.

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
- [ ] Handle fallback to Supabase login
- [ ] Add error states
- [ ] Test on mobile devices

**Acceptance Criteria:**
- QR scan opens correct page
- Biometric prompt shown
- Authentication successful
- Temporary JWT stored
- Fallback to Supabase login works
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
- [ ] Test Supabase webhook handling
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

### Task 7.3a: Write AuthContext Unit Tests
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 4 hours

**Description:**
Write comprehensive unit tests for AuthContext authentication logic.

**Subtasks:**
- [ ] Test initial state (loading, no user)
- [ ] Test sign in with email/password (success)
- [ ] Test sign in with email/password (invalid credentials)
- [ ] Test sign in with email/password (network error)
- [ ] Test sign up with email/password (success)
- [ ] Test sign up with email/password (weak password)
- [ ] Test sign up with email/password (email already exists)
- [ ] Test sign up with email/password (includes metadata)
- [ ] Test sign out (clears session)
- [ ] Test sign out (clears sessionStorage)
- [ ] Test sign out (clears cookies via Supabase)
- [ ] Test sign out uses `scope: 'local'`
- [ ] Test OAuth sign in (Google) - initiates flow
- [ ] Test OAuth sign in (Facebook) - initiates flow
- [ ] Test OAuth sign in (Apple) - initiates flow
- [ ] Test OAuth sign in includes `prompt: 'select_account'`
- [ ] Test OAuth sign in stores original hostname in sessionStorage
- [ ] Test OAuth redirect URL uses same protocol (HTTP/HTTPS)
- [ ] Test accept terms (updates user metadata)
- [ ] Test accept terms (redirects after acceptance)
- [ ] Test session refresh
- [ ] Test auth state change listener (SIGNED_IN)
- [ ] Test auth state change listener (SIGNED_OUT)
- [ ] Test auth state change listener (TOKEN_REFRESHED)
- [ ] Test error handling and state management
- [ ] Test loading states during auth operations
- [ ] Mock Supabase client properly
- [ ] Mock Next.js router
- [ ] Aim for 90%+ coverage

**Acceptance Criteria:**
- 90%+ code coverage for AuthContext
- All authentication methods tested
- Success and error paths tested
- OAuth flow initiation tested
- Session management tested
- Tests pass consistently
- No flaky tests

**Files to Create:**
- `frontend/src/contexts/__tests__/AuthContext.test.tsx`

**Test Patterns:**
- Use `renderHook` from `@testing-library/react` for context testing
- Mock Supabase client with `jest.mock('@supabase/ssr')`
- Mock Next.js router with `jest.mock('next/navigation')`
- Test both success and error scenarios
- Verify sessionStorage and cookie clearing

---

### Task 7.3b: Write Sign-In Page Unit Tests
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 3 hours

**Description:**
Write unit tests for the sign-in page component.

**Subtasks:**
- [ ] Test renders sign-in form
- [ ] Test shows email and password fields
- [ ] Test shows "Forgot Password" link
- [ ] Test shows OAuth buttons (Google, Facebook, Apple)
- [ ] Test OAuth buttons appear after email/password form
- [ ] Test email/password form submission (valid)
- [ ] Test email/password form submission (invalid email)
- [ ] Test email/password form submission (missing password)
- [ ] Test displays error messages
- [ ] Test shows loading state during sign-in
- [ ] Test redirects to intended destination after sign-in
- [ ] Test redirects to /upload if no next parameter
- [ ] Test handles OAuth button clicks
- [ ] Test OAuth redirects to correct URL
- [ ] Test form validation (email format)
- [ ] Test form validation (password required)
- [ ] Test error message display and clearing
- [ ] Test link to sign-up page works
- [ ] Test error from query params (OAuth callback errors)
- [ ] Test responsive design (mobile/desktop)
- [ ] Mock AuthContext properly
- [ ] Mock Next.js router
- [ ] Use `@testing-library/user-event` for interactions
- [ ] Aim for 85%+ coverage

**Acceptance Criteria:**
- 85%+ code coverage for sign-in page
- All form interactions tested
- OAuth button clicks tested
- Error handling tested
- Redirect behavior tested
- Tests pass consistently

**Files to Create:**
- `frontend/src/app/sign-in/__tests__/page.test.tsx`

**Test Patterns:**
- Use `render` and `screen` from `@testing-library/react`
- Use `userEvent` for form interactions
- Mock `useAuth` hook from AuthContext
- Test form submission with `fireEvent.submit`
- Verify redirects with mocked router

---

### Task 7.3c: Write Sign-Up Page Unit Tests
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 3 hours

**Description:**
Write unit tests for the sign-up page component.

**Subtasks:**
- [ ] Test renders sign-up form
- [ ] Test shows email, password, and confirm password fields
- [ ] Test shows terms of service checkbox
- [ ] Test terms checkbox appears before OAuth buttons
- [ ] Test terms checkbox is required for email/password sign-up
- [ ] Test OAuth buttons are not disabled by terms checkbox
- [ ] Test shows notice about terms for OAuth sign-up
- [ ] Test email/password form submission (valid)
- [ ] Test email/password form submission (password mismatch)
- [ ] Test email/password form submission (weak password)
- [ ] Test email/password form submission (email already exists)
- [ ] Test email/password form submission (terms not accepted)
- [ ] Test displays error messages
- [ ] Test shows loading state during sign-up
- [ ] Test redirects to success page after sign-up
- [ ] Test handles OAuth button clicks
- [ ] Test OAuth redirects to correct URL
- [ ] Test form validation (email format)
- [ ] Test form validation (password match)
- [ ] Test form validation (password strength)
- [ ] Test form validation (terms required)
- [ ] Test error message display and clearing
- [ ] Test link to sign-in page works
- [ ] Test error from query params (OAuth callback errors)
- [ ] Test responsive design (mobile/desktop)
- [ ] Mock AuthContext properly
- [ ] Mock Next.js router
- [ ] Use `@testing-library/user-event` for interactions
- [ ] Aim for 85%+ coverage

**Acceptance Criteria:**
- 85%+ code coverage for sign-up page
- All form interactions tested
- Terms checkbox behavior tested
- OAuth button clicks tested
- Error handling tested
- Redirect behavior tested
- Tests pass consistently

**Files to Create:**
- `frontend/src/app/sign-up/__tests__/page.test.tsx`

**Test Patterns:**
- Use `render` and `screen` from `@testing-library/react`
- Use `userEvent` for form interactions
- Mock `useAuth` hook from AuthContext
- Test form validation logic
- Verify terms checkbox requirement

---

### Task 7.3d: Write OAuth Callback Page Unit Tests
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 3 hours

**Description:**
Write unit tests for the OAuth callback page component.

**Subtasks:**
- [ ] Test renders loading state initially
- [ ] Test handles OAuth callback with code
- [ ] Test handles OAuth callback with error
- [ ] Test exchanges code for session
- [ ] Test redirects to accept-terms if user hasn't accepted
- [ ] Test redirects to intended destination if terms accepted
- [ ] Test handles redirect from 127.0.0.1 to original hostname (mobile)
- [ ] Test uses sessionStorage to restore original hostname
- [ ] Test handles existing session (doesn't re-exchange code)
- [ ] Test handles missing code parameter
- [ ] Test handles exchange errors
- [ ] Test preserves next parameter in redirect
- [ ] Test shows appropriate error messages
- [ ] Test handles PKCE code verifier from cookies
- [ ] Test uses getSupabaseClient from AuthContext
- [ ] Test Suspense boundary works correctly
- [ ] Mock Supabase client properly
- [ ] Mock Next.js router and searchParams
- [ ] Mock window.location and sessionStorage
- [ ] Aim for 80%+ coverage

**Acceptance Criteria:**
- 80%+ code coverage for OAuth callback page
- All callback scenarios tested
- Mobile redirect handling tested
- Terms check redirect tested
- Error handling tested
- Tests pass consistently

**Files to Create:**
- `frontend/src/app/auth/callback/__tests__/page.test.tsx`

**Test Patterns:**
- Use `render` and `waitFor` from `@testing-library/react`
- Mock `useSearchParams` from Next.js
- Mock `getSupabaseClient` from AuthContext
- Test code exchange with mocked Supabase
- Verify redirects with mocked router
- Test sessionStorage interactions

---

### Task 7.3e: Write Accept Terms Page Unit Tests
**Type:** Frontend  
**Priority:** P1  
**Estimated Time:** 2 hours

**Description:**
Write unit tests for the accept terms page component.

**Subtasks:**
- [ ] Test renders terms acceptance form
- [ ] Test shows terms and privacy policy links
- [ ] Test requires checkbox to be checked
- [ ] Test accepts terms and updates user metadata
- [ ] Test redirects to intended destination after acceptance
- [ ] Test redirects unauthenticated users to sign-in
- [ ] Test redirects users who already accepted terms
- [ ] Test shows loading state during acceptance
- [ ] Test displays error messages
- [ ] Test preserves next parameter in redirect
- [ ] Test checkbox interaction
- [ ] Mock AuthContext properly
- [ ] Mock Next.js router
- [ ] Use `@testing-library/user-event` for interactions
- [ ] Aim for 80%+ coverage

**Acceptance Criteria:**
- 80%+ code coverage for accept terms page
- All user interactions tested
- Redirect behavior tested
- Error handling tested
- Tests pass consistently

**Files to Create:**
- `frontend/src/app/auth/accept-terms/__tests__/page.test.tsx`

**Test Patterns:**
- Use `render` and `screen` from `@testing-library/react`
- Use `userEvent` for checkbox interactions
- Mock `useAuth` hook from AuthContext
- Test redirects with mocked router
- Verify terms acceptance updates user metadata

---

### Task 7.3f: Write RequireAuth Component Unit Tests
**Type:** Frontend  
**Priority:** P0  
**Estimated Time:** 2 hours

**Description:**
Write unit tests for the RequireAuth component that protects routes.

**Subtasks:**
- [ ] Test renders children when user is authenticated
- [ ] Test redirects to sign-in when user is not authenticated
- [ ] Test preserves intended destination in next parameter
- [ ] Test shows loading state while checking auth
- [ ] Test handles auth loading state
- [ ] Test works with different protected routes
- [ ] Test preserves pathname in redirect
- [ ] Mock AuthContext properly
- [ ] Mock Next.js router
- [ ] Test with different user states (authenticated, unauthenticated, loading)
- [ ] Aim for 90%+ coverage

**Acceptance Criteria:**
- 90%+ code coverage for RequireAuth component
- All authentication states tested
- Redirect behavior tested
- Loading states tested
- Tests pass consistently

**Files to Create:**
- `frontend/src/components/__tests__/RequireAuth.test.tsx`

**Test Patterns:**
- Use `render` from `@testing-library/react`
- Mock `useAuth` hook from AuthContext
- Test with different user states
- Verify redirects with mocked router
- Test loading state rendering

---

### Task 7.3g: Write UserMenu Component Unit Tests
**Type:** Frontend  
**Priority:** P1  
**Estimated Time:** 2 hours

**Description:**
Write unit tests for the UserMenu component.

**Subtasks:**
- [ ] Test renders user menu when authenticated
- [ ] Test shows user name and email
- [ ] Test shows profile picture
- [ ] Test opens dropdown on click
- [ ] Test closes dropdown on outside click
- [ ] Test sign out button triggers signOut
- [ ] Test sign out redirects to landing page
- [ ] Test handles sign out errors gracefully
- [ ] Test doesn't render when not authenticated
- [ ] Test doesn't render when loading
- [ ] Mock AuthContext properly
- [ ] Mock Next.js router
- [ ] Use `@testing-library/user-event` for interactions
- [ ] Aim for 85%+ coverage

**Acceptance Criteria:**
- 85%+ code coverage for UserMenu component
- All user interactions tested
- Sign out functionality tested
- Conditional rendering tested
- Tests pass consistently

**Files to Create:**
- `frontend/src/components/__tests__/UserMenu.test.tsx`

**Test Patterns:**
- Use `render` and `screen` from `@testing-library/react`
- Use `userEvent` for click interactions
- Mock `useAuth` hook from AuthContext
- Test dropdown open/close behavior
- Verify sign out calls and redirects

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
- [ ] Document Supabase configuration
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
- [ ] Verify Supabase production project configured
- [ ] Verify social OAuth apps in production mode
- [ ] Verify callback URLs correct (including production redirect URLs)
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
- Frontend: 35 tasks (44%)
- Backend: 30 tasks (38%)
- Infrastructure: 14 tasks (18%)

**By Priority:**
- P0 (Critical): 48 tasks
- P1 (High): 22 tasks
- P2 (Medium): 4 tasks

### Timeline Estimate

- **Fastest:** 6 weeks (with 2 developers, parallel work)
- **Realistic:** 7 weeks (with 1-2 developers)
- **Conservative:** 8-9 weeks (with blockers/unknowns)

### Dependencies

Critical path:
1. Phase 1 (Supabase Setup) → Phase 2 (Frontend Auth)
2. Phase 1 (Supabase Setup) → Phase 3 (Backend Auth)
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
- Supabase account (free tier: 50,000 MAU)
- Email service (Supabase included, or custom SMTP)
- Testing tools (Jest, Pytest, Playwright)

---

**Document Status:** ✅ Ready for Implementation  
**Last Updated:** October 21, 2025  
**Next Step:** Begin Phase 1 - Supabase Setup

