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

## Cozy Home Design System

The UI follows the **Cozy Home** design system. Use design tokens and shared primitives instead of hardcoded colors or one-off classes. Full reference: [design.md](../.kiro/specs/ui-cozy-home-redesign/design.md).

### Design tokens (Tailwind)

Defined in `tailwind.config.js`. Use these instead of hex or generic blue/gray.

**Colors**
- `cozy.*`: `background`, `surface`, `text`, `textMuted`, `textSecondary`, `heading`, `accent`, `accentDark`, `border`, `borderCard`, `mount`, `gradientButtonStart`, `gradientButtonEnd`, plus gradient endpoints for before/after placeholders.
- `cozySemantic.*`: `success`, `error`, `warning`, `info` (and `*Muted` for backgrounds).

**Typography**
- Font: `font-serif` (Merriweather).
- Sizes: `text-cozy-logo`, `text-cozy-h1`–`text-cozy-h3`, `text-cozy-tagline`, `text-cozy-hero`, `text-cozy-body`, `text-cozy-caption`, `text-cozy-button`.
- Line height: `leading-cozy` (1.8).

**Spacing & layout**
- Container: `max-w-cozy-container` (1200px); padding `px-cozy-container`, `cozy-tablet:px-cozy-container-tablet`, `cozy-mobile:px-cozy-container-mobile`; section vertical `py-cozy-section`.

**Border radius**
- `rounded-cozy-lg`, `rounded-cozy-md`, `rounded-cozy-sm`, `rounded-cozy-input`, `rounded-cozy-pill`.

**Shadow**
- `shadow-cozy-card`, `shadow-cozy-card-hover`, `shadow-cozy-button`, `shadow-cozy-button-hover`.

**Breakpoints**
- `cozy-mobile`: 480px; `cozy-tablet`: 768px. Use for layout and typography scaling.

### Primitives (`src/components/ui/`)

Prefer these over custom wrappers or legacy utility classes.

| Component   | Use |
|------------|-----|
| **Container** | Page width and horizontal padding. Props: `verticalPadding?`. |
| **Section**   | Vertical rhythm. Props: `variant?: 'default' \| 'hero' \| 'cta'`, `as?`. |
| **Button**    | Actions. Props: `variant?: 'primary' \| 'secondary' \| 'ghost'`, `size?: 'default' \| 'large'`, `fullWidth?`, `href?`. |
| **Card**      | Panels, feature blocks. Props: `accentLeft?`, `hover?`. |
| **Headline**  | H1–H3. Props: `level?: 1 \| 2 \| 3`, `as?`. |
| **Tagline**   | Italic secondary text (e.g. under logo). |
| **Body**      | Body text. Props: `italic?`. |
| **Caption**   | Small italic text (e.g. under photos). |
| **PhotoMount** | Frame for images/placeholders. Props: `design?: 'default' \| 'before' \| 'after'`, `aspectRatio?`. |

Legacy classes `.btn-primary` and `.btn-secondary` in `globals.css` are deprecated; use the `Button` component instead.

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # Reusable UI components
│   └── ui/              # Design system primitives (Button, Card, etc.)
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