import { Router } from 'express';
import * as messageController from '../controllers/message.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import { sendMessageValidator, startConversationValidator } from '../validators/message.validators.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

router.get('/conversations', messageController.listConversations);
router.post('/conversations', startConversationValidator, validate, messageController.startConversation);
router.get('/conversations/:id', objectIdParam('id'), validate, messageController.getMessages);
router.post('/conversations/:id/messages', objectIdParam('id'), sendMessageValidator, validate, messageController.sendMessage);
router.patch('/conversations/:id/read', objectIdParam('id'), validate, messageController.markConversationRead);

export default router;
