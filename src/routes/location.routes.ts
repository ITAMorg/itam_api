import { Router } from 'express';
import {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from '../controllers/location.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getLocations);
router.post('/', authenticate, authorize('ADMIN'), createLocation);
router.put('/:id', authenticate, authorize('ADMIN'), updateLocation);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteLocation);

export default router;