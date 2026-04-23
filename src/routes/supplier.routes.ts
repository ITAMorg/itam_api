import { Router } from 'express';
import * as supplierController from '../controllers/supplier.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, supplierController.getSuppliers);
router.post('/', authenticate, authorize('ADMIN'), supplierController.createSupplier);
router.put('/:id', authenticate, authorize('ADMIN'), supplierController.updateSupplier);
router.delete('/:id', authenticate, authorize('ADMIN'), supplierController.deleteSupplier);

export default router;