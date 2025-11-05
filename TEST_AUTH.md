# Testing Authentication - Manual Testing Guide

## Quick Start

1. **Access Sign-In Page:**
   - Open: http://localhost:3000/sign-in
   - You should see the sign-in page with email/password form and social login buttons

2. **Access Supabase Studio:**
   - Open: http://localhost:54323
   - This is where you can view/manage users and test authentication

---

## Step-by-Step Testing

### Step 1: Create a Test User

You have two options:

#### Option A: Create User via Supabase Studio (Recommended)

1. Open http://localhost:54323
2. Navigate to **Authentication** → **Users** in the left sidebar
3. Click **"Add user"** button (top right)
4. Choose **"Create user"** tab
5. Fill in:
   - **Email:** `test@example.com` (or any email)
   - **Password:** `TestPassword123!` (must meet requirements)
   - **Auto Confirm User:** ✅ Check this (so you don't need email verification)
6. Click **"Create user"**
7. User is created and ready to use!

#### Option B: Create User via Sign-Up Page (If Implemented)

1. Go to http://localhost:3000/sign-up (if this page exists)
2. Fill in email and password
3. Submit the form
4. Check Supabase Studio to see the new user

---

### Step 2: Test Email/Password Sign-In

1. **Open Sign-In Page:**
   - Go to: http://localhost:3000/sign-in

2. **Enter Credentials:**
   - Email: `test@example.com` (or the email you created)
   - Password: `TestPassword123!` (or the password you set)

3. **Click "Sign In"**

4. **Expected Behavior:**
   - ✅ Button shows "Signing in..." with spinner
   - ✅ On success: Redirects to `/dashboard` (or shows error if dashboard doesn't exist yet)
   - ✅ On failure: Shows error message in red box

5. **Verify Success:**
   - Open browser **Developer Tools** (F12)
   - Go to **Console** tab
   - Look for: `Auth state changed` or similar Supabase logs
   - Check **Application** → **Local Storage** → Look for Supabase session tokens
   - Check **Network** tab → Look for successful API calls to Supabase

---

### Step 3: Test OAuth Sign-In (Google/Facebook/Apple)

**Note:** OAuth providers must be configured in Supabase first (Task 1.2).

1. **Click Social Login Button:**
   - Click "Continue with Google" (or Facebook/Apple)

2. **Expected Behavior:**
   - ✅ Redirects to OAuth provider (Google/Facebook/Apple)
   - ✅ After authorization, redirects back to `/auth/callback`
   - ✅ Then redirects to `/dashboard` (or home)

3. **Verify Success:**
   - Check Supabase Studio → Authentication → Users
   - New user should appear with email from OAuth provider
   - Check browser console for auth state changes

---

### Step 4: Test Error Handling

#### Test Invalid Credentials:

1. Go to http://localhost:3000/sign-in
2. Enter wrong email/password
3. Click "Sign In"
4. **Expected:** Error message in red box: "Invalid login credentials"

#### Test Missing Fields:

1. Leave email or password empty
2. Try to submit
3. **Expected:** Browser validation prevents submission (HTML5 required attribute)

#### Test Loading States:

1. Enter valid credentials
2. Click "Sign In"
3. **Expected:** Button shows spinner and "Signing in..." text
4. Button should be disabled during loading

---

### Step 5: Verify Auth Context

The AuthContext should be working throughout the app. Here's how to verify:

1. **Open Browser Console** (F12)
2. **After Sign-In**, type in console:
   ```javascript
   // Check if auth is available (you can add this to your code temporarily)
   // Or check localStorage for Supabase tokens
   localStorage.getItem('sb-localhost-54321-auth-token')
   ```

3. **Check Auth State:**
   - The `useAuth()` hook should provide:
     - `user` - User object (null if not logged in)
     - `session` - Session object
     - `loading` - Loading state
     - `error` - Error object

4. **Test Session Persistence:**
   - Sign in successfully
   - Refresh the page (F5)
   - User should remain logged in (session persists)

---

### Step 6: Test Protected Routes

**Note:** Protected routes middleware (Task 2.5) may not be implemented yet.

1. **Try to Access Protected Route:**
   - Go to http://localhost:3000/dashboard (if it exists)
   - If not logged in: Should redirect to `/sign-in`
   - If logged in: Should show dashboard

2. **Test Redirect:**
   - Go to http://localhost:3000/dashboard?next=/gallery
   - Sign in
   - Should redirect to `/gallery` after login (not `/dashboard`)

---

### Step 7: Test Sign-Out

**Note:** Sign-out functionality (Task 2.9) may not be implemented yet.

1. After signing in, look for a "Sign Out" button
2. Click it
3. **Expected:**
   - Session cleared
   - Redirected to home page
   - User is null in auth context

---

## Troubleshooting

### Issue: "Failed to sign in" Error

**Check:**
1. Is Supabase running? `supabase status`
2. Are environment variables set correctly?
   - `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` should be set
3. Check browser console for detailed errors
4. Check Docker logs: `docker compose logs frontend`

### Issue: OAuth Not Working

**Check:**
1. Are OAuth providers configured in Supabase?
   - Go to Supabase Studio → Authentication → Providers
   - Google/Facebook/Apple should be enabled
2. Check redirect URLs are configured correctly
3. Check browser console for OAuth errors

### Issue: Redirect Loop

**Check:**
1. Is `/auth/callback` route working?
2. Check if middleware is causing issues
3. Check browser console for redirect errors

### Issue: Session Not Persisting

**Check:**
1. Check browser localStorage for Supabase tokens
2. Check if cookies are being set (Application → Cookies)
3. Verify Supabase client is configured correctly

---

## Quick Test Checklist

- [ ] Sign-in page loads at http://localhost:3000/sign-in
- [ ] Can create test user in Supabase Studio
- [ ] Email/password sign-in works
- [ ] Error messages display correctly
- [ ] Loading states work during sign-in
- [ ] Session persists after page refresh
- [ ] OAuth buttons work (if configured)
- [ ] Sign-out works (if implemented)
- [ ] Protected routes redirect to sign-in (if implemented)

---

## Useful Commands

```bash
# Check Supabase status
supabase status

# View Supabase Studio
open http://localhost:54323

# Check frontend logs
docker compose logs frontend

# Check Supabase logs
supabase logs

# View users in Supabase
# (Open Supabase Studio → Authentication → Users)
```

---

## Next Steps

After verifying basic auth works:

1. **Test Sign-Up Page** (Task 2.4) - Create users via sign-up form
2. **Test Protected Routes** (Task 2.5) - Verify middleware works
3. **Test Session Management** - Verify sessions persist correctly
4. **Test OAuth Providers** - Configure and test Google/Facebook/Apple
5. **Test Password Reset** - Test forgot password flow

