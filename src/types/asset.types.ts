import { $Enums } from '@prisma/client';

export interface CreateAssetDto {
  name: string;
  serialNumber?: string;
  brand?: string;
  model?: string;
  status?: $Enums.AssetStatus;
  purchaseDate?: string;
  warrantyEnd?: string;
  typeId: number;
  supplierId?: number;
  locationId?: number;
}

export interface UpdateAssetDto {
  name?: string;
  serialNumber?: string;
  brand?: string;
  model?: string;
  status?: $Enums.AssetStatus;
  purchaseDate?: string;
  warrantyEnd?: string;
  typeId?: number;
  supplierId?: number;
  locationId?: number;
}

export interface AssetFilters {
  status?: $Enums.AssetStatus;
  typeId?: number;
  supplierId?: number;
  locationId?: number;
  search?: string;
}