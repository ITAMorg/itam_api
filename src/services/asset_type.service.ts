import prisma from '../config/prisma';
import { CreateAssetTypeDto, UpdateAssetTypeDto } from '../types/asset_type.types';

export const getAssetTypes = async () => {
  return prisma.assetType.findMany({
    orderBy: { name: 'asc' },
  });
};

export const createAssetType = async (dto: CreateAssetTypeDto) => {
  return prisma.assetType.create({ data: dto });
};

export const updateAssetType = async (id: number, dto: UpdateAssetTypeDto) => {
  return prisma.assetType.update({
    where: { id },
    data: dto,
  });
};

export const deleteAssetType = async (id: number) => {
  return prisma.assetType.delete({
    where: { id },
  });
};