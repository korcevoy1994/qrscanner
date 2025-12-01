export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'scanner';
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  user?: Omit<User, 'id'>;
  token?: string;
}

export interface AuthState {
  user: Omit<User, 'id'> | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
