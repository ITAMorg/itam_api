import prisma from '../config/prisma';
import { Role } from '.prisma/client';

export const getUsersByRole = async (role: Role) => {
  const users = await prisma.user.findMany({
    where: { role },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return users;
};