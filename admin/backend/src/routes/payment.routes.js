import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import { listPaymentsQuery, createPaymentSchema, updatePaymentStatusSchema } from '../validators/payment.validator.js';

const router = Router();

router.use(authenticate);
router.get('/', requirePermission('payments.view'), validate(listPaymentsQuery), paymentController.list);
router.post('/', requirePermission('payments.manage'), validate(createPaymentSchema), paymentController.create);
router.patch('/:id/status', requirePermission('payments.manage'), validate({ params: objectIdParam(), ...updatePaymentStatusSchema }), paymentController.updateStatus);

export default router;
