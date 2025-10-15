# 🚀 Rekindle Development Environment

## Quick Start

### 1. Start Everything (Recommended)
```bash
./dev start
# or simply
./dev
```

This will:
- Build and start the frontend in Docker with hot reload
- Automatically set up HTTPS tunnel for mobile camera testing
- Show you all URLs (local, network, and HTTPS tunnel)
- Display live logs

### 2. Access the Application
- **Local**: http://localhost:3000
- **Network**: http://YOUR_IP:3000 (for local devices)
- **Mobile Camera**: https://xxxxx.ngrok-free.app (auto-generated HTTPS tunnel)

### 3. Stop Everything
```bash
./dev stop
```

### 4. Start Without Tunnel (Optional)
```bash
./dev start --no-tunnel
```

Use this if you don't need camera testing or want to save resources.

### 5. Tunnel Only
```bash
./dev tunnel
```

Start just the HTTPS tunnel (if development server is already running).

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

## 📱 Mobile Testing

### HTTP Testing (Local Network)
- Use: `http://YOUR_IP:3000`
- Works for most features except camera on some browsers

### HTTPS Testing (Camera Features)
- **Automatic**: HTTPS tunnel starts with `./dev start`
- **Manual**: Run `./dev tunnel` if you started with `--no-tunnel`
- **Required**: For camera access on mobile browsers

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
./dev https
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
3. Try HTTPS tunnel: `./tunnel.sh`

### Camera Not Working
1. Use HTTPS tunnel: `./tunnel.sh`
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
├── docker-compose.yml       # Docker services
├── dev.sh                  # Development startup script
├── tunnel.sh               # HTTPS tunnel script
└── DEVELOPMENT.md          # This file
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

## 📁 Script Organization

```
rekindle/
├── dev                           # Main development command
├── frontend/
│   └── scripts/
│       ├── dev.sh               # Development startup script
│       ├── stop.sh              # Stop all services
│       └── tunnel.sh            # HTTPS tunnel setup
├── docker-compose.yml           # Docker services
└── DEVELOPMENT.md              # This file
```

### Direct Script Access
You can also run scripts directly:
```bash
# Direct script execution
frontend/scripts/dev.sh
frontend/scripts/stop.sh
frontend/scripts/tunnel.sh

# Or use the convenient wrapper
./dev start
./dev stop
./dev tunnel
```



---

Happy coding! 🎉