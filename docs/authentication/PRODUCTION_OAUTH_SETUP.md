# OAuth Setup for Production (Mobile Devices)

## Overview

In production, OAuth with Google works much more simply than in local development because you'll have:
- A real domain name (e.g., `rekindle.app` or `app.rekindle.com`)
- Real SSL certificates (from Let's Encrypt or your certificate authority)
- Cloud-hosted Supabase (not local Supabase)
- Standard HTTPS URLs that Google Cloud Console accepts

## How OAuth Works in Production

### The OAuth Flow

1. **User clicks "Sign in with Google"** on your production app (e.g., `https://rekindle.app`)
2. **Your app calls Supabase OAuth** with `redirectTo: https://rekindle.app/auth/callback`
3. **Supabase redirects to Google** with `redirect_uri: https://[your-project-id].supabase.co/auth/v1/callback`
4. **User authenticates with Google**
5. **Google redirects back to Supabase** at `https://[your-project-id].supabase.co/auth/v1/callback?code=...`
6. **Supabase processes the OAuth** and redirects to your app at `https://rekindle.app/auth/callback?code=...`
7. **Your app exchanges the code** for a session and the user is signed in

### Key Differences from Local Development

| Aspect | Local Development | Production |
|--------|-------------------|------------|
| **Domain** | `localhost`, `127.0.0.1`, or local domain (`rekindle.local`) | Real domain (`rekindle.app`) |
| **SSL Certificate** | mkcert (self-signed) | Let's Encrypt or commercial CA |
| **Supabase** | Local (`localhost:54321`) | Cloud (`[project-id].supabase.co`) |
| **Google Cloud Console** | Needs local domain or ngrok URL | Needs production Supabase URL |
| **Mobile Access** | Requires local network setup | Works from anywhere via internet |

## Production Setup Steps

### Step 1: Configure Google Cloud Console

1. Go to https://console.cloud.google.com/
2. Navigate to: **APIs & Services → Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   - `https://[your-project-id].supabase.co/auth/v1/callback`
   - **Important:** This is your **Supabase cloud** callback URL, not your app's callback URL
   - **Important:** Use `https://` (production always uses HTTPS)
   - **Important:** No trailing slash
   - **Example:** `https://abcdefghijklmnop.supabase.co/auth/v1/callback`
5. Click **Save**

**Note:** You can find your Supabase project ID in the Supabase dashboard URL or project settings.

### Step 2: Configure Supabase Cloud Dashboard

1. Go to https://app.supabase.com/
2. Select your production project
3. Navigate to: **Authentication → URL Configuration**
4. Set **Site URL** to your production domain:
   - `https://rekindle.app` (or your actual domain)
5. Under **Redirect URLs**, add:
   - `https://rekindle.app/auth/callback`
   - `https://rekindle.app/**` (wildcard for all routes, optional)
6. Click **Save**

### Step 3: Update Your App Configuration

In production, your app should use environment variables for Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
```

**Important:** These should be your **Supabase cloud** credentials, not local Supabase credentials.

### Step 4: Deploy Your App

When deploying to production:

1. **Set environment variables** in your hosting platform (Vercel, Netlify, etc.)
2. **Ensure HTTPS is enabled** (most platforms do this automatically)
3. **Verify your domain** is properly configured
4. **Test the OAuth flow** from a mobile device

## Mobile Device Access in Production

### How It Works

In production, mobile devices access your app just like any website:

1. **User opens browser** on mobile device
2. **Navigates to** `https://rekindle.app`
3. **Clicks "Sign in with Google"**
4. **OAuth flow works** exactly as described above
5. **No special configuration needed** - it's just a regular website

### Key Advantages

- ✅ **Works from anywhere** - No need to be on the same network
- ✅ **No certificate installation** - Real SSL certificates work automatically
- ✅ **No DNS configuration** - Real domain names work everywhere
- ✅ **Standard HTTPS** - All browsers trust the certificates
- ✅ **Simpler setup** - No local network configuration needed

## Testing Production OAuth

### Before Going Live

1. **Test with a staging domain** first (e.g., `staging.rekindle.app`)
2. **Configure Google Cloud Console** with staging Supabase URL
3. **Test OAuth flow** from mobile devices
4. **Verify redirect URLs** work correctly
5. **Check error handling** for edge cases

### After Going Live

1. **Monitor OAuth errors** in your application logs
2. **Check Supabase dashboard** for authentication metrics
3. **Test from different devices** and browsers
4. **Verify mobile experience** is smooth

## Common Production Issues

### Issue 1: Redirect URI Mismatch

**Symptom:** Users get "redirect_uri_mismatch" error

**Solution:**
- Verify Google Cloud Console has the correct Supabase callback URL
- Check that the URL matches exactly (including `https://` and no trailing slash)
- Ensure you're using the Supabase cloud URL, not localhost

### Issue 2: Site URL Mismatch

**Symptom:** OAuth works but redirects to wrong URL

**Solution:**
- Check Supabase dashboard → Authentication → URL Configuration
- Verify Site URL matches your production domain
- Ensure Redirect URLs include your callback URL

### Issue 3: CORS Errors

**Symptom:** OAuth fails with CORS errors

**Solution:**
- Verify Supabase URL is correct in your app
- Check that your domain is allowed in Supabase settings
- Ensure HTTPS is used consistently

## Environment-Specific Configuration

### Development (Local)

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
# Google Cloud Console: http://localhost:54321/auth/v1/callback
# Supabase config: http://localhost:3000/auth/callback
```

### Staging

```env
NEXT_PUBLIC_SUPABASE_URL=https://[staging-project-id].supabase.co
# Google Cloud Console: https://[staging-project-id].supabase.co/auth/v1/callback
# Supabase config: https://staging.rekindle.app/auth/callback
```

### Production

```env
NEXT_PUBLIC_SUPABASE_URL=https://[production-project-id].supabase.co
# Google Cloud Console: https://[production-project-id].supabase.co/auth/v1/callback
# Supabase config: https://rekindle.app/auth/callback
```

## Best Practices

1. **Use different OAuth clients** for development, staging, and production
2. **Keep environment variables** separate for each environment
3. **Test OAuth flow** before deploying to production
4. **Monitor authentication errors** in production
5. **Have a fallback** authentication method (email/password)
6. **Document your OAuth setup** for team members

## Summary

In production, OAuth is **much simpler** than local development:

- ✅ Real domain names work everywhere
- ✅ Real SSL certificates work automatically
- ✅ No local network configuration needed
- ✅ Mobile devices work just like desktop browsers
- ✅ Standard HTTPS URLs accepted by Google Cloud Console

The main things to configure:
1. Google Cloud Console → Add Supabase cloud callback URL
2. Supabase Dashboard → Set Site URL and Redirect URLs
3. Your app → Use production Supabase credentials

That's it! The OAuth flow works automatically once these are configured.

