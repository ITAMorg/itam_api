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