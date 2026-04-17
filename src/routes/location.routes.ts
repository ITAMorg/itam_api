import { Router } from 'express';
import { getLocations, createLocation } from '../controllers/location.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getLocations);
router.post('/', authenticate, authorize('ADMIN'), createLocation);

export default router;