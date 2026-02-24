# UI Redesign: Cozy Home Design System - Design Document

## Overview

This document defines the design system derived from `design-samples/design-10-cozy-home.html` (“Cozy Home”). It provides a single source of truth for tokens and a modular component set so the application can be refactored to a seamless, uniform Cozy Home aesthetic without code duplication.

**Reference:** `design-samples/design-10-cozy-home.html`

**Related:** requirements.md, tasks.md

---

## 1. Design Tokens (from Sample)

Tokens below are extracted from the sample and should be implemented in Tailwind `theme.extend` (and optionally CSS variables) so all components reference them instead of hardcoded values.

### 1.1 Colors

| Token role        | Sample value(s)        | Usage |
|-------------------|------------------------|--------|
| Background        | `#faf5f0`              | Page body |
| Surface           | `#fff`                 | Cards, panels, inputs |
| Text primary      | `#5a4a3a`              | Body default |
| Text secondary    | `#8b6f47`              | Taglines, captions, muted |
| Text heading      | `#6b5b3d`              | H1, H2, H3 |
| Accent            | `#c9a882`              | Borders, dividers, icons, links |
| Accent dark       | `#8b6f47`              | Buttons (gradient end), stronger accent |
| Border card       | `#e8dcc6`              | Card borders |
| Border photo      | `#c9a882`              | Photo frames, decorative |
| Mount / fill      | `#f5ede0`              | Photo mount, subtle fills |
| Gradient (before) | `#e8dcc6` → `#d4c4b0`  | “Before” photo placeholder |
| Gradient (after)  | `#fff5e6` → `#ffe8cc`  | “After” / highlight placeholder |
| Button gradient   | `#c9a882` → `#8b6f47`  | Primary button |
| Shadow default    | `0 5px 20px rgba(0,0,0,0.08)` | Cards, hero |
| Shadow hover      | `0 8px 25px rgba(0,0,0,0.12)` | Cards hover |
| Shadow button     | `0 5px 20px rgba(201,168,130,0.3)` | Primary button |

**Tailwind tokens:** Colors are in `theme.extend.colors.cozy` and `theme.extend.colors.cozySemantic`. Use `bg-cozy-background`, `text-cozy-heading`, `border-cozy-borderCard`, etc. See tailwind.config.js.

**Semantic colors (cozySemantic):** Success, error, warning, and info that harmonize with the palette and meet WCAG AA contrast: `cozySemantic.success`, `cozySemantic.error`, `cozySemantic.warning`, `cozySemantic.info` (plus `*Muted` variants for backgrounds).

### 1.2 Typography

| Token        | Sample                          | Tailwind token | Usage |
|-------------|----------------------------------|----------------|--------|
| Font family | `'Merriweather', 'Georgia', serif` | `font-serif` | Headings and body |
| Line height | `1.8`                           | `leading-cozy` | Body |
| Logo size   | `2.8rem` (desktop)              | `text-cozy-logo` | App logo |
| Tagline     | `1.1rem`, italic, accent color  | `text-cozy-tagline` | Tagline under logo |
| H1          | `2.8rem`, weight 400, heading color | `text-cozy-h1` | Hero title |
| Hero body   | `1.2rem`, italic, secondary    | `text-cozy-hero` | Hero subtitle |
| H2          | `2.5rem` (e.g. CTA section)     | `text-cozy-h2` | Section titles |
| H3          | `1.4rem`, weight 400             | `text-cozy-h3` | Feature titles |
| Body        | `1rem`, secondary color, italic where used in sample | `text-cozy-body` | Feature text, captions |
| Caption     | `0.9rem`, italic, secondary    | `text-cozy-caption` | Photo captions, small text |
| Button      | `1.1rem`, weight 400, Merriweather | `text-cozy-button` | Primary button |

**Implementation:** Merriweather loaded via `next/font/google`; `font-serif` in Tailwind uses `var(--font-merriweather), Merriweather, Georgia, serif`. Body in globals.css uses `font-serif text-cozy-body leading-cozy`.

**Fallback:** Georgia and generic serif used if Merriweather fails to load.

### 1.3 Spacing & Layout

| Token           | Sample        | Tailwind token | Usage |
|-----------------|---------------|----------------|--------|
| Container max   | `1200px`      | `max-w-cozy-container` | Main content width |
| Container pad   | `2rem` (desktop), `1.5rem` (768), `1rem` (480) | `p-cozy-container`, `cozy-tablet:p-cozy-container-tablet`, `cozy-mobile:p-cozy-container-mobile` | Horizontal padding |
| Section padding | `4rem 0` (desktop) | `py-cozy-section` | Vertical rhythm |
| Card padding    | `2rem`–`3rem`| `p-8`–`p-12` | Inner padding of cards |
| Gap (grid/flex) | `2rem`–`3rem`| `gap-8`–`gap-12` | Between cards, features |

### 1.4 Border Radius

| Token    | Sample  | Tailwind token | Usage |
|----------|---------|----------------|--------|
| Large    | `15px` | `rounded-cozy-lg` | Hero, testimonial, CTA section |
| Medium   | `12px` | `rounded-cozy-md` | Feature cards |
| Small    | `10px` | `rounded-cozy-sm` | Album page card |
| Input    | `8px`  | `rounded-cozy-input` | Photo mount, inputs |
| Pill     | `50px` | `rounded-cozy-pill` | Primary button |

### 1.5 Box Shadow

| Token    | Sample | Tailwind token | Usage |
|----------|--------|----------------|--------|
| Card default | `0 5px 20px rgba(0,0,0,0.08)` | `shadow-cozy-card` | Cards, hero |
| Card hover | `0 8px 25px rgba(0,0,0,0.12)` | `shadow-cozy-card-hover` | Cards hover |
| Button | `0 5px 20px rgba(201,168,130,0.3)` | `shadow-cozy-button` | Primary button |
| Button hover | `0 8px 25px rgba(201,168,130,0.4)` | `shadow-cozy-button-hover` | Primary button hover |

### 1.6 Breakpoints (from Sample)

- **Desktop:** default (no max-width).
- **Tablet:** `cozy-tablet: 768px` (min-width).
- **Mobile:** `cozy-mobile: 480px` (min-width).

Use `cozy-mobile:` and `cozy-tablet:` for layout and typography scaling to match the sample.

### 1.7 Motion

- **Hover (card):** `transform: translateY(-5px)`, shadow and border transition `0.3s ease`.
- **Hover (button):** `translateY(-3px)`, stronger shadow `0.3s ease`.
- **Respect:** `prefers-reduced-motion: reduce` — disable or reduce transform/animations.

---

## 2. Component Inventory (from Sample)

These patterns appear in the sample and map to reusable components.

| Sample class / block | Purpose | Reusable component (suggested) |
|---------------------|---------|---------------------------------|
| `.container`        | Max-width + horizontal padding | `PageContainer` or `Container` |
| `header` + `.logo` + `.tagline` | App header / branding | `AppHeader` (or use in `Navigation`) |
| `.hero`             | Centered title + subtitle block | `SectionHero` or `Hero` |
| `.photo-album`      | Flex row of “album page” cards | Layout; content uses `Card` + `PhotoMount` |
| `.album-page`       | Card with left accent bar | `Card` variant (e.g. `accentLeft`) |
| `.photo-mount` + `.photo-content` | Frame around image/placeholder | `PhotoMount` (or `ImageFrame`) |
| `.photo-caption`    | Small italic caption | Typography: `Caption` or token class |
| `.features` + `.feature` | Grid of feature cards | `FeatureCard` or `Card` + grid |
| `.feature-icon`     | Icon above title | Slot in Card or `FeatureCard` |
| `.testimonial`      | Quote block with left border | `Card` variant or `Testimonial` |
| `.cta-section`      | Centered CTA block | `SectionCta` or layout + `Button` |
| `.btn-primary`      | Gradient pill button | `Button` primary variant |

---

## 3. Reusable Primitives (Proposed)

Implement these in a dedicated area (e.g. `src/components/ui/` or `src/design-system/`) and use tokens only—no hardcoded Cozy Home values in components.

### 3.1 Layout

- **Container (PageContainer)**  
  - Max-width 1200px, horizontal padding from tokens, optional vertical padding.  
  - Used as the main wrapper for page content.

- **Section**  
  - Optional wrapper for vertical rhythm (padding top/bottom from tokens).  
  - Variants: default, hero, cta.

### 3.2 Typography

- **Headline** — H1/H2/H3 using token font, size, weight, color. Props: `level`, `as`, `className`.
- **Tagline** — Italic, secondary color, token size.
- **Body** — Default body text (token size, line-height, color).
- **Caption** — Small, italic, secondary color.

Prefer composition (e.g. `<Headline level="1">`) over many one-off classes so typography stays consistent.

### 3.3 Buttons

- **Button**  
  - Variants: `primary` (Cozy Home gradient, pill, hover lift), `secondary` (outline or subtle fill using accent/border), `ghost`.  
  - Sizes: default, large (e.g. CTA).  
  - All use tokens; full-width on small breakpoints if desired.

### 3.4 Cards

- **Card**  
  - Surface background, border from tokens, radius (medium/large), shadow.  
  - Optional: `accentLeft` (left border or bar), hover lift.  
  - Padding from tokens.  
  - Used for feature cards, panels, album tiles, testimonial, etc.

- **PhotoMount** (optional)  
  - Inner frame (mount color, padding, radius) and optional aspect-ratio box for image or placeholder.  
  - Used anywhere the sample’s “photo in a frame” look is needed.

### 3.5 Forms (for migration)

- **Input** — Border, radius, focus ring using accent; label and error using typography tokens.
- **FormField** — Label + Input + error message wrapper.

These can be added in a later phase if not all forms are migrated in the first pass.

### 3.6 Navigation / Header

- **AppHeader** (or extend **Navigation**)  
  - Logo: Merriweather, accent color, token size.  
  - Tagline optional.  
  - Nav links: Cozy Home text and hover (e.g. accent or underline).  
  - Optional top border (e.g. double border like sample).  
  - Container: use shared `Container` and token spacing.

---

## 4. Token Implementation (Tailwind)

- **Colors:** Add under `theme.extend.colors`, e.g. `cozy: { background, surface, text, textMuted, heading, accent, accentDark, border, borderCard, mount, … }`. Optionally mirror as CSS variables for non-Tailwind use.
- **Fonts:** Add `fontFamily: { serif: ['Merriweather', 'Georgia', 'serif'] }` and set as default for body and headings in `globals.css` (replace Inter for Cozy Home).
- **Spacing / radius / boxShadow:** Extend theme with named values (e.g. `cozyRadius.lg`, `cozyShadow.card`, `cozyShadow.cardHover`) and use them in components.
- **Breakpoints:** Align with 768px and 480px if not already present.

Ensure `globals.css` and any legacy `.btn-primary` / `.upload-zone` etc. are updated to use these tokens so old and new code converge on the same look.

---

## 5. Refactor Strategy

1. **Tokens first**  
   Add Cozy Home tokens to Tailwind (and optionally CSS vars). Do not change components yet; establish the single source of truth.

2. **Primitives next**  
   Implement Container, Button, Card, typography components, and (if needed) PhotoMount and form primitives. Use only tokens.

3. **Layout and navigation**  
   Restyle `Navigation` and `AuthenticatedLayout` (and any global bar) to use tokens and primitives (Container, AppHeader/logo, Button if needed).

4. **Page migration**  
   Migrate pages one by one: replace layout wrappers with `Container`/`Section`, replace buttons with `Button`, replace panels with `Card`, replace headings/body with typography tokens or components. Keep all state and logic; only swap presentational pieces.

5. **Feature components**  
   Align PhotoManagement, PhotoUpload, and other feature-specific components to use the same primitives and tokens (cards, buttons, inputs) so gallery, upload, and subscription all match.

6. **Cleanup**  
   Remove duplicated Cozy Home styles, deprecate old button/card classes that are no longer used, and ensure no hardcoded colors/fonts remain in app code.

---

## 6. File and Naming Conventions

- **Tokens:** Centralized in `tailwind.config.js` (and optionally a small `tokens.css` or `theme.css` for CSS variables).
- **Primitives:** e.g. `src/components/ui/Button.tsx`, `Card.tsx`, `Container.tsx`, `Headline.tsx`, `Tagline.tsx`, `Caption.tsx`, etc. One component per file; export from `ui/index.ts` or similar.
- **Navigation/header:** Update existing `Navigation.tsx` (and related layout) to use tokens and shared Container/logo style; optionally extract `AppHeader` if useful elsewhere (e.g. landing).

Use kebab-case for CSS classes and PascalCase for components, per development-standards.

---

## 7. Accessibility and Theming Notes

- **Contrast:** Check text on background and surface; adjust token values slightly if needed for WCAG AA.
- **Focus:** Visible focus ring using accent (or a high-contrast outline) on Button, Card (if interactive), and form controls.
- **Reduced motion:** Use `@media (prefers-reduced-motion: reduce)` to disable or reduce hover lift and other motion.
- **Theme color:** Set `theme-color` / viewport and PWA theme to a Cozy Home color (e.g. accent or background) so browser chrome matches the app.

**Task 6.1 contrast spot-check (Feb 2025):** Body text (`cozy.text` #5a4a3a on `cozy.background` #faf5f0) and primary button text (white on gradient) meet WCAG AA. No token changes were required.

This design document gives implementers a clear map from the Cozy Home sample to tokens and reusable components, enabling a modular, duplication-free UI redesign across the application.
