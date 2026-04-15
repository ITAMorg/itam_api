import { Router } from 'express';
import * as assetController from '../controllers/asset.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

const ADMIN = 'ADMIN';
const TECHNICIAN = 'TECHNICIAN';

// Route pour générer un QR code pour un asset
router.get('/:id/qrcode', authenticate, assetController.getAssetQrCode);

// Lecture — tous les rôles authentifiés
router.get('/', authenticate, assetController.getAssets);
router.get('/location/:locationId', authenticate, assetController.getAssetsByLocation);
router.get('/:id', authenticate, assetController.getAssetById);

// Mutations — Admin et Technicien uniquement
router.post('/', authenticate, authorize(ADMIN, TECHNICIAN), assetController.createAsset);
router.put('/:id', authenticate, authorize(ADMIN, TECHNICIAN), assetController.updateAsset);
router.delete('/:id', authenticate, authorize(ADMIN), assetController.deleteAsset);

export default router;