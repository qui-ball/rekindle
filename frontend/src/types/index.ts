// Core application types
export interface User {
  id: string;
  email: string;
  tier: 'free' | 'remember' | 'cherish' | 'forever';
}

// API Response types
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Upload system types
export * from './upload';