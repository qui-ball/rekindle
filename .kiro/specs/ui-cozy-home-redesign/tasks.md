# UI Redesign: Cozy Home Design System - Implementation Tasks

## Document Info

**Created:** February 2025  
**Status:** Ready for implementation  
**Related:** requirements.md, design.md  
**Reference:** design-samples/design-10-cozy-home.html

---

## Task Overview

### Phase Summary

| Phase | Focus | Status |
|-------|--------|--------|
| Phase 1: Design tokens | Tailwind theme + globals (Cozy Home palette, typography, spacing, radii, shadows) | Done |
| Phase 2: UI primitives | Container, Button, Card, typography components, optional PhotoMount | Not Started |
| Phase 3: Layout and navigation | AppHeader / Navigation restyle, AuthenticatedLayout, global bar | Not Started |
| Phase 4: Page migration | Landing, sign-in, sign-up, subscription, auth callback, terms, privacy | Not Started |
| Phase 5: Feature components | Gallery, Upload, PhotoManagement, UserMenu, forms | Not Started |
| Phase 6: Polish and cleanup | Focus states, reduced motion, theme-color, remove duplication | In Progress |

---

## Phase 1: Design Tokens

**Dependencies:** None.  
**Reference:** design.md §1, design-10-cozy-home.html

### Task 1.1: Cozy Home color palette in Tailwind

**Type:** Frontend  
**Priority:** P0  
**Status:** Done

**Description:**  
Add Cozy Home colors to `theme.extend.colors` so all components can use named tokens instead of hex values.

**Subtasks:**
- [x] Add `cozy` (or equivalent) color scale: background, surface, text, textMuted, heading, accent, accentDark, border, borderCard, mount, and gradient endpoints **[FRONTEND]**
- [x] Add semantic colors (success, error, warning) that fit the palette and meet contrast where used **[FRONTEND]**
- [x] Document token names in design.md or a short README in the repo **_Requirements: Req 1_**

---

### Task 1.2: Typography and font setup

**Type:** Frontend  
**Priority:** P0  
**Status:** Done

**Description:**  
Configure Merriweather (and fallbacks) and typography tokens (sizes, weights, line-heights).

**Subtasks:**
- [x] Add Merriweather (e.g. next/font/google or link) and set as default serif in Tailwind **[FRONTEND]**
- [x] Extend theme with font sizes and line heights used in the sample (logo, tagline, h1–h3, body, caption, button) **[FRONTEND]**
- [x] Update `globals.css` base styles to use Cozy Home body font and line-height **_Requirements: Req 1_**

---

### Task 1.3: Spacing, radius, and shadow tokens

**Type:** Frontend  
**Priority:** P0  
**Status:** Done

**Description:**  
Add spacing, border-radius, and box-shadow tokens that match the sample.

**Subtasks:**
- [x] Add container max-width (1200px) and horizontal padding values for container/section **[FRONTEND]**
- [x] Add border radius tokens (e.g. cozy radius lg 15px, md 12px, sm 10px, input 8px, pill 50px) **[FRONTEND]**
- [x] Add box-shadow tokens (card default, card hover, button) **[FRONTEND]**
- [x] Add breakpoint alignment with sample (768px, 480px) if not already present **_Requirements: Req 1_**

---

### Task 1.4: Base globals and legacy class alignment

**Type:** Frontend  
**Priority:** P0  
**Status:** Done

**Description:**  
Set body background and default text to Cozy Home tokens; update existing utility classes (e.g. `.btn-primary`, `.upload-zone`) to use tokens so they look Cozy Home without breaking existing usage.

**Subtasks:**
- [x] Set `body` background and text color to Cozy Home tokens in `globals.css` **[FRONTEND]**
- [x] Replace hardcoded colors in `.btn-primary`, `.btn-secondary`, `.upload-zone`, and other component-layer classes with theme tokens **[FRONTEND]**
- [x] Update viewport/theme-color meta to a Cozy Home color (e.g. accent or background) in layout **[FRONTEND]** **_Requirements: Req 1_**

---

## Phase 2: UI Primitives

**Dependencies:** Phase 1 complete.

### Task 2.1: Container and Section

**Type:** Frontend  
**Priority:** P0  
**Status:** Done

**Description:**  
Implement shared layout primitives for max-width and padding.

**Subtasks:**
- [x] Create `Container` (or `PageContainer`) component: max-width 1200px, horizontal padding from tokens, optional vertical padding **[FRONTEND]**
- [x] Create `Section` component (optional): vertical padding from tokens; variants if needed (default, hero, cta) **[FRONTEND]**
- [x] Export from `src/components/ui/` (or chosen design-system path) **_Requirements: Req 2_**

---

### Task 2.2: Typography components

**Type:** Frontend  
**Priority:** P0  
**Status:** Done

**Description:**  
Implement Headline, Tagline, Body, Caption (or equivalent) that use only theme tokens.

**Subtasks:**
- [x] Create `Headline`: levels H1–H3, token font/size/weight/color; support `as` for semantics **[FRONTEND]**
- [x] Create `Tagline`: italic, secondary color, token size **[FRONTEND]**
- [x] Create `Body` and `Caption` (or document use of token-based Tailwind classes) **[FRONTEND]**
- [x] Export from ui and use in at least one migrated page to validate **_Requirements: Req 2_**

---

### Task 2.3: Button component

**Type:** Frontend  
**Priority:** P0  
**Status:** Done

**Description:**  
Single Button component with primary (Cozy Home gradient, pill, hover), secondary, and optional ghost variants.

**Subtasks:**
- [x] Create `Button` with variants: primary (gradient, pill radius, hover lift + shadow), secondary (outline or subtle), ghost **[FRONTEND]**
- [x] Support sizes (e.g. default, large for CTA) and full-width on small breakpoints **[FRONTEND]**
- [x] Preserve focus ring and keyboard usability; respect reduced-motion for hover lift **[FRONTEND]**
- [x] Export and use in one page or nav to validate **_Requirements: Req 2, Req 6_**

---

### Task 2.4: Card component

**Type:** Frontend  
**Priority:** P0  
**Status:** Done

**Description:**  
Reusable Card with optional left accent and hover behavior.

**Subtasks:**
- [x] Create `Card`: surface bg, token border/radius/shadow; optional `accentLeft` (left border or bar); optional hover lift **[FRONTEND]**
- [x] Use only tokens (no hardcoded colors) **[FRONTEND]**
- [x] Export and use in one page to validate **_Requirements: Req 2_**

---

### Task 2.5: PhotoMount (optional)

**Type:** Frontend  
**Priority:** P2  
**Status:** Done

**Description:**  
Frame component for “photo in a mount” look (upload preview, gallery tile, before/after).

**Subtasks:**
- [x] Create `PhotoMount` (or `ImageFrame`): mount background, padding, radius; inner area with optional aspect-ratio **[FRONTEND]**
- [x] Use tokens for colors and radius **[FRONTEND]**
- [x] Use in gallery or upload flow where the sample’s frame look is desired **_Requirements: Req 2_**

---

## Phase 3: Layout and Navigation

**Dependencies:** Phase 1 and 2 (at least Container, Button, tokens).

### Task 3.1: Navigation / AppHeader restyle

**Type:** Frontend  
**Priority:** P0  
**Status:** Done

**Description:**  
Apply Cozy Home aesthetic to main nav: logo, tagline, links, container.

**Subtasks:**
- [x] Restyle logo: Merriweather, accent color, token size; optional tagline below **[FRONTEND]**
- [x] Restyle nav links: Cozy Home text and hover (accent or underline); remove blue/gray **[FRONTEND]**
- [x] Add optional top double-border or accent line per sample **[FRONTEND]**
- [x] Use shared Container for nav width and padding **[FRONTEND]** **_Requirements: Req 3, Req 4_**

---

### Task 3.2: AuthenticatedLayout and global bar

**Type:** Frontend  
**Priority:** P0  
**Status:** Done

**Description:**  
Ensure layout and global credit bar use tokens and primitives.

**Subtasks:**
- [x] Wrap main content in Container (or leave to per-page; document decision) **[FRONTEND]**
- [x] Restyle `GlobalCreditBalanceBar` with Cozy Home tokens and Card/Container as appropriate **[FRONTEND]**
- [x] Ensure background behind nav and content uses Cozy Home background token **_Requirements: Req 4_**

---

## Phase 4: Page Migration

**Dependencies:** Phase 1–3; primitives and nav in place.

### Task 4.1: Landing page (home)

**Type:** Frontend  
**Priority:** P0  
**Status:** Done

**Description:**  
Align landing with Cozy Home: hero, feature cards, CTA, buttons.

**Subtasks:**
- [x] Replace layout with Container and Section **[FRONTEND]**
- [x] Use Headline/Tagline/Body for logo, tagline, hero title, hero subtitle **[FRONTEND]**
- [x] Replace value-prop blocks with Card (or FeatureCard) and tokens **[FRONTEND]**
- [x] Replace CTAs with Button primary/secondary **[FRONTEND]**
- [x] Use Cozy Home background; remove blue/gray gradients **_Requirements: Req 3, Req 5_**

---

### Task 4.2: Sign-in and sign-up pages

**Type:** Frontend  
**Priority:** P0  
**Status:** Done

**Description:**  
Restyle auth pages with Container, Card, typography, and Button; optional Input/FormField.

**Subtasks:**
- [x] Wrap content in Container; use Card for form panel **[FRONTEND]**
- [x] Use Headline/Body for titles and descriptions **[FRONTEND]**
- [x] Restyle primary and secondary buttons with Button component **[FRONTEND]**
- [x] Restyle inputs (borders, focus) with tokens; optional shared Input/FormField **[FRONTEND]**
- [x] Use Cozy Home background and spacing **_Requirements: Req 3, Req 5_**

---

### Task 4.3: Auth callback, accept-terms, forgot-password

**Type:** Frontend  
**Priority:** P1  
**Status:** Done

**Description:**  
Apply same Container, Card, typography, and Button to remaining auth-related pages.

**Subtasks:**
- [x] Auth callback: minimal UI with tokens and primitives **[FRONTEND]**
- [x] Accept-terms: Card + typography + Button **[FRONTEND]**
- [x] Forgot-password: form in Card, tokens, Button **[FRONTEND]** **_Requirements: Req 3_**

---

### Task 4.4: Static and subscription pages

**Type:** Frontend  
**Priority:** P1  
**Status:** Done

**Description:**  
Terms, privacy, sign-up success, subscription page to Cozy Home.

**Subtasks:**
- [x] Terms and privacy: Container, typography tokens, optional Card for content blocks **[FRONTEND]**
- [x] Sign-up success: Container, Card, Headline, Body, Button **[FRONTEND]**
- [x] Subscription: Container, Card for plans, Button for actions, tokens throughout **[FRONTEND]** **_Requirements: Req 3_**

---

## Phase 5: Feature Components

**Dependencies:** Phase 1–4.

### Task 5.1: Gallery (photo management) page

**Type:** Frontend  
**Priority:** P0  
**Status:** Done

**Description:**  
Align gallery layout and components with Cozy Home.

**Subtasks:**
- [x] Page wrapper: Container and Cozy Home background **[FRONTEND]**
- [x] Credit balance and any top panels: Card and typography tokens **[FRONTEND]**
- [x] Photo grid/tiles: use Card or PhotoMount where appropriate; token borders/shadows **[FRONTEND]**
- [x] Buttons (e.g. upload, actions): Button component **[FRONTEND]** **_Requirements: Req 3, Req 5_**

---

### Task 5.2: Upload flow components

**Type:** Frontend  
**Priority:** P0  
**Status:** Done

**Description:**  
Restyle upload zone, modals, and preview with tokens and primitives.

**Subtasks:**
- [x] Upload zone: token borders, radius, background (replace gray/blue) **[FRONTEND]**
- [x] Modals and overlays: Card or surface token, Button **[FRONTEND]**
- [x] Preview and cropping UI: borders and controls with tokens **[FRONTEND]** **_Requirements: Req 3_**

---

### Task 5.3: Photo detail drawer and processing options

**Type:** Frontend  
**Priority:** P1  
**Status:** Done

**Description:**  
Drawer and processing panels to Cozy Home.

**Subtasks:**
- [x] Drawer panel: surface color, border/radius/shadow from tokens **[FRONTEND]**
- [x] Processing options panel: Card/typography/Button where applicable **[FRONTEND]**
- [x] Credit display and parameter controls: tokens and primitives **_Requirements: Req 3_**

---

### Task 5.4: UserMenu and shared chrome

**Type:** Frontend  
**Priority:** P1  
**Status:** Done

**Description:**  
User menu, dev menu, and any remaining shared chrome to tokens and primitives.

**Subtasks:**
- [x] UserMenu dropdown: surface, border, typography tokens **[FRONTEND]**
- [x] DevMenu (if visible): align with tokens **[FRONTEND]**
- [x] Any remaining global chrome (e.g. loading screen): Cozy Home background and typography **_Requirements: Req 4_**

---

## Phase 6: Polish and Cleanup

**Dependencies:** Phase 1–5 largely complete.

### Task 6.1: Accessibility and motion

**Type:** Frontend  
**Priority:** P1  
**Status:** Done

**Description:**  
Focus states and reduced-motion behavior.

**Subtasks:**
- [x] Ensure Button, Card (if interactive), and form controls have visible focus ring (accent or high-contrast) **[FRONTEND]**
- [x] Add or verify `prefers-reduced-motion` for hover lift and animations **[FRONTEND]**
- [x] Spot-check contrast (e.g. body text on background) and adjust tokens if needed **_Requirements: Req 6_**

---

### Task 6.2: Remove duplication and document

**Type:** Frontend  
**Priority:** P1  
**Status:** Done

**Description:**  
Remove redundant Cozy Home styling and document the system.

**Subtasks:**
- [x] Search for hardcoded Cozy Home colors/fonts (hex, old blue/gray) and replace with tokens or primitives **[FRONTEND]**
- [x] Deprecate or remove legacy utility classes that duplicate primitives **[FRONTEND]**
- [x] Document token names and primitive usage (design.md or README in repo) **_Requirements: Req 2, Req 7_**

---

### Task 6.3: PWA and theme-color

**Type:** Frontend  
**Priority:** P2  
**Status:** Done

**Description:**  
Align PWA theme-color and any app-shell styling with Cozy Home.

**Subtasks:**
- [x] Set theme-color and related meta tags to Cozy Home accent or background **[FRONTEND]**
- [x] Ensure standalone/splash styling is consistent with Cozy Home **_Requirements: Req 3_**

---

## Summary

- **Phase 1:** Single token source (colors, typography, spacing, radius, shadow) in Tailwind and globals.
- **Phase 2:** Reusable primitives (Container, Section, Button, Card, typography, optional PhotoMount).
- **Phase 3:** Navigation and layout use tokens and primitives.
- **Phase 4:** All main pages (landing, auth, subscription, static) migrated to primitives and tokens.
- **Phase 5:** Gallery, upload, drawer, and shared chrome aligned with Cozy Home.
- **Phase 6:** Accessibility, reduced motion, cleanup of duplication, and documentation.

Implement in order; later phases can overlap once primitives and tokens are stable. Prefer swapping presentational pieces and reusing primitives over rewriting business logic.
