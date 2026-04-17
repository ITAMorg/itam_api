import prisma from '../config/prisma';
import { CreateLocationDto } from '../types/location.types';

export const getLocations = async () => {
  return prisma.location.findMany({
    orderBy: { name: 'asc' },
  });
};

export const createLocation = async (dto: CreateLocationDto) => {
  return prisma.location.create({ data: dto });
};