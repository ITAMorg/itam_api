import prisma from '../config/prisma';
import { $Enums } from '@prisma/client';
import { CreateAssetDto, UpdateAssetDto, AssetFilters } from '../types/asset.types';

const assetInclude = {
  type: true,
  supplier: true,
  location: true,
};

export const getAssets = async (filters: AssetFilters) => {
  const { status, typeId, supplierId, locationId, search } = filters;

  return prisma.asset.findMany({
    where: {
      ...(status && { status }),
      ...(typeId && { typeId }),
      ...(supplierId && { supplierId }),
      ...(locationId && { locationId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    include: assetInclude,
    orderBy: { createdAt: 'desc' },
  });
};

export const getAssetsByLocation = async (locationId: number) => {
  return prisma.asset.findMany({
    where: { locationId },
    include: assetInclude,
    orderBy: { createdAt: 'desc' },
  });
};

export const getAssetById = async (id: number) => {
  return prisma.asset.findUnique({
    where: { id },
    include: {
      ...assetInclude,
      history: {
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });
};

export const createAsset = async (dto: CreateAssetDto, userId: number) => {
  const asset = await prisma.asset.create({
    data: {
      name: dto.name,
      serialNumber: dto.serialNumber,
      brand: dto.brand,
      model: dto.model,
      status: dto.status ?? $Enums.AssetStatus.IN_STOCK,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
      warrantyEnd: dto.warrantyEnd ? new Date(dto.warrantyEnd) : null,
      typeId: dto.typeId,
      supplierId: dto.supplierId,
      locationId: dto.locationId,
    },
    include: assetInclude,
  });

  await prisma.assetLifecycle.create({
    data: {
      assetId: asset.id,
      userId,
      event: 'CREATED',
      note: `Asset "${asset.name}" créé avec le statut ${asset.status}`,
    },
  });

  return asset;
};

export const updateAsset = async (id: number, dto: UpdateAssetDto, userId: number) => {
  const previous = await prisma.asset.findUnique({ where: { id } });
  if (!previous) return null;

  const asset = await prisma.asset.update({
    where: { id },
    data: {
      ...(dto.name && { name: dto.name }),
      ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
      ...(dto.brand !== undefined && { brand: dto.brand }),
      ...(dto.model !== undefined && { model: dto.model }),
      ...(dto.status && { status: dto.status }),
      ...(dto.purchaseDate !== undefined && {
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
      }),
      ...(dto.warrantyEnd !== undefined && {
        warrantyEnd: dto.warrantyEnd ? new Date(dto.warrantyEnd) : null,
      }),
      ...(dto.typeId && { typeId: dto.typeId }),
      ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
      ...(dto.locationId !== undefined && { locationId: dto.locationId }),
    },
    include: assetInclude,
  });

  const changes: string[] = [];
  if (dto.status && dto.status !== previous.status)
    changes.push(`statut: ${previous.status} → ${dto.status}`);
  if (dto.locationId !== undefined && dto.locationId !== previous.locationId)
    changes.push(`location: ${previous.locationId ?? 'stock'} → ${dto.locationId ?? 'stock'}`);

  await prisma.assetLifecycle.create({
    data: {
      assetId: id,
      userId,
      event: 'UPDATED',
      note: changes.length > 0 ? changes.join(', ') : 'Mise à jour des informations',
    },
  });

  return asset;
};

export const deleteAsset = async (id: number, userId: number) => {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return null;

  await prisma.assetLifecycle.create({
    data: {
      assetId: id,
      userId,
      event: 'DELETED',
      note: `Asset "${asset.name}" supprimé`,
    },
  });

  return prisma.asset.delete({ where: { id } });
};