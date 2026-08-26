import { Router } from 'express';
import * as courseController from '../controllers/course.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploaderFor, verifyFileSignature } from '../middleware/upload.js';
import { objectIdParam } from '../validators/common.js';
import { listCoursesQuery, createCourseSchema, updateCourseSchema, statusSchema } from '../validators/course.validator.js';

const router = Router();
const uploadCourseImage = uploaderFor('courses').single('image');

router.use(authenticate);

router.get('/', requirePermission('courses.manage'), validate(listCoursesQuery), courseController.list);
router.get('/:id', requirePermission('courses.manage'), validate({ params: objectIdParam() }), courseController.getById);
router.post('/', requirePermission('courses.manage'), uploadCourseImage, verifyFileSignature, validate(createCourseSchema), courseController.create);
router.put('/:id', requirePermission('courses.manage'), uploadCourseImage, verifyFileSignature, validate({ params: objectIdParam(), ...updateCourseSchema }), courseController.update);
router.patch('/:id/status', requirePermission('courses.manage'), validate({ params: objectIdParam(), ...statusSchema }), courseController.setStatus);
router.delete('/:id', requirePermission('courses.manage'), validate({ params: objectIdParam() }), courseController.remove);

export default router;
