import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Represents one Razorpay purchase attempt for a course.
 * The backend is the sole source of truth for payment status - the
 * frontend never gets to declare "payment successful" on its own.
 */
const orderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },

    razorpayOrderId: { type: String, required: true, unique: true, index: true },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null, select: false },

    amountInPaise: { type: Number, required: true },
    currency: { type: String, default: 'INR' },

    status: {
      type: String,
      enum: ['created', 'paid', 'failed'],
      default: 'created',
      index: true,
    },
    receipt: { type: String, default: '' },
    notes: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Order = mongoose.model('Order', orderSchema);
