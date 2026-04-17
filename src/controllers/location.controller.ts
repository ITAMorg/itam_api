import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as locationService from '../services/location.service';

export const getLocations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const locations = await locationService.getLocations();
    res.json(locations);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const createLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const location = await locationService.createLocation(req.body);
    res.status(201).json(location);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};