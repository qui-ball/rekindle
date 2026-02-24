# Review: Tasks 6.1–6.3 Completeness

**Date:** 2025-02-22  
**Scope:** Phase 6 (Accessibility and motion, Remove duplication and document, PWA and theme-color)  
**Method:** Spec/task checklist vs local implementation; grep for focus rings, motion, tokens, PWA config.

---

## Summary

- **Task 6.1:** Implementation is **complete** in code (focus rings, reduced motion, contrast note), but **tasks.md was not updated** — 6.1 still shows "Not Started" and unchecked subtasks. One small **improvement**: use `focus-visible` on the PhotoStatusIndicator retry button.
- **Task 6.2:** **Complete.** tasks.md marked Done; hardcoded blue/gray replaced across listed components; README documents tokens and primitives; legacy `.btn-*` deprecated. A few optional leftovers (test/dev files, Google brand colors, overlay guides) are documented below.
- **Task 6.3:** **Complete.** theme-color, manifest, and standalone styling use Cozy background `#faf5f0`; no gaps found.

---

## Task 6.1: Accessibility and motion

| Subtask | Implemented in code? | Notes |
|--------|------------------------|--------|
| Button, Card, form controls have visible focus ring (accent or high-contrast) | ✅ | Button: `focus-visible:ring-2 focus-visible:ring-cozy-accent` in baseClasses. Card: `focus-visible` and `focus-within` rings. Form controls (sign-in, sign-up, forgot-password, accept-terms, ProcessingParameterDrawer, ProcessingOptionsPanel): `focus:outline-none focus-visible:ring-2 focus-visible:ring-cozy-accent` (and border where relevant). |
| Add or verify `prefers-reduced-motion` for hover lift and animations | ✅ | Button primary: `motion-safe:hover:-translate-y-[3px] motion-reduce:hover:translate-y-0`. Card hover: `motion-safe:hover:-translate-y-5`, `motion-reduce:hover:translate-y-0`. globals.css `.btn-primary`: `motion-safe` / `motion-reduce`. PhotoGallery tiles: `motion-safe:hover:scale-105 motion-reduce:hover:scale-100`. DragDropZone: `motion-safe:scale-105 motion-reduce:scale-100` and icon `motion-safe:scale-110 motion-reduce:scale-100`. |
| Spot-check contrast; adjust tokens if needed | ✅ | design.md documents: "Task 6.1 contrast spot-check (Feb 2025): Body text and primary button meet WCAG AA. No token changes were required." |

**Gaps addressed in this review:**

- **tasks.md:** Task 6.1 Status set to **Done** and all three subtasks marked `[x]`.
- **PhotoStatusIndicator.tsx:** Retry button updated from `focus:ring-*` to `focus-visible:ring-*` for keyboard-only focus ring consistency.

---

## Task 6.2: Remove duplication and document

| Subtask | Status | Notes |
|--------|--------|--------|
| Search for hardcoded colors/fonts (hex, blue/gray); replace with tokens or primitives | ✅ | CreditBalanceBar, CreditBalanceDisplay, ErrorBoundary, SmartCroppingIndicator, QuadrilateralCropper, CameraCaptureFlow, CameraCapture, AppLoadingScreen, PhotoStatusIndicator (and related tests) updated to Cozy tokens and Button/Card/Headline/Body. |
| Deprecate or remove legacy utility classes that duplicate primitives | ✅ | globals.css `.btn-primary` and `.btn-secondary` marked legacy with comment to prefer Button component. README states they are deprecated. |
| Document token names and primitive usage | ✅ | frontend/README.md has "Cozy Home Design System" with tokens (colors, typography, spacing, radius, shadow, breakpoints) and primitives table (Container, Section, Button, Card, Headline, Tagline, Body, Caption, PhotoMount). References design.md. |

**Optional leftovers (non-blocking):**

- **TestJScanifyIntegration.tsx:** `border-gray-300` on a dev-only test container — could use `border-cozy-borderCard` for consistency.
- **Sign-in / sign-up:** Google OAuth SVG paths use brand hex colors (`#4285F4`, `#34A853`, etc.) — intentional; no change needed.
- **CornerGuideOverlay.tsx:** `portraitColor = '#2196f3'`, `landscapeColor = '#ffeb3b'` — guide overlay; could be tokenized (e.g. cozySemantic.info and warning) in a future pass if desired.
- **CornerGuideOverlay.css:** `#ffffff` in box-shadow — decorative; fine as-is.

No gaps; task is complete.

---

## Task 6.3: PWA and theme-color

| Subtask | Status | Notes |
|--------|--------|--------|
| Set theme-color and related meta tags to Cozy Home accent or background | ✅ | layout.tsx: `viewport.themeColor: '#faf5f0'`; `metadata.appleWebApp.statusBarStyle: 'black-translucent'`; `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`; `<meta name="msapplication-TileColor" content="#faf5f0" />`. |
| Ensure standalone/splash styling consistent with Cozy Home | ✅ | manifest.json: `theme_color` and `background_color` set to `#faf5f0`. globals.css: `@media (display-mode: standalone) { body { background-color: #faf5f0; } }`. |

No gaps; task is complete.

---

## Recommended next steps

1. **Task 6.1 (spec):** In `.kiro/specs/ui-cozy-home-redesign/tasks.md`, mark all three Task 6.1 subtasks as done (`[x]`) and set Task 6.1 **Status** to **Done**.
2. **Task 6.1 (improvement):** In `PhotoStatusIndicator.tsx`, change the retry button from `focus:ring-2 focus:ring-cozy-accent` to `focus-visible:ring-2 focus-visible:ring-cozy-accent` (and keep `focus:outline-none`).
3. **Optional (6.2):** Replace `border-gray-300` in TestJScanifyIntegration.tsx with `border-cozy-borderCard` for consistency.
