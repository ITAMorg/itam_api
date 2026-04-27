import { Router } from 'express';
import * as assetTypeController from '../controllers/asset_type.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, assetTypeController.getAssetTypes);
router.post('/', authenticate, authorize('ADMIN'), assetTypeController.createAssetType);
router.put('/:id', authenticate, authorize('ADMIN'), assetTypeController.updateAssetType);
router.delete('/:id', authenticate, authorize('ADMIN'), assetTypeController.deleteAssetType);

export default router;