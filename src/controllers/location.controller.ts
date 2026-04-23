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
    const { name, building, floor } = req.body;
    if (!name || !building || floor === undefined) {
      res.status(400).json({ message: 'Tous les champs sont requis.' });
      return;
    }
    const location = await locationService.createLocation({
      name: name as string,
      building: building as string,
      floor: parseInt(floor as string),
    });
    res.status(201).json(location);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const updateLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params['id'] as string);
    const { name, building, floor } = req.body;
    const location = await locationService.updateLocation(id, {
      name: name as string | undefined,
      building: building as string | undefined,
      floor: floor !== undefined ? parseInt(floor as string) : undefined,
    });
    res.json(location);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const deleteLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params['id'] as string);
    await locationService.deleteLocation(id);
    res.status(204).send();
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};