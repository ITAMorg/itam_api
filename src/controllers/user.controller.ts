import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as userService from '../services/user.service';
import { Role } from '.prisma/client';

export const getUsersByRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.params;
    if (!Object.values(Role).includes(role as Role)) {
      res.status(400).json({ message: `Invalid role. Must be one of: ${Object.values(Role).join(', ')}` });
      return;
    }
    const users = await userService.getUsersByRole(role as Role);
    res.json(users);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    res.status(500).json({ message });
  }
};

export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    res.status(500).json({ message });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const email = req.body.email as string;
    const password = req.body.password as string;
    const firstName = req.body.firstName as string;
    const lastName = req.body.lastName as string;
    const role = req.body.role as string;

    if (!email || !password || !firstName || !lastName || !role) {
      res.status(400).json({ message: 'Tous les champs sont requis.' });
      return;
    }

    if (!Object.values(Role).includes(role as Role)) {
      res.status(400).json({ message: `Rôle invalide. Valeurs acceptées : ${Object.values(Role).join(', ')}` });
      return;
    }

    const user = await userService.createUser({ email, password, firstName, lastName, role: role as Role });
    res.status(201).json(user);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    res.status(500).json({ message });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params['id'] as string);
    const email = req.body.email as string | undefined;
    const firstName = req.body.firstName as string | undefined;
    const lastName = req.body.lastName as string | undefined;
    const role = req.body.role as string | undefined;
    const isActive = req.body.isActive as boolean | undefined;

    if (role && !Object.values(Role).includes(role as Role)) {
      res.status(400).json({ message: 'Rôle invalide.' });
      return;
    }

    const user = await userService.updateUser(id, {
      email,
      firstName,
      lastName,
      role: role as Role | undefined,
      isActive,
    });
    res.json(user);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    res.status(500).json({ message });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params['id'] as string);
    await userService.deleteUser(id);
    res.status(204).send();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    res.status(500).json({ message });
  }
};