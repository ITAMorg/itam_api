import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { Role } from '.prisma/client';

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export const getUsersByRole = async (role: Role) => {
  return prisma.user.findMany({
    where: { role },
    select: userSelect,
  });
};

export const getAllUsers = async () => {
  return prisma.user.findMany({
    select: userSelect,
    orderBy: { createdAt: 'desc' },
  });
};

export const createUser = async (data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
}) => {
  const hashedPassword = await bcrypt.hash(data.password, 10);
  return prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
    },
    select: userSelect,
  });
};

export const updateUser = async (
  id: number,
  data: {
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: Role;
    isActive?: boolean;
  }
) => {
  const user = await prisma.user.update({
    where: { id },
    data,
    select: userSelect,
  });

  if (data.isActive === false) {
    await prisma.refreshToken.deleteMany({ where: { userId: id } });
  }

  return user;
};

export const deleteUser = async (id: number) => {
  return prisma.user.delete({
    where: { id },
  });
};