import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get(
  '/role/:role',
  authenticate,
  authorize('ADMIN', 'TECHNICIAN'),
  userController.getUsersByRole
);

export default router;