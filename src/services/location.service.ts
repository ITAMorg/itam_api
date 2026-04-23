import prisma from '../config/prisma';
import { CreateLocationDto, UpdateLocationDto } from '../types/location.types';

export const getLocations = async () => {
  return prisma.location.findMany({
    orderBy: { name: 'asc' },
  });
};

export const createLocation = async (dto: CreateLocationDto) => {
  return prisma.location.create({ data: dto });
};

export const updateLocation = async (id: number, dto: UpdateLocationDto) => {
  return prisma.location.update({
    where: { id },
    data: dto,
  });
};

export const deleteLocation = async (id: number) => {
  return prisma.location.delete({
    where: { id },
  });
};