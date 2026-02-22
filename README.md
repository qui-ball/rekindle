# Rekindle

**"Bring your memories to life."**

Transform old, damaged, or faded family photos into vibrant, restored memories using professional-grade AI restoration and colourization.

## Features

- **Photo Restoration** - Repair damaged and old photos
- **Photo Colourization** - Add color to black & white photos  
- **Mobile Camera Upload** - Take photos of physical pictures with guided capture
- **Multi-platform Support** - Works on mobile and desktop browsers

## 🚀 Getting Started

### Prerequisites

- Docker & Docker Compose
- Supabase CLI (for local authentication)

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd rekindle
   ```

2. **Install Supabase CLI:**
   
   **macOS:**
   ```bash
   brew install supabase/tap/supabase
   ```
   
   **Linux/Windows:**
   See [Supabase CLI installation guide](https://supabase.com/docs/guides/cli/getting-started)

3. **One-time setup for HTTPS (required for mobile camera testing):**
   
   **macOS:**
   ```bash
   brew install mkcert
   mkcert -install
   ```
   
   **Linux:**
   ```bash
   # Install dependencies (Debian/Ubuntu)
   sudo apt update
   sudo apt install -y libnss3-tools
   
   # Download and install mkcert
   curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
   chmod +x mkcert-v*-linux-amd64
   sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
   
   # Install the local CA
   mkcert -install
   ```
   
   For other Linux distributions, see [mkcert documentation](https://github.com/FiloSottile/mkcert#linux).

### Running the Application

**Start the development environment:**
```bash
./dev start
# or simply
./dev
```

This will automatically:
- Start Supabase (authentication & API)
- Start all Docker services (frontend, backend, database, Redis)
- Generate trusted SSL certificates (if needed)
- Show you all access URLs

**Access the application:**
- **Frontend**: http://localhost:3000 (or https://localhost:3000 in HTTPS mode)
- **Backend API**: http://localhost:8000
- **Supabase Studio**: http://localhost:54323
- **Mobile**: https://YOUR_IP:3000 (shown in terminal output, same WiFi network)

**Stop the application:**
```bash
./dev stop
```

If startup fails with **"port is already allocated"** (e.g. 8000 or 3000), the script will stop existing containers and retry once. If it still fails, run `./dev stop`, wait a few seconds, then start again. The dev script checks that ports are free before starting.

## 🔧 Development Commands

### Docker Management

```bash
# Start development environment
./dev start

# Stop all containers and tunnel
./dev stop

# Start without tunnel
./dev start --no-tunnel

# Start tunnel only
./dev tunnel

# Direct Docker commands
docker-compose down                    # Stop containers
docker-compose restart frontend       # Restart frontend only
docker-compose logs -f frontend       # View logs
docker-compose exec frontend sh       # Access container shell
docker-compose up --build            # Rebuild containers
```

### Development Workflow

1. **Code Changes**: Edit files in `frontend/src/` - changes auto-reload
2. **Install Dependencies**: Add to `frontend/package.json` then rebuild
3. **Test on Mobile**: Use network URL or HTTPS tunnel
4. **Debug**: Check logs with `docker-compose logs -f frontend`

## 🔥 Hot Reload

Hot reload is enabled and should work for:
- ✅ React component changes
- ✅ TypeScript changes  
- ✅ CSS/Tailwind changes
- ✅ New file additions

If hot reload stops working:
```bash
docker-compose restart frontend
```

## 📱 Mobile Testing

### HTTP Testing (Local Network)
- Use: `http://YOUR_IP:3000`
- Works for most features except camera on some browsers

### HTTPS Testing (Camera Features)
- **Automatic**: HTTPS tunnel starts with `./dev start`
- **Manual**: Run `./dev tunnel` if you started with `--no-tunnel`
- **Required**: For camera access on mobile browsers

### OAuth Testing
- **Desktop**: OAuth works with `localhost` - no special setup needed
- **Mobile**: Use email/password authentication on mobile - use `https://YOUR_IP:3000` (shown in terminal output)
- **Production**: OAuth works automatically with your production domain

## 🔐 Environment Variables

### Environment Variable Locations

#### Backend (`backend/.env`)

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

#### Frontend (`frontend/.env` or `frontend/.env.local`)

**Required for Frontend:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (must be prefixed with `NEXT_PUBLIC_` to be available in browser)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (must be prefixed with `NEXT_PUBLIC_`)

**Note:** Next.js prefers `.env.local` over `.env` (`.env.local` takes precedence). Both files are supported by Docker Compose.

### Environment Variable Precedence

The `./dev` script (via `scripts/dev-docker.sh`) automatically:
1. Extracts Supabase credentials from local Supabase instance
2. Sets environment variables for both backend and frontend
3. Overrides values in `.env` files if successfully extracted

**Environment Variable Precedence (highest to lowest):**
1. Script exports from `dev-docker.sh` (auto-extracted from Supabase)
2. `frontend/.env.local` (if exists)
3. `frontend/.env` (if exists)
4. Default values in `docker-compose.yml`

This means:
- **Local Development:** Script auto-populates Supabase vars (no manual setup needed)
- **Production/Manual Setup:** Set values in `.env` files manually

### Correct Setup

**✅ Correct Locations**

**Backend (`backend/.env`):**
```env
SUPABASE_URL=http://host.docker.internal:54321
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_KEY=<your-service-key>  # SENSITIVE - backend only
```

**Frontend (`frontend/.env` or `frontend/.env.local`):**
```env
NEXT_PUBLIC_SUPABASE_URL=http://host.docker.internal:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

**❌ Wrong Locations**

- **DO NOT** put `SUPABASE_SERVICE_KEY` in `frontend/.env` (it's sensitive and backend-only)
- **DO NOT** put `SUPABASE_URL` or `SUPABASE_ANON_KEY` in frontend without `NEXT_PUBLIC_` prefix (they won't be available in browser)
- **DO NOT** put `NEXT_PUBLIC_*` variables in `backend/.env` (they're frontend-only)

### Docker Network Considerations

When running in Docker:
- Use `http://host.docker.internal:54321` for Supabase URL (from containers to host)
- Use `http://localhost:54321` when accessing from host machine
- The `dev-docker.sh` script automatically sets the correct URLs

### Verification

To verify your setup:
1. Check `backend/.env` has `SUPABASE_*` variables (without `NEXT_PUBLIC_` prefix)
2. Check `frontend/.env` or `frontend/.env.local` has `NEXT_PUBLIC_SUPABASE_*` variables
3. Run `./dev start` and verify no errors about missing env vars
4. Check frontend logs to ensure Supabase client initializes correctly

### Production

For production, set these values in your deployment platform:
- **Backend:** Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` (use production Supabase project)
- **Frontend:** Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (use production Supabase project)

**Note:** Production Supabase URLs will be different (e.g., `https://your-project.supabase.co` instead of `http://localhost:54321`)

## 🐛 Troubleshooting

### Backend/Celery/Flower Containers Fail with `.venv` Error

**Symptoms:**
- Containers exit immediately with error: `failed to remove directory /app/.venv: Resource busy`
- Backend, celery, or flower services won't start

**Solution:**
```bash
# Stop containers and remove volumes
docker-compose down -v

# Remove local .venv directory (if it exists)
rm -rf backend/.venv

# Restart development environment
./dev start
```

**Prevention:**
- Never create `backend/.venv` when using Docker development
- The dev script will warn you if `.venv` exists
- See `backend/DOCKER_DEV.md` for more details

### Container Won't Start

```bash
# Check if port 3000 is in use
lsof -i :3000

# Force rebuild
docker-compose down
docker-compose up --build --force-recreate
```

### Hot Reload Not Working

```bash
# Restart frontend container
docker-compose restart frontend

# Or rebuild completely
docker-compose down
docker-compose up --build
```

### Mobile Can't Connect

1. Check firewall settings
2. Ensure devices are on same network
3. Try HTTPS tunnel: `./dev tunnel`

### Camera Not Working

1. Use HTTPS tunnel: `./dev tunnel`
2. Check browser permissions
3. Test on different browsers/devices

## 📁 Project Structure

```
rekindle/
├── frontend/                 # Next.js frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── app/             # Next.js app router
│   │   └── types/           # TypeScript types
│   ├── Dockerfile.dev       # Development Docker config
│   └── package.json
├── backend/                  # Python FastAPI backend
│   ├── app/                 # Application code
│   └── .env                 # Backend environment variables
├── docker-compose.yml       # Docker services
├── dev                      # Main development command
└── README.md               # This file
```

## 🎯 Testing Checklist

### Desktop Testing
- [ ] http://localhost:3000 loads
- [ ] Hot reload works on file changes
- [ ] Upload interface appears
- [ ] Camera button shows (may not work without HTTPS)

### Mobile Testing  
- [ ] Network URL accessible from mobile
- [ ] Interface is responsive
- [ ] Camera permission prompt appears
- [ ] Photo capture works
- [ ] Preview shows after capture
- [ ] Retake functionality works

## 🚀 Production Deployment

When ready for production:
1. Build production image: `docker build -f frontend/Dockerfile.prod`
2. Deploy with proper HTTPS certificate
3. Configure domain and SSL
4. Set up CI/CD pipeline
5. Configure production environment variables (see Environment Variables section)

## 📚 Additional Documentation

- **Authentication Setup**: See `docs/authentication/` for OAuth and authentication configuration
- **Backend Development**: See `backend/DOCKER_DEV.md` for backend-specific development details

---

**Built with ❤️ for families who want to preserve their precious memories.**
