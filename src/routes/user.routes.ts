import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, authorize('ADMIN'), userController.getAllUsers);
router.get('/role/:role', authenticate, authorize('ADMIN', 'TECHNICIAN'), userController.getUsersByRole);
router.post('/', authenticate, authorize('ADMIN'), userController.createUser);
router.put('/:id', authenticate, authorize('ADMIN'), userController.updateUser);
router.delete('/:id', authenticate, authorize('ADMIN'), userController.deleteUser);

export default router;