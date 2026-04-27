import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as assetTypeService from '../services/asset_type.service';

export const getAssetTypes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assetTypes = await assetTypeService.getAssetTypes();
    res.json(assetTypes);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const createAssetType = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const name = req.body.name as string;
    if (!name) {
      res.status(400).json({ message: 'Le nom est requis.' });
      return;
    }
    const assetType = await assetTypeService.createAssetType({
      name,
      iconKey: req.body.iconKey as string | undefined,
      colorKey: req.body.colorKey as string | undefined,
    });
    res.status(201).json(assetType);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const updateAssetType = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params['id'] as string);
    const assetType = await assetTypeService.updateAssetType(id, {
      name: req.body.name as string | undefined,
      iconKey: req.body.iconKey as string | undefined,
      colorKey: req.body.colorKey as string | undefined,
    });
    res.json(assetType);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const deleteAssetType = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params['id'] as string);
    await assetTypeService.deleteAssetType(id);
    res.status(204).send();
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};