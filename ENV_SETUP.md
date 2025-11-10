# Environment Variables Setup Guide

This document explains where environment variables should be located for the Rekindle project.

## Environment Variable Locations

### Backend (`backend/.env`)

**Required for Backend Services:**
- `SUPABASE_URL` - Supabase project URL (for server-side API calls)
- `SUPABASE_ANON_KEY` - Supabase anonymous key (for server-side operations)
- `SUPABASE_SERVICE_KEY` - **SENSITIVE** - Supabase service role key (admin operations, backend only)

**Other Backend Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `SECRET_KEY` - JWT signing secret
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` - AWS S3 credentials
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Stripe credentials
- `RUNPOD_API_KEY` - RunPod API key
- And other backend-specific variables

**Important:** `SUPABASE_SERVICE_KEY` should **NEVER** be in `frontend/.env` as it's sensitive and grants admin access.

### Frontend (`frontend/.env` or `frontend/.env.local`)

**Required for Frontend:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (must be prefixed with `NEXT_PUBLIC_` to be available in browser)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (must be prefixed with `NEXT_PUBLIC_`)

**Note:** Next.js prefers `.env.local` over `.env` (`.env.local` takes precedence). Both files are supported by Docker Compose.

## Docker Compose Configuration

The `docker-compose.yml` is configured to:
1. Load `frontend/.env` first
2. Then load `frontend/.env.local` (which will override `.env` values if both exist)
3. Allow script exports from `dev-docker.sh` to override file values

**Environment Variable Precedence (highest to lowest):**
1. Script exports from `dev-docker.sh` (auto-extracted from Supabase)
2. `frontend/.env.local` (if exists)
3. `frontend/.env` (if exists)
4. Default values in `docker-compose.yml`

## Development Script Behavior

The `./dev` script (via `scripts/dev-docker.sh`) automatically:
1. Extracts Supabase credentials from local Supabase instance
2. Sets environment variables for both backend and frontend
3. Overrides values in `.env` files if successfully extracted

This means:
- **Local Development:** Script auto-populates Supabase vars (no manual setup needed)
- **Production/Manual Setup:** Set values in `.env` files manually

## Correct Setup Summary

### ✅ Correct Locations

**Backend (`backend/.env`):**
```
SUPABASE_URL=http://host.docker.internal:54321
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_KEY=<your-service-key>  # SENSITIVE - backend only
```

**Frontend (`frontend/.env` or `frontend/.env.local`):**
```
NEXT_PUBLIC_SUPABASE_URL=http://host.docker.internal:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### ❌ Wrong Locations

- **DO NOT** put `SUPABASE_SERVICE_KEY` in `frontend/.env` (it's sensitive and backend-only)
- **DO NOT** put `SUPABASE_URL` or `SUPABASE_ANON_KEY` in frontend without `NEXT_PUBLIC_` prefix (they won't be available in browser)
- **DO NOT** put `NEXT_PUBLIC_*` variables in `backend/.env` (they're frontend-only)

## Docker Network Considerations

When running in Docker:
- Use `http://host.docker.internal:54321` for Supabase URL (from containers to host)
- Use `http://localhost:54321` when accessing from host machine
- The `dev-docker.sh` script automatically sets the correct URLs

## Verification

To verify your setup:
1. Check `backend/.env` has `SUPABASE_*` variables (without `NEXT_PUBLIC_` prefix)
2. Check `frontend/.env` or `frontend/.env.local` has `NEXT_PUBLIC_SUPABASE_*` variables
3. Run `./dev start` and verify no errors about missing env vars
4. Check frontend logs to ensure Supabase client initializes correctly

## Production

For production, set these values in your deployment platform:
- **Backend:** Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` (use production Supabase project)
- **Frontend:** Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (use production Supabase project)

**Note:** Production Supabase URLs will be different (e.g., `https://your-project.supabase.co` instead of `http://localhost:54321`)

