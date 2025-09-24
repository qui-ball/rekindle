# Rekindle Frontend

A Next.js Progressive Web App (PWA) for photo restoration and colorization.

## Tech Stack

- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **PWA:** next-pwa with Workbox
- **State Management:** Zustand
- **Testing:** Jest + React Testing Library
- **Authentication:** Auth0
- **Payments:** Stripe

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env.local
```

3. Fill in your environment variables in `.env.local`

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run type-check` - Run TypeScript type checking

## PWA Features

This app is configured as a Progressive Web App with:

- Service worker for offline functionality
- App manifest for installability
- Camera access for photo capture
- Responsive design for mobile and desktop

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # Reusable UI components
├── hooks/              # Custom React hooks
├── services/           # API and external service integrations
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## Environment Variables

All public environment variables must be prefixed with `NEXT_PUBLIC_` to be available in the browser.

See `.env.example` for required environment variables.

## Deployment

This app is optimized for deployment on Vercel, but can be deployed to any platform that supports Next.js.

For Vercel deployment:
1. Connect your GitHub repository
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch