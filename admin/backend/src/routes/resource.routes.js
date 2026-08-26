import { Router } from 'express';
import * as resourceController from '../controllers/resource.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploaderFor, verifyFileSignature } from '../middleware/upload.js';
import { objectIdParam } from '../validators/common.js';
import { listResourcesQuery, createResourceSchema, updateResourceSchema } from '../validators/resource.validator.js';

const router = Router();
const uploadResourceFile = uploaderFor('resources').single('file');

router.use(authenticate);

router.get('/', requirePermission('resources.manage'), validate(listResourcesQuery), resourceController.list);
router.get('/:id', requirePermission('resources.manage'), validate({ params: objectIdParam() }), resourceController.getById);
router.post('/', requirePermission('resources.manage'), uploadResourceFile, verifyFileSignature, validate(createResourceSchema), resourceController.create);
router.put('/:id', requirePermission('resources.manage'), uploadResourceFile, verifyFileSignature, validate({ params: objectIdParam(), ...updateResourceSchema }), resourceController.update);
router.delete('/:id', requirePermission('resources.manage'), validate({ params: objectIdParam() }), resourceController.remove);

export default router;
