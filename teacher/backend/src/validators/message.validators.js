import { body } from 'express-validator';
import mongoose from 'mongoose';

export const sendMessageValidator = [
  body('text').trim().notEmpty().withMessage('Message text is required').isLength({ max: 4000 }),
];

// Without this, a missing studentId would reach Student.findOne({ _id: undefined, ... })
// and rely on driver-specific handling of an undefined filter key instead of failing
// predictably — every other "create" route in this API validates its body explicitly,
// so this one should too.
export const startConversationValidator = [
  body('studentId')
    .notEmpty()
    .withMessage('studentId is required')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('studentId must be a valid identifier'),
];

export default { sendMessageValidator, startConversationValidator };
