import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as supplierService from '../services/supplier.service';

export const getSuppliers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const suppliers = await supplierService.getSuppliers();
    res.json(suppliers);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const createSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const name = req.body.name as string;
    if (!name) {
      res.status(400).json({ message: 'Le nom est requis.' });
      return;
    }
    const supplier = await supplierService.createSupplier({
      name,
      contactEmail: req.body.contactEmail as string | undefined,
      contactPhone: req.body.contactPhone as string | undefined,
      address: req.body.address as string | undefined,
    });
    res.status(201).json(supplier);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const updateSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params['id'] as string);
    const supplier = await supplierService.updateSupplier(id, {
      name: req.body.name as string | undefined,
      contactEmail: req.body.contactEmail as string | undefined,
      contactPhone: req.body.contactPhone as string | undefined,
      address: req.body.address as string | undefined,
    });
    res.json(supplier);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const deleteSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params['id'] as string);
    await supplierService.deleteSupplier(id);
    res.status(204).send();
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};