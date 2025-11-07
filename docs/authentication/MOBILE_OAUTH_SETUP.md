# Setting Up OAuth for Mobile Device Access

## Overview

This guide explains how to set up OAuth (Google, Facebook, Apple) for testing on mobile devices during local development.

**Note:** If you don't need to test OAuth on mobile devices, you can:
- Use **email/password authentication** on mobile devices
- Test **OAuth on desktop** where `localhost` works fine

This is often the simplest approach for development.

## The Problem

When accessing your app from a mobile device using your local IP address (e.g., `192.168.2.121:3000`), OAuth with Google doesn't work because:

1. **Google Cloud Console doesn't allow IP addresses in redirect URIs** - You'll get an error: "Invalid Redirect: must end with a public top-level domain"
2. Supabase needs to be accessible from your mobile device
3. The OAuth flow needs to use the correct URLs for both Supabase and your app

## The Solution

If you need to test OAuth on mobile devices, you have two options:

### Option 1: Use ngrok (Recommended for Mobile OAuth Testing)

ngrok creates a public URL that tunnels to your local server. This is the **recommended approach** for testing OAuth on mobile devices.

**📖 See `NGROK_SETUP.md` for detailed setup instructions.**

#### Quick Setup Summary

1. **Install ngrok:**
   ```bash
   # macOS
   brew install ngrok
   
   # Linux
   snap install ngrok
   ```

2. **Start two ngrok tunnels** (in separate terminals):
   ```bash
   # Terminal 1: App tunnel
   ngrok http 3000
   
   # Terminal 2: Supabase tunnel
   ngrok http 54321
   ```

3. **Get your ngrok URLs:**
   - App: `https://abc123.ngrok.io` (from Terminal 1)
   - Supabase: `https://def456.ngrok.io` (from Terminal 2)

4. **Add to Google Cloud Console:**
   - `https://def456.ngrok.io/auth/v1/callback` (Supabase URL)

5. **Update `supabase/config.toml`:**
   - Add `https://abc123.ngrok.io/auth/callback` (App URL)

6. **Restart Supabase:**
   ```bash
   supabase stop && supabase start
   ```

7. **Test from mobile device:**
   - Navigate to `https://abc123.ngrok.io`

**⚠️ Important:** ngrok URLs change each time you restart ngrok. You'll need to update Google Cloud Console and Supabase config each time (unless you have a paid plan with static URLs).

### Option 2: Use a Local Domain Name with mkcert (⚠️ **Won't Work with Google Cloud Console**)

**Important:** Google Cloud Console **does not accept `.local` domains** because they're not public top-level domains. Google only accepts:
- `localhost` and `127.0.0.1` (for local development)
- Real public domains (`.com`, `.org`, etc.)
- ngrok URLs (which are real public domains)

**This option won't work for OAuth with Google.** You'll need to use **Option 1 (ngrok)** or use a real domain you own.

If you want to use mkcert with a real domain, you can:
1. Use a domain you own (e.g., `dev.rekindle.app`)
2. Point it to your local IP using DNS or `/etc/hosts`
3. Generate mkcert certificates for that domain
4. Add the domain to Google Cloud Console

**Note:** The `.local` domain approach is useful for local DNS resolution and HTTPS certificates, but it won't work with Google OAuth because Google requires public domains.

#### Step 1: Set Up Local DNS

**On macOS/Linux:**

1. Edit `/etc/hosts`:
   ```bash
   sudo nano /etc/hosts
   ```

2. Add these lines (replace `192.168.2.121` with your local IP):
   ```
   192.168.2.121  rekindle.local
   192.168.2.121  rekindle-supabase.local
   ```

3. Save and exit

**On Windows:**

1. Open Notepad as Administrator
2. Open `C:\Windows\System32\drivers\etc\hosts`
3. Add these lines (replace `192.168.2.121` with your local IP):
   ```
   192.168.2.121  rekindle.local
   192.168.2.121  rekindle-supabase.local
   ```
4. Save

#### Step 2: Generate mkcert Certificates for Local Domain

Since you're already using mkcert, generate certificates for the local domain:

```bash
cd certs
mkcert rekindle.local rekindle-supabase.local
# This will create rekindle.local+1.pem and rekindle.local+1-key.pem
# Copy them to cert.pem and key.pem if needed, or update your HTTPS server to use them
cd ..
```

**Note:** If your HTTPS server is already configured to use mkcert certificates, you may need to update it to include the local domain names, or regenerate certificates to include them.

#### Step 3: Configure Your Mobile Device

**On iOS:**
- Settings → Wi-Fi → Your network → Configure DNS → Manual
- Add your computer's IP address as a DNS server

**On Android:**
- Settings → Wi-Fi → Long press your network → Modify network → Advanced → IP settings → Static
- DNS 1: Your computer's IP address

**Alternative:** Use a DNS service like `dnsmasq` or `Pi-hole` on your network.

#### Step 4: Add Redirect URI to Google Cloud Console

**⚠️ This won't work!** Google Cloud Console doesn't accept `.local` domains.

If you're using a real domain (not `.local`), then:
1. Go to https://console.cloud.google.com/
2. Navigate to: **APIs & Services → Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   - `https://your-real-domain.com:54321/auth/v1/callback` (if Supabase supports HTTPS)
   - OR `http://your-real-domain.com:54321/auth/v1/callback` (if Supabase is HTTP only)
   - **Important:** This is Supabase's callback URL (port `54321`), not your app's callback URL (port `3000`)
   - **Important:** Use `https://` if you have HTTPS set up for Supabase, otherwise use `http://`
   - **Important:** No trailing slash
5. Click **Save**

**For `.local` domains:** You'll need to use **Option 1 (ngrok)** instead, as Google doesn't accept `.local` domains.

#### Step 5: Update Supabase Config

Add the local domain URLs to `supabase/config.toml`:

```toml
[auth]
additional_redirect_urls = [
  # ... existing URLs ...
  "http://rekindle.local:3000/auth/callback",
  "https://rekindle.local:3000/auth/callback",
]
```

#### Step 6: Install mkcert Certificate on Mobile Device

For HTTPS to work on your mobile device, you need to install the mkcert root certificate:

**On iOS:**
1. Transfer the root certificate to your device (email, AirDrop, etc.)
   - The certificate is usually at: `$(mkcert -CAROOT)/rootCA.pem`
   - Or find it with: `mkcert -CAROOT`
2. Open the certificate file on your device
3. Go to Settings → General → About → Certificate Trust Settings
4. Enable trust for the root certificate

**On Android:**
1. Transfer the root certificate to your device
2. Go to Settings → Security → Install from storage
3. Select the certificate file
4. Name it (e.g., "mkcert Root CA")
5. Select "VPN and apps" as the usage

#### Step 7: Access Your App

1. On your mobile device, navigate to: `https://rekindle.local:3000` (or `http://` if not using HTTPS)
2. The OAuth flow should now work with the local domain

#### Step 8: Restart Supabase

After making changes, restart Supabase:

```bash
supabase stop
supabase start
```

#### Step 9: Test OAuth Flow

1. On your mobile device, navigate to your app (via ngrok URL or local domain)
2. Click "Sign in with Google"
3. You should be redirected to Google OAuth
4. After authentication, you should be redirected back to your app

## Troubleshooting

### Still Redirecting to 127.0.0.1:54321?

If you're being redirected to `127.0.0.1:54321/auth/v1/callback` instead of Google OAuth:

1. **Check browser console logs** - Look for OAuth errors
2. **Verify Google OAuth credentials** - Make sure `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` are set
3. **Check the redirect URI** - Make sure it matches exactly what's in Google Cloud Console

### Supabase Not Accessible from Mobile?

If Supabase isn't accessible from your mobile device:

1. **Check firewall** - Make sure port `54321` is open
2. **Check network** - Make sure your mobile device is on the same network
3. **Check Supabase binding** - Supabase might only be listening on `localhost` - you may need to configure it to listen on `0.0.0.0`

### OAuth Redirects to Wrong URL?

If OAuth redirects to `127.0.0.1:3000` instead of `192.168.2.121:3000`:

1. The callback page should automatically redirect from `127.0.0.1` to the original hostname
2. Check browser console for redirect logs
3. Make sure `sessionStorage` is enabled (not in private/incognito mode)

## Important Notes

- **Google Cloud Console doesn't allow IP addresses** - You must use a domain name (ngrok URL or local domain)
- **Google Cloud Console** needs the Supabase callback URL (`:54321`)
- **Supabase config** needs your app's callback URL (`:3000`)
- **Both must match** the URLs you're actually using
- **ngrok URLs change** - If using ngrok, you'll need to update Google Cloud Console each time you restart ngrok (unless you have a paid plan with a static URL)
- **Local domains are persistent** - Once set up, local domains don't change unless you modify your hosts file

