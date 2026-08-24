import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createOrderSchema, verifyPaymentSchema } from '../validators/payment.validators.js';

const router = Router();

router.post('/orders', authenticate, requireRole('student'), validate(createOrderSchema), paymentController.createOrder);
router.post('/verify', authenticate, requireRole('student'), validate(verifyPaymentSchema), paymentController.verifyPayment);
router.get('/orders/:orderId', authenticate, requireRole('student'), paymentController.getOrderStatus);

// Note: the webhook route itself is mounted separately in app.js because it
// needs the raw request body for signature verification (see app.js).

export default router;
