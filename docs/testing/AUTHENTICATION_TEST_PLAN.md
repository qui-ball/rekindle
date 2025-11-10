# Authentication Testing Plan

## Overview

This document outlines the tests needed for authentication functionality, including sign-in, sign-up, OAuth flows, and session management.

## Testing Framework

- **Framework**: Jest + React Testing Library
- **Test Location**: `frontend/src/app/__tests__/` and `frontend/src/contexts/__tests__/`
- **Pattern**: Follow existing test patterns in `frontend/src/components/__tests__/`

## Test Files to Create

### 1. AuthContext Tests
**File**: `frontend/src/contexts/__tests__/AuthContext.test.tsx`

**Test Cases:**
- ✅ Initial state (loading, no user)
- ✅ Sign in with email/password (success)
- ✅ Sign in with email/password (invalid credentials)
- ✅ Sign in with email/password (network error)
- ✅ Sign up with email/password (success)
- ✅ Sign up with email/password (weak password)
- ✅ Sign up with email/password (email already exists)
- ✅ Sign up with email/password (includes metadata)
- ✅ Sign out (clears session)
- ✅ Sign out (clears sessionStorage)
- ✅ Sign out (clears cookies via Supabase)
- ✅ OAuth sign in (Google) - initiates flow
- ✅ OAuth sign in (Facebook) - initiates flow
- ✅ OAuth sign in (Apple) - initiates flow
- ✅ OAuth sign in (includes prompt: select_account)
- ✅ OAuth sign in (stores original hostname in sessionStorage)
- ✅ Accept terms (updates user metadata)
- ✅ Accept terms (redirects after acceptance)
- ✅ Session refresh
- ✅ Auth state change listener (SIGNED_IN)
- ✅ Auth state change listener (SIGNED_OUT)
- ✅ Auth state change listener (TOKEN_REFRESHED)
- ✅ Error handling and state management
- ✅ Loading states during auth operations

### 2. Sign-In Page Tests
**File**: `frontend/src/app/sign-in/__tests__/page.test.tsx`

**Test Cases:**
- ✅ Renders sign-in form
- ✅ Shows email and password fields
- ✅ Shows "Forgot Password" link
- ✅ Shows OAuth buttons (Google, Facebook, Apple)
- ✅ OAuth buttons appear after email/password form
- ✅ Email/password form submission (valid)
- ✅ Email/password form submission (invalid email)
- ✅ Email/password form submission (missing password)
- ✅ Displays error messages
- ✅ Shows loading state during sign-in
- ✅ Redirects to intended destination after sign-in
- ✅ Redirects to /upload if no next parameter
- ✅ Handles OAuth button clicks
- ✅ OAuth redirects to correct URL
- ✅ Form validation (email format)
- ✅ Form validation (password required)
- ✅ Error message display and clearing
- ✅ Link to sign-up page works
- ✅ Responsive design (mobile/desktop)

### 3. Sign-Up Page Tests
**File**: `frontend/src/app/sign-up/__tests__/page.test.tsx`

**Test Cases:**
- ✅ Renders sign-up form
- ✅ Shows email, password, and confirm password fields
- ✅ Shows terms of service checkbox
- ✅ Terms checkbox appears before OAuth buttons
- ✅ Terms checkbox is required for email/password sign-up
- ✅ OAuth buttons are not disabled by terms checkbox
- ✅ Shows notice about terms for OAuth sign-up
- ✅ Email/password form submission (valid)
- ✅ Email/password form submission (password mismatch)
- ✅ Email/password form submission (weak password)
- ✅ Email/password form submission (email already exists)
- ✅ Email/password form submission (terms not accepted)
- ✅ Displays error messages
- ✅ Shows loading state during sign-up
- ✅ Redirects to success page after sign-up
- ✅ Handles OAuth button clicks
- ✅ OAuth redirects to correct URL
- ✅ Form validation (email format)
- ✅ Form validation (password match)
- ✅ Form validation (password strength)
- ✅ Form validation (terms required)
- ✅ Error message display and clearing
- ✅ Link to sign-in page works
- ✅ Responsive design (mobile/desktop)

### 4. OAuth Callback Page Tests
**File**: `frontend/src/app/auth/callback/__tests__/page.test.tsx`

**Test Cases:**
- ✅ Renders loading state initially
- ✅ Handles OAuth callback with code
- ✅ Handles OAuth callback with error
- ✅ Exchanges code for session
- ✅ Redirects to accept-terms if user hasn't accepted
- ✅ Redirects to intended destination if terms accepted
- ✅ Handles redirect from 127.0.0.1 to original hostname (mobile)
- ✅ Uses sessionStorage to restore original hostname
- ✅ Handles existing session (doesn't re-exchange code)
- ✅ Handles missing code parameter
- ✅ Handles exchange errors
- ✅ Preserves next parameter in redirect
- ✅ Shows appropriate error messages
- ✅ Handles PKCE code verifier from cookies

### 5. Accept Terms Page Tests
**File**: `frontend/src/app/auth/accept-terms/__tests__/page.test.tsx`

**Test Cases:**
- ✅ Renders terms acceptance form
- ✅ Shows terms and privacy policy links
- ✅ Requires checkbox to be checked
- ✅ Accepts terms and updates user metadata
- ✅ Redirects to intended destination after acceptance
- ✅ Redirects unauthenticated users to sign-in
- ✅ Redirects users who already accepted terms
- ✅ Shows loading state during acceptance
- ✅ Displays error messages
- ✅ Preserves next parameter in redirect

### 6. RequireAuth Component Tests
**File**: `frontend/src/components/__tests__/RequireAuth.test.tsx`

**Test Cases:**
- ✅ Renders children when user is authenticated
- ✅ Redirects to sign-in when user is not authenticated
- ✅ Preserves intended destination in next parameter
- ✅ Shows loading state while checking auth
- ✅ Handles auth loading state
- ✅ Works with different protected routes

### 7. UserMenu Component Tests
**File**: `frontend/src/components/__tests__/UserMenu.test.tsx`

**Test Cases:**
- ✅ Renders user menu when authenticated
- ✅ Shows user name and email
- ✅ Shows profile picture
- ✅ Opens dropdown on click
- ✅ Closes dropdown on outside click
- ✅ Sign out button triggers signOut
- ✅ Sign out redirects to landing page
- ✅ Handles sign out errors gracefully
- ✅ Doesn't render when not authenticated
- ✅ Doesn't render when loading

### 8. OAuth Flow Integration Tests
**File**: `frontend/src/app/__tests__/oauth-flow.integration.test.tsx`

**Test Cases:**
- ✅ Complete OAuth flow (Google)
- ✅ Complete OAuth flow (Facebook)
- ✅ Complete OAuth flow (Apple)
- ✅ OAuth flow with terms acceptance
- ✅ OAuth flow with existing session
- ✅ OAuth flow with mobile redirect (127.0.0.1 → IP)
- ✅ OAuth flow preserves next parameter
- ✅ OAuth flow handles errors gracefully
- ✅ OAuth flow clears sessionStorage on sign out

## Mocking Strategy

### Supabase Client Mocking

```typescript
// Mock Supabase client
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
  getSupabaseClient: jest.fn(),
}));

// Mock Supabase auth methods
const mockSignIn = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockGetSession = jest.fn();
const mockGetUser = jest.fn();
const mockOnAuthStateChange = jest.fn();
```

### Next.js Router Mocking

```typescript
// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));
```

### Window/Location Mocking

```typescript
// Mock window.location for OAuth redirects
Object.defineProperty(window, 'location', {
  value: {
    protocol: 'http:',
    hostname: 'localhost',
    port: '3000',
    origin: 'http://localhost:3000',
  },
  writable: true,
});
```

## Test Data & Fixtures

### Mock Users

```typescript
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  user_metadata: {
    full_name: 'Test User',
    accepted_terms: true,
    terms_accepted_at: '2025-01-01T00:00:00Z',
  },
};

const mockUserWithoutTerms = {
  id: 'user-456',
  email: 'newuser@example.com',
  user_metadata: {},
};
```

### Mock Sessions

```typescript
const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_at: Date.now() + 3600,
  user: mockUser,
};
```

### Mock OAuth Responses

```typescript
const mockOAuthData = {
  url: 'https://accounts.google.com/o/oauth2/v2/auth?...',
};

const mockOAuthError = {
  message: 'OAuth error occurred',
  status: 400,
};
```

## Test Coverage Goals

- **AuthContext**: 90%+ coverage
- **Sign-In Page**: 85%+ coverage
- **Sign-Up Page**: 85%+ coverage
- **OAuth Callback**: 80%+ coverage
- **Accept Terms Page**: 80%+ coverage
- **RequireAuth Component**: 90%+ coverage
- **UserMenu Component**: 85%+ coverage

## Testing Best Practices

1. **Isolation**: Each test should be independent
2. **Mocking**: Mock external dependencies (Supabase, Next.js router)
3. **User Interactions**: Use `@testing-library/user-event` for realistic interactions
4. **Async Handling**: Properly handle async operations with `waitFor` and `findBy`
5. **Error Scenarios**: Test both success and error paths
6. **Edge Cases**: Test boundary conditions and edge cases
7. **Accessibility**: Test that components are accessible
8. **Responsive**: Test mobile and desktop views

## Running Tests

```bash
# Run all authentication tests
npm test -- --testPathPattern="auth|sign|oauth"

# Run specific test file
npm test -- AuthContext.test.tsx

# Run with coverage
npm test -- --coverage --testPathPattern="auth|sign|oauth"

# Run in watch mode
npm test -- --watch --testPathPattern="auth|sign|oauth"
```

## Priority Order

### Phase 1: Core Authentication (P0)
1. AuthContext tests (sign in, sign up, sign out)
2. Sign-In page tests
3. Sign-Up page tests
4. RequireAuth component tests

### Phase 2: OAuth Flow (P0)
5. OAuth callback page tests
6. Accept terms page tests
7. OAuth flow integration tests

### Phase 3: UI Components (P1)
8. UserMenu component tests
9. Error handling and edge cases
10. Responsive design tests

## Notes

- Some tests may require mocking browser APIs (sessionStorage, cookies)
- OAuth flow tests may need to mock the redirect behavior
- Integration tests may require a test Supabase instance or extensive mocking
- Consider using MSW (Mock Service Worker) for API mocking if needed

