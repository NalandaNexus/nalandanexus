import { Router } from 'express';
import * as resourceController from '../controllers/resource.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParam } from '../validators/common.js';
import { createResourceValidator } from '../validators/resource.validators.js';
import { uploaderFor, verifyFileSignature } from '../middleware/upload.js';
import { uploadToCloudinary } from '../middleware/cloudinaryStorage.js';

const router = Router();
router.use(authenticate, requireRole('teacher'));

const resourceUpload = uploaderFor('resources');

router.get('/', resourceController.listResources);
router.post('/', resourceUpload.single('file'), verifyFileSignature, uploadToCloudinary('resources'), createResourceValidator, validate, resourceController.createResource);
router.post('/:id/download', objectIdParam('id'), validate, resourceController.downloadResource);
router.delete('/:id', objectIdParam('id'), validate, resourceController.deleteResource);

export default router;
