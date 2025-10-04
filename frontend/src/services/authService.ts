/**
 * Authentication Service
 * Handles authentication token management and user session
 */

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  subscriptionTier?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

class AuthService {
  private static instance: AuthService;
  private tokens: AuthTokens | null = null;
  private user: AuthUser | null = null;

  private constructor() {
    this.loadTokensFromStorage();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Get the current access token
   */
  async getAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error('No authentication token available');
    }

    // Check if token is expired
    if (Date.now() >= this.tokens.expiresAt) {
      if (this.tokens.refreshToken) {
        await this.refreshAccessToken();
      } else {
        throw new Error('Authentication token expired');
      }
    }

    return this.tokens.accessToken;
  }

  /**
   * Get the current user information
   */
  getCurrentUser(): AuthUser | null {
    return this.user;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.tokens !== null && this.user !== null;
  }

  /**
   * Set authentication tokens and user info
   */
  setAuth(tokens: AuthTokens, user: AuthUser): void {
    this.tokens = tokens;
    this.user = user;
    this.saveTokensToStorage();
  }

  /**
   * Clear authentication data
   */
  clearAuth(): void {
    this.tokens = null;
    this.user = null;
    this.clearTokensFromStorage();
  }

  /**
   * Refresh the access token using refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: this.tokens.refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      this.tokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || this.tokens.refreshToken,
        expiresAt: Date.now() + (data.expiresIn * 1000),
      };

      this.saveTokensToStorage();
    } catch (error) {
      console.error('Failed to refresh token:', error);
      this.clearAuth();
      throw error;
    }
  }

  /**
   * Load tokens from localStorage
   */
  private loadTokensFromStorage(): void {
    try {
      const storedTokens = localStorage.getItem('auth_tokens');
      const storedUser = localStorage.getItem('auth_user');

      if (storedTokens && storedUser) {
        this.tokens = JSON.parse(storedTokens);
        this.user = JSON.parse(storedUser);
      }
    } catch (error) {
      console.error('Failed to load tokens from storage:', error);
      this.clearAuth();
    }
  }

  /**
   * Save tokens to localStorage
   */
  private saveTokensToStorage(): void {
    try {
      if (this.tokens) {
        localStorage.setItem('auth_tokens', JSON.stringify(this.tokens));
      }
      if (this.user) {
        localStorage.setItem('auth_user', JSON.stringify(this.user));
      }
    } catch (error) {
      console.error('Failed to save tokens to storage:', error);
    }
  }

  /**
   * Clear tokens from localStorage
   */
  private clearTokensFromStorage(): void {
    try {
      localStorage.removeItem('auth_tokens');
      localStorage.removeItem('auth_user');
    } catch (error) {
      console.error('Failed to clear tokens from storage:', error);
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
export default authService;
