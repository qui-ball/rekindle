# Rekindle - Photo Restoration Service

**"Bring your memories to life."**

Transform old, damaged, or faded family photos into vibrant, restored memories through professional-grade AI restoration and colourization.

## 🎯 MVP Features

- **Photo Restoration** (2 credits) - Repair damaged, old photos
- **Photo Colourization** (3 credits) - Add color to black & white photos  
- **Combined Processing** (4 credits) - Restoration + colourization together
- **Multi-platform Upload** - Mobile camera, gallery, desktop drag & drop
- **Credit-based Pricing** - Flexible subscription + top-up system
- **PWA Support** - Works on mobile and desktop

## 🏗️ Architecture

- **Frontend:** React PWA with TypeScript
- **Backend:** FastAPI (Python)
- **Database:** PostgreSQL
- **Queue:** Redis
- **AI Processing:** RunPod (Qwen 3 Image Edit)
- **Storage:** AWS S3 + CloudFront
- **Authentication:** Auth0
- **Payments:** Stripe

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Python 3.11+

### Development Setup

1. **Clone and setup:**
   ```bash
   git clone <repo-url>
   cd rekindle
   ```

2. **Start development environment:**
   ```bash
   docker-compose up -d
   ```

3. **Frontend development:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Backend development:**
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

### Environment Variables

Create `.env` files in both frontend and backend directories:

**Frontend (.env):**
```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_AUTH0_DOMAIN=your-auth0-domain
REACT_APP_AUTH0_CLIENT_ID=your-auth0-client-id
REACT_APP_STRIPE_PUBLISHABLE_KEY=your-stripe-key
```

**Backend (.env):**
```
DATABASE_URL=postgresql://user:password@localhost:5432/rekindle_dev
REDIS_URL=redis://localhost:6379
AUTH0_DOMAIN=your-auth0-domain
AUTH0_AUDIENCE=your-auth0-audience
STRIPE_SECRET_KEY=your-stripe-secret
RUNPOD_API_KEY=your-runpod-key
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
S3_BUCKET=your-s3-bucket
```

## 💰 Pricing Tiers

| Tier | Price | Monthly Credits | Quality | Features |
|------|-------|----------------|---------|----------|
| **Try** (Free) | $0 | 3 credits | 480p | 7-day storage |
| **Remember** | $9.99/month | 25 credits | 720p HD | Permanent storage |
| **Cherish** | $19.99/month | 60 credits | 720p HD | Priority processing |
| **Forever** | $39.99/month | 150 credits | 720p HD | Highest priority |

**Credit Costs:**
- Restoration: 2 credits
- Colourization: 3 credits  
- Combined: 4 credits (1 credit discount)

**Top-ups available:** $4.99-$39.99 (10-100 credits)

## 📱 Upload Methods

### Mobile (PWA)
- **Camera Capture:** Take photos of physical pictures with smart cropping
- **Gallery Access:** Select photos from device gallery
- **Progress Tracking:** Real-time upload progress

### Desktop
- **Drag & Drop:** Simple file upload interface
- **QR Code Flow:** Scan QR code to use mobile camera from desktop
- **File Browser:** Traditional file selection

## 🧪 Testing

```bash
# Frontend tests
cd frontend
npm run test:coverage

# Backend tests  
cd backend
pytest --cov=app

# Run all tests
npm run test:all
```

## 🚢 Deployment

### Staging
- **Frontend:** Vercel
- **Backend:** AWS ECS

### Production
- **Frontend:** AWS CloudFront + S3
- **Backend:** AWS ECS Fargate
- **Database:** AWS RDS PostgreSQL
- **Queue:** AWS ElastiCache Redis

## 📊 Key Metrics (MVP)

- **Total User Accounts**
- **User Tier Distribution** 
- **Average Revenue Per User (ARPU)**
- **Monthly Recurring Revenue (MRR)**
- **Profit Margin**
- **Monthly Operational Costs**

## 🗂️ Project Structure

```
rekindle/
├── frontend/                 # React PWA
├── backend/                 # FastAPI Python
├── infrastructure/          # Deployment configs
├── docs/                   # Documentation
├── .kiro/                  # Kiro AI configuration
│   └── steering/           # Development guidelines
├── docker-compose.yml      # Development environment
└── README.md
```

## 🔮 Post-MVP Features

- **Animation** (8 credits) - Bring photos to life with subtle movement
- **Bring Together** (6 credits) - Combine people from multiple photos
- **Advanced Sharing** - Social media integrations
- **Batch Processing** - Upload multiple photos at once
- **Mobile Apps** - Native iOS/Android apps

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary and confidential.

## 🆘 Support

For development questions, check the steering docs in `.kiro/steering/` or contact the development team.

---

**Built with ❤️ for families who want to preserve their precious memories.**