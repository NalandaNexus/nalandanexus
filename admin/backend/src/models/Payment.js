import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Institution payment ledger. Two sources feed it:
 *  - 'manual': an admin-entered fee record against a real admin-owned
 *    Student document (the original design).
 *  - 'razorpay': a REAL, signature-verified course purchase bridged in from
 *    student/backend (see services/studentPaymentBridge... no - the
 *    RECEIVING side lives in controllers/payment.controller.js#ingestBridgedPayment,
 *    called from student/backend's adminPaymentBridge.service.js). The
 *    purchaser is a student/backend User, not an admin-owned Student
 *    document (the two portals have no shared identity - see Conversation's
 *    identical externalStudentId pattern), so `student` is only required
 *    for manual entries; bridged rows carry externalStudentName/Email instead.
 */
const paymentSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', index: true },
    externalStudentName: { type: String, trim: true, default: null },
    externalStudentEmail: { type: String, trim: true, default: null },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], default: 'PENDING', index: true },
    method: { type: String, enum: ['CASH', 'BANK_TRANSFER', 'CARD', 'UPI', 'OTHER'], default: 'OTHER' },
    reference: { type: String, trim: true },
    description: { type: String, trim: true },
    courseTitle: { type: String, trim: true, default: null },
    dueDate: { type: Date },
    paidAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    source: { type: String, enum: ['manual', 'razorpay'], default: 'manual', index: true },
    // student/backend's Order _id. No default deliberately - a sparse
    // index only excludes a doc when the field is genuinely ABSENT, not
    // merely null (see the identical, already-fixed bug on the student
    // side's Task/LiveClass/Quiz/Announcement models).
    sourceId: { type: String },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

paymentSchema.index({ sourceId: 1 }, { unique: true, sparse: true });

export const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
