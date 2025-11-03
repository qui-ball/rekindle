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

### Run the Application

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

4. **Start the development environment:**
   ```bash
   ./dev
   ```

   This will automatically:
   - Start Supabase (authentication & API)
   - Start all Docker services (frontend, backend, database, Redis)
   - Generate trusted SSL certificates (if needed)
   - Show you all access URLs

5. **Access the application:**
   - **Frontend**: http://localhost:3000 (or https://localhost:3000 in HTTPS mode)
   - **Backend API**: http://localhost:8000
   - **Supabase Studio**: http://localhost:54323
   - **Mobile**: https://YOUR_IP:3000 (shown in terminal output, same WiFi network)

### Stop the Application

```bash
./dev stop
```

## 📱 Mobile Testing

The application includes camera functionality that requires HTTPS on mobile devices. Use `./dev https` to start in HTTPS mode for mobile testing.

After running `./dev https`, use the provided HTTPS URL on your mobile device (same WiFi network) to test camera features.

## 🛠️ Development

For detailed development information, see [DEVELOPMENT.md](DEVELOPMENT.md).

---

**Built with ❤️ for families who want to preserve their precious memories.**
