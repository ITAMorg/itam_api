import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as assetService from '../services/asset.service';
import { $Enums } from '@prisma/client';

export const getAssetQrCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: 'ID invalide' });
      return;
    }

    const buffer = await assetService.generateAssetQrCode(id);
    if (!buffer) {
      res.status(404).json({ message: 'Asset non trouvé' });
      return;
    }

    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getAssets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, typeId, supplierId, locationId, search } = req.query;

    const assets = await assetService.getAssets({
      status: status as $Enums.AssetStatus | undefined,
      typeId: typeId ? Number(typeId) : undefined,
      supplierId: supplierId ? Number(supplierId) : undefined,
      locationId: locationId ? Number(locationId) : undefined,
      search: search as string | undefined,
    });

    res.json(assets);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getAssetsByLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const locationId = Number(req.params.locationId);
    if (isNaN(locationId)) {
      res.status(400).json({ message: 'locationId invalide' });
      return;
    }

    const assets = await assetService.getAssetsByLocation(locationId);
    res.json(assets);
  } catch (error) {
    console.error('getAssetsByLocation error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getAssetById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: 'ID invalide' });
      return;
    }

    const asset = await assetService.getAssetById(id);
    if (!asset) {
      res.status(404).json({ message: 'Asset non trouvé' });
      return;
    }

    res.json(asset);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const createAsset = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const asset = await assetService.createAsset(req.body, userId);
    res.status(201).json(asset);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const updateAsset = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: 'ID invalide' });
      return;
    }

    const userId = req.user!.userId;
    const asset = await assetService.updateAsset(id, req.body, userId);
    if (!asset) {
      res.status(404).json({ message: 'Asset non trouvé' });
      return;
    }

    res.json(asset);
  } catch (error) {
    console.error('updateAsset error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const deleteAsset = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: 'ID invalide' });
      return;
    }

    const userId = req.user!.userId;
    const asset = await assetService.deleteAsset(id, userId);
    if (!asset) {
      res.status(404).json({ message: 'Asset non trouvé' });
      return;
    }

    res.status(204).send();
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};