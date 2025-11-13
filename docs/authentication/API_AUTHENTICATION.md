# API Authentication Documentation

## Overview

The Rekindle API supports two types of JWT tokens for authentication:

1. **Supabase Tokens** - Standard authentication tokens issued by Supabase Auth
2. **Cross-Device Tokens** - Temporary tokens for mobile-to-desktop photo uploads

Both token types are verified and validated before allowing access to protected endpoints.

---

## Authentication Methods

### 1. Supabase Authentication (Standard)

**Token Issuer:** `https://[project-id].supabase.co/auth/v1`  
**Algorithm:** RS256 (RSA with SHA-256)  
**Verification:** JWKS (JSON Web Key Set) from Supabase

#### Token Structure

```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT",
    "kid": "ins_..."
  },
  "payload": {
    "sub": "abc123...",  // Supabase user UUID
    "email": "user@example.com",
    "email_verified": true,
    "iat": 1729533600,
    "exp": 1729537200,
    "iss": "https://xxx.supabase.co/auth/v1",
    "aud": "authenticated"
  }
}
```

#### Usage

Include the token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer <supabase-jwt-token>" \
     https://api.rekindle.app/api/v1/users/me
```

#### Example Request

```python
import httpx

headers = {
    "Authorization": f"Bearer {supabase_token}",
    "Content-Type": "application/json"
}

response = httpx.get(
    "https://api.rekindle.app/api/v1/users/me",
    headers=headers
)
```

#### Token Verification Flow

1. Extract token from `Authorization: Bearer <token>` header
2. Decode token header to get key ID (`kid`)
3. Fetch JWKS from `https://[project-id].supabase.co/.well-known/jwks.json`
4. Find matching key in JWKS by `kid`
5. Verify token signature using RS256 algorithm
6. Validate token claims:
   - `iss` (issuer) matches Supabase URL
   - `aud` (audience) is "authenticated"
   - `exp` (expiration) is in the future
7. Extract `sub` claim (Supabase user ID)
8. Look up user in database by `supabase_user_id`
9. Verify user account is active
10. Update `last_login_at` timestamp

---

### 2. Cross-Device Authentication (Temporary)

**Token Issuer:** `rekindle:xdevice`  
**Algorithm:** HS256 (HMAC with SHA-256)  
**Verification:** Symmetric key (`XDEVICE_JWT_SECRET`) + Redis session validation

#### Use Case

Cross-device tokens are used for temporary authentication when:
- A user scans a QR code on desktop to upload photos from mobile
- The mobile device is not logged in to Supabase
- Biometric authentication is used instead of full login

#### Token Structure

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "iss": "rekindle:xdevice",
    "sub": "<user_id>",
    "sid": "<xdevice_session_id>",
    "scope": ["upload:mobile"],
    "exp": <unix_timestamp>,
    "iat": <unix_timestamp>
  }
}
```

#### Usage

Include the token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer <cross-device-jwt-token>" \
     https://api.rekindle.app/api/v1/photos/upload
```

#### Example Request

```python
import httpx

headers = {
    "Authorization": f"Bearer {cross_device_token}",
    "Content-Type": "multipart/form-data"
}

files = {"file": open("photo.jpg", "rb")}
response = httpx.post(
    "https://api.rekindle.app/api/v1/photos/upload",
    headers=headers,
    files=files
)
```

#### Token Verification Flow

1. Extract token from `Authorization: Bearer <token>` header
2. Verify token signature using `XDEVICE_JWT_SECRET` (HS256)
3. Validate token claims:
   - `iss` (issuer) is "rekindle:xdevice"
   - `exp` (expiration) is in the future
   - `sid` (session ID) is present
4. Load session from Redis using `sid`
5. Verify session:
   - Session exists
   - Status is "active"
   - Not expired
   - `user_id` matches token `sub`
6. Look up user in database by `id` (UUID)
7. Verify user account is active
8. **Note:** `last_login_at` is NOT updated for cross-device tokens

---

## Protected Endpoints

All endpoints under `/api/v1/*` require authentication except:
- Health check endpoints
- Public documentation endpoints

### Example Protected Endpoint

```python
from fastapi import Depends
from app.api.deps import get_current_user
from app.models.user import User

@router.get("/users/me")
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Get current authenticated user's profile"""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "tier": current_user.subscription_tier,
        "credits": current_user.total_credits
    }
```

---

## Error Responses

### 401 Unauthorized

**Invalid Token:**
```json
{
  "detail": "Invalid token"
}
```

**Token Expired:**
```json
{
  "detail": "Invalid token"
}
```

**Session Expired (Cross-Device):**
```json
{
  "detail": "Session expired or revoked"
}
```

**User Not Found:**
```json
{
  "detail": "User not found"
}
```

### 403 Forbidden

**Account Suspended:**
```json
{
  "detail": "Account is suspended"
}
```

**Account Deleted:**
```json
{
  "detail": "Account is deleted"
}
```

### 503 Service Unavailable

**JWKS Fetch Failure:**
```json
{
  "detail": "Authentication service unavailable"
}
```

---

## Token Lifecycle

### Supabase Tokens

1. **Issued:** When user signs in via Supabase Auth
2. **Valid:** Until expiration (default: 1 hour)
3. **Refreshed:** Automatically by Supabase SDK
4. **Revoked:** When user signs out or session ends

### Cross-Device Tokens

1. **Issued:** After successful biometric authentication
2. **Valid:** Until expiration (1 hour) OR session consumed
3. **Consumed:** After successful photo upload
4. **Revoked:** Can be manually revoked or expires automatically

---

## Security Considerations

### Token Storage

- **Frontend:** Store tokens securely (httpOnly cookies recommended)
- **Never:** Store tokens in localStorage or sessionStorage (XSS risk)
- **Never:** Log tokens or include in error messages

### Token Transmission

- **Always:** Use HTTPS in production
- **Always:** Include tokens in `Authorization` header (not query params)
- **Never:** Include tokens in URLs or logs

### Token Validation

- **Always:** Verify signature before trusting token
- **Always:** Check expiration (`exp` claim)
- **Always:** Validate issuer (`iss` claim)
- **Always:** Verify user account is active

### Rate Limiting

Token verification endpoints are rate-limited to prevent abuse:
- JWKS fetches: Cached for 1 hour
- Token verification: Limited per IP (see Task 3.11)

---

## Implementation Details

### JWKS Caching

JWKS keys are cached for 1 hour to reduce network calls:
- Cache is refreshed automatically on expiration
- Falls back to expired cache if fetch fails (prevents service disruption)
- Cache is invalidated on application restart

### Session Management

Cross-device sessions are stored in Redis:
- Key format: `xdevice_session:{session_id}`
- TTL: 60 minutes
- Status: `active`, `consumed`, `expired`, or `revoked`

### User Lookup

- **Supabase tokens:** Lookup by `supabase_user_id` (from token `sub`)
- **Cross-device tokens:** Lookup by `id` (UUID from Redis session)

---

## Examples

### Complete Authentication Flow (Supabase)

```python
# 1. User signs in via Supabase (frontend)
from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
response = supabase.auth.sign_in_with_password({
    "email": "user@example.com",
    "password": "password123"
})

token = response.session.access_token

# 2. Make authenticated API request
import httpx

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

response = httpx.get(
    "https://api.rekindle.app/api/v1/users/me",
    headers=headers
)

user_data = response.json()
```

### Complete Authentication Flow (Cross-Device)

```python
# 1. Generate QR token (desktop)
response = httpx.post(
    "https://api.rekindle.app/api/v1/sessions/qr-token",
    headers={"Authorization": f"Bearer {desktop_token}"}
)
qr_token = response.json()["token"]

# 2. Scan QR code and authenticate (mobile)
# User scans QR code, authenticates with biometric

# 3. Receive cross-device token (mobile)
response = httpx.post(
    "https://api.rekindle.app/api/v1/sessions/biometric-auth",
    json={
        "token": qr_token,
        "biometric_proof": "..."
    }
)
cross_device_token = response.json()["access_token"]

# 4. Upload photo with cross-device token
files = {"file": open("photo.jpg", "rb")}
headers = {"Authorization": f"Bearer {cross_device_token}"}

response = httpx.post(
    "https://api.rekindle.app/api/v1/photos/upload",
    headers=headers,
    files=files
)

# 5. Session is automatically consumed after upload
```

---

## Troubleshooting

### "Invalid token" Error

**Possible Causes:**
- Token expired
- Token signature invalid
- Token issuer not recognized
- Token malformed

**Solutions:**
- Refresh token (Supabase tokens)
- Request new token (cross-device tokens)
- Check token format
- Verify token issuer

### "Session expired or revoked" Error

**Possible Causes:**
- Cross-device session expired (60 minutes)
- Session was consumed
- Session was manually revoked

**Solutions:**
- Generate new QR token
- Scan QR code again
- Complete upload within session TTL

### "Authentication service unavailable" Error

**Possible Causes:**
- JWKS fetch failed
- Network connectivity issues
- Supabase service down

**Solutions:**
- Retry request (cached JWKS may be used)
- Check Supabase status
- Verify network connectivity

---

## Related Documentation

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [JWT Specification](https://tools.ietf.org/html/rfc7519)
- [JWKS Specification](https://tools.ietf.org/html/rfc7517)
- [Production OAuth Setup](./PRODUCTION_OAUTH_SETUP.md)
- [Mobile OAuth Setup](./MOBILE_OAUTH_SETUP.md)

---

**Last Updated:** January 2025  
**API Version:** v1

