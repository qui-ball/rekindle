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

### Run the Application

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd rekindle
   ```

2. **One-time setup for HTTPS (required for mobile camera testing):**
   
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

3. **Start the development environment:**
   ```bash
   ./dev
   ```

   This will:
   - Start the frontend application with hot reload and HTTPS
   - Generate trusted SSL certificates automatically
   - Show you all access URLs

4. **Access the application:**
   - **Local**: https://localhost:3000
   - **Mobile**: https://YOUR_IP:3000 (shown in terminal output)

### Stop the Application

```bash
./dev stop
```

## 📱 Mobile Testing

The application includes camera functionality that requires HTTPS on mobile devices. The development environment automatically sets up a secure tunnel for testing.

After running `./dev`, use the provided HTTPS URL (e.g., `https://xxxxx.ngrok-free.app`) on your mobile device to test camera features.

## 🛠️ Development

For detailed development information, see [DEVELOPMENT.md](DEVELOPMENT.md).

---

**Built with ❤️ for families who want to preserve their precious memories.**
