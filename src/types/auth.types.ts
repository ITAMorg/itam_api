export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  locationId?: number | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}