# ngrok Setup Guide for Mobile OAuth Testing

## Overview

ngrok is used to create public URLs that tunnel to your local development server. This is required for testing OAuth with Google on mobile devices because Google Cloud Console doesn't accept IP addresses or `.local` domains in redirect URIs.

## Installation

### macOS

```bash
brew install ngrok
```

### Linux

**Option 1: Using snap (recommended)**
```bash
snap install ngrok
```

**Option 2: Manual installation**
1. Download from https://ngrok.com/download
2. Extract the binary
3. Move to a directory in your PATH:
   ```bash
   sudo mv ngrok /usr/local/bin/
   ```

### Windows

1. Download from https://ngrok.com/download
2. Extract `ngrok.exe` to a directory in your PATH
3. Or use Chocolatey: `choco install ngrok`

### Verify Installation

```bash
ngrok version
```

You should see the ngrok version number.

## Quick Start

### Step 1: Start Your Development Environment

Make sure your app and Supabase are running:

```bash
./dev start
```

Or if using HTTPS:
```bash
./dev start --https
```

### Step 2: Start ngrok Tunnels

You need **two separate terminal windows** for ngrok:

**Terminal 1 - App Tunnel (port 3000):**
```bash
ngrok http 3000
```

**Terminal 2 - Supabase Tunnel (port 54321):**
```bash
ngrok http 54321
```

### Step 3: Get Your ngrok URLs

After starting ngrok, you'll see output like:

```
Forwarding   https://abc123.ngrok.io -> http://localhost:3000
Forwarding   http://abc123.ngrok.io -> http://localhost:3000
```

**Important:** Note down the **HTTPS URLs** (not HTTP):
- App URL: `https://abc123.ngrok.io` (from Terminal 1)
- Supabase URL: `https://def456.ngrok.io` (from Terminal 2)

### Step 4: Configure Google Cloud Console

1. Go to https://console.cloud.google.com/
2. Navigate to: **APIs & Services → Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   - `https://def456.ngrok.io/auth/v1/callback` (use your **Supabase** ngrok URL)
   - **Important:** This is Supabase's callback URL (port `54321`), not your app's callback URL (port `3000`)
   - **Important:** Use `https://` (ngrok provides HTTPS)
   - **Important:** No trailing slash
5. Click **Save**

### Step 5: Update Supabase Config

Add the app ngrok URL to `supabase/config.toml`:

```toml
[auth]
additional_redirect_urls = [
  # ... existing URLs ...
  "https://abc123.ngrok.io/auth/callback",
]
```

**Important:** Replace `abc123.ngrok.io` with your actual app ngrok URL from Terminal 1.

### Step 6: Restart Supabase

After updating the config:

```bash
supabase stop
supabase start
```

### Step 7: Test OAuth from Mobile Device

1. On your mobile device, open a browser
2. Navigate to your app ngrok URL: `https://abc123.ngrok.io`
3. Click "Sign in with Google"
4. The OAuth flow should now work!

## Important Notes

### ngrok URLs Change

⚠️ **ngrok URLs change each time you restart ngrok** (unless you have a paid plan with a static URL).

This means you need to:
1. Update Google Cloud Console with the new Supabase ngrok URL
2. Update `supabase/config.toml` with the new app ngrok URL
3. Restart Supabase

### Free vs Paid ngrok

**Free Plan:**
- URLs change on each restart
- Limited connections per minute
- Good for testing

**Paid Plan:**
- Static URLs (don't change)
- Better performance
- More connections

For development, the free plan is usually sufficient.

### Keeping ngrok Running

Keep both ngrok terminals running while testing. If you close them, the URLs will stop working.

## Troubleshooting

### ngrok Not Starting

**Error: "command not found"**
- Make sure ngrok is installed and in your PATH
- Try: `which ngrok` to verify location

**Error: "port already in use"**
- Make sure your app/Supabase is running on the correct ports
- Check: `lsof -i :3000` and `lsof -i :54321`

### OAuth Still Not Working

1. **Verify ngrok URLs are correct:**
   - Check both terminals show "Forwarding" status
   - Verify you're using HTTPS URLs (not HTTP)

2. **Check Google Cloud Console:**
   - Make sure the Supabase ngrok URL is added
   - Verify it matches exactly (including `https://` and no trailing slash)

3. **Check Supabase config:**
   - Verify the app ngrok URL is in `additional_redirect_urls`
   - Restart Supabase after changes

4. **Check browser console:**
   - Look for OAuth errors
   - Verify the redirect URL matches what's in Google Cloud Console

### ngrok Connection Issues

If ngrok disconnects frequently:
- Check your internet connection
- Free plan has connection limits - consider upgrading if needed
- Try restarting ngrok

## Team Workflow

### For Each Developer

1. **Install ngrok** (one-time setup)
2. **Start your dev environment** (`./dev start`)
3. **Start ngrok tunnels** (two terminals)
4. **Update Google Cloud Console** with your Supabase ngrok URL
5. **Update `supabase/config.toml`** with your app ngrok URL
6. **Restart Supabase**
7. **Test OAuth from mobile device**

### Sharing ngrok URLs

If multiple developers are testing:
- Each developer needs their own ngrok URLs
- Each developer needs to update Google Cloud Console with their Supabase ngrok URL
- Consider using a shared Google Cloud Console OAuth client with multiple redirect URIs

### Git Considerations

**Do NOT commit:**
- ngrok URLs in `supabase/config.toml` (they change frequently)
- Personal ngrok URLs

**Do commit:**
- This setup guide
- General ngrok configuration (if any)

## Alternative: Using ngrok Config File

You can create an `ngrok.yml` config file to make setup easier:

```yaml
version: "2"
authtoken: YOUR_NGROK_AUTH_TOKEN  # Get from https://dashboard.ngrok.com/get-started/your-authtoken
tunnels:
  app:
    addr: 3000
    proto: http
  supabase:
    addr: 54321
    proto: http
```

Then start both tunnels with:
```bash
ngrok start --all
```

## Quick Reference

```bash
# Start app tunnel
ngrok http 3000

# Start Supabase tunnel
ngrok http 54321

# Check ngrok status
curl http://localhost:4040/api/tunnels  # Shows active tunnels

# Stop ngrok
Ctrl+C in the ngrok terminal
```

## Next Steps

After setting up ngrok:
1. Test OAuth from your mobile device
2. Verify the flow works end-to-end
3. See `MOBILE_OAUTH_SETUP.md` for more details
4. See `PRODUCTION_OAUTH_SETUP.md` for production setup

