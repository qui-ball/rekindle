# UI Redesign: Cozy Home Design System - Requirements

## Introduction

This spec defines the redesign of the Rekindle application UI to follow the **Cozy Home** design sample (`design-samples/design-10-cozy-home.html`). The goal is a **seamless, uniform design across the application** achieved through a **modular, reusable component set** and a **single source of truth** for tokens (colors, typography, spacing, radii, shadows). This reduces code duplication, keeps the UI consistent as new features are added, and aligns the product with the warm, nostalgic “family memories” tone of the sample.

**Design Reference:** `design-samples/design-10-cozy-home.html`

**Related Documents:**
- `.kiro/steering/product-and-sales-strategy.md` - Emotional-first, 30–60 demographic
- `.kiro/steering/development-standards.md` - Component structure, naming

---

## Requirements

### Requirement 1: Single Design Token Source

**User Story:** As a developer, I want one place that defines the Cozy Home theme (colors, typography, spacing, radii, shadows) so that the whole app stays consistent and changes are easy.

#### Acceptance Criteria

1. WHEN building or refactoring UI THEN the system SHALL use a single theme/token source (e.g. Tailwind theme extension + optional CSS variables) derived from the Cozy Home sample
2. WHEN defining colors THEN the system SHALL include at least: background, surface, text (primary, secondary, muted), accent/border (e.g. gold/tan), and semantic variants (success, error, warning) that fit the Cozy Home palette
3. WHEN defining typography THEN the system SHALL use Merriweather (or fallback) for headings and body as in the sample; font sizes and line heights SHALL be defined as tokens
4. WHEN defining spacing, border radius, and shadows THEN the system SHALL use named tokens used consistently across components
5. WHEN a designer or developer changes a token THEN the change SHALL apply app-wide without hunting through component files for hardcoded values

### Requirement 2: Reusable UI Primitives (No Duplication)

**User Story:** As a developer, I want shared primitives (Button, Card, Container, typography components) so that I don’t duplicate layout and styling code.

#### Acceptance Criteria

1. WHEN rendering a primary action THEN the system SHALL use a shared Button (or variant) component that implements the Cozy Home primary button style (gradient, pill shape, hover)
2. WHEN rendering a card or panel THEN the system SHALL use a shared Card (or variant) component with Cozy Home border, radius, shadow, and optional hover
3. WHEN constraining page width and padding THEN the system SHALL use a shared Container (max-width, horizontal padding) matching the sample
4. WHEN rendering headings, taglines, or body text THEN the system SHALL use shared typography components or utility classes from the token set so that heading levels and body style are consistent
5. WHEN a new page or feature is built THEN the developer SHALL be able to compose it from these primitives without re-implementing Cozy Home styles
6. WHEN the same visual pattern appears in multiple places (e.g. “feature card”, “section with title + subtitle”) THEN the system SHALL implement it once and reuse it to avoid code duplication

### Requirement 3: Uniform Application of Cozy Home Aesthetic

**User Story:** As a user, I want the whole app to feel like the Cozy Home sample—warm, nostalgic, and consistent—so that the experience is cohesive.

#### Acceptance Criteria

1. WHEN a user visits any page (landing, sign-in, gallery, upload, subscription, etc.) THEN the visual language SHALL match the Cozy Home sample: serif typography, warm neutrals, gold/tan accents, soft shadows, and rounded surfaces
2. WHEN the user navigates between pages THEN the header/navigation, buttons, cards, and backgrounds SHALL feel like one design system, not a mix of blue/gray and Cozy Home
3. WHEN the app uses icons or decorative elements THEN they SHALL use the same accent colors and style (e.g. border-left accent, double-border header) where applicable
4. WHEN the app is viewed on mobile or tablet THEN the responsive behavior SHALL follow the same breakpoints and patterns as the sample (e.g. stacked layout, full-width buttons) while preserving the aesthetic

### Requirement 4: Layout and Navigation Alignment

**User Story:** As a user, I want the main layout (header, nav, content area) to follow the Cozy Home look so that branding and navigation feel part of the same experience.

#### Acceptance Criteria

1. WHEN the user is authenticated THEN the main navigation/header SHALL use Cozy Home colors, typography, and borders (e.g. logo style, nav link styling, optional double-border or accent line) instead of the current blue/gray scheme
2. WHEN the app shows a global bar (e.g. credit balance) THEN it SHALL use the same token set and Card/Container primitives so it blends with the rest of the UI
3. WHEN the main content area is rendered THEN it SHALL sit inside the shared Container and use the same background and spacing tokens as the sample
4. WHEN the app has a “logo” or app name in the header THEN it SHALL use the Cozy Home logo style (e.g. Merriweather, accent color, optional tagline)

### Requirement 5: Page-Level Consistency Without Rewriting Logic

**User Story:** As a developer, I want to migrate existing pages to the new design by swapping in primitives and tokens, not by rewriting business logic.

#### Acceptance Criteria

1. WHEN migrating a page THEN the system SHALL allow replacing only layout and presentational parts (containers, cards, buttons, typography) while keeping existing state, hooks, and API calls
2. WHEN a page uses forms (e.g. sign-in, sign-up) THEN form inputs SHALL be restyled to match Cozy Home (borders, focus states, labels) via shared Input/FormField components or token-based classes
3. WHEN a page shows loading or empty states THEN the system SHALL use the same Container, Card, and typography primitives so that loading/empty states match the rest of the app
4. WHEN a page has a primary CTA THEN it SHALL use the shared Button primary variant so that all CTAs look consistent

### Requirement 6: Accessibility and Responsiveness Preserved

**User Story:** As a user, I want the redesigned UI to remain accessible and responsive so that the product works for everyone and on all devices.

#### Acceptance Criteria

1. WHEN the theme is applied THEN contrast SHALL meet WCAG AA for text and interactive elements (Cozy Home colors may need minor tweaks for contrast where necessary)
2. WHEN using shared Button and Card components THEN focus states and keyboard navigation SHALL be preserved or improved
3. WHEN viewport size changes THEN layout SHALL adapt using the same responsive strategy as the sample (e.g. breakpoints at 768px and 480px) and touch targets SHALL remain adequate on mobile
4. WHEN the app is used with reduced motion preferences THEN the system SHALL respect `prefers-reduced-motion` for animations (e.g. hover lift) where implemented

### Requirement 7: Documented Design System for Future Work

**User Story:** As a developer or designer, I want a clear record of tokens and components so that new features use the system correctly.

#### Acceptance Criteria

1. WHEN a developer adds a new screen THEN they SHALL be able to find token names (e.g. `cozy.bg`, `cozy.accent`) and primitive components in the codebase and/or spec
2. WHEN a new primitive is needed THEN the pattern for adding it (e.g. where it lives, how it uses tokens) SHALL be documented so that the system stays modular and consistent
3. WHEN the Cozy Home sample is updated THEN the spec or design doc SHALL describe how to sync tokens and components with the sample

---

## Out of Scope (This Spec)

- Changing product copy or user flows (only visual and structural refactor).
- New features (e.g. albums UI); those specs use this design system once it exists.
- Replacing state management or routing; redesign is presentational.
- Standalone design tool (Figma/Sketch); reference remains the HTML sample and the implemented tokens/components.

---

## Success Criteria

- One theme/token source drives the entire app’s Cozy Home look.
- Reusable primitives (Button, Card, Container, typography) exist and are used across pages; no duplicated Cozy Home styling in multiple places.
- Landing, auth, gallery, upload, subscription, and any shared layout (nav, credit bar) use the Cozy Home aesthetic consistently.
- New pages can be built by composing primitives and tokens; existing pages are migrated without rewriting business logic.
- Accessibility and responsiveness are maintained or improved.
- Design decisions and token/component usage are documented for future work.
