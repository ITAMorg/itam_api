import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { conflict, unauthorized } from '../errors/AppError';
import { JwtPayload, LoginRequest, RegisterRequest } from '../types/auth.types';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export const register = async (data: RegisterRequest) => {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw conflict('Cette adresse email est déjà utilisée.');
  }

  const hashed = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashed,
      firstName: data.firstName,
      lastName: data.lastName,
    },
  });

  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

export const login = async (data: LoginRequest) => {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  const invalidCredentials = () =>
    unauthorized('Identifiants invalides.');

  if (!user) throw invalidCredentials();

  const valid = await bcrypt.compare(data.password, user.password);
  if (!valid) throw invalidCredentials();
  if (!user.isActive) throw invalidCredentials();

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    locationId: user.locationId,
  };

  const accessToken = jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
  const refreshToken = jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt },
  });

  const { password: _, ...userWithoutPassword } = user;
  return { accessToken, refreshToken, user: userWithoutPassword };
};

export const refresh = async (token: string) => {
  const invalidToken = () => unauthorized('Jeton de rafraîchissement invalide.');

  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.expiresAt < new Date()) throw invalidToken();

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, REFRESH_SECRET) as JwtPayload;
  } catch {
    throw invalidToken();
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive) throw invalidToken();

  const accessToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      locationId: user.locationId,
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN } as jwt.SignOptions
  );

  return { accessToken };
};

export const logout = async (token: string) => {
  await prisma.refreshToken.deleteMany({ where: { token } });
};