import { Router } from 'express';
import * as statsController from '../controllers/stats.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/dashboard', authenticate, authorize('ADMIN', 'TECHNICIAN'), statsController.getDashboardStats);
router.get('/assets', authenticate, authorize('ADMIN', 'TECHNICIAN'), statsController.getAssetStats);
router.get('/tickets', authenticate, authorize('ADMIN', 'TECHNICIAN'), statsController.getTicketStats);
router.get('/technicians', authenticate, authorize('ADMIN', 'TECHNICIAN'), statsController.getTechnicianStats);

export default router;