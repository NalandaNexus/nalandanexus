import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { Course } from '../models/Course.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature } from '../services/payment.service.js';
import { createEnrollment, getActiveEnrollment } from '../services/enrollment.service.js';
import { assertStageAccessible } from '../services/progression/access.service.js';
import { pushPaymentToAdmin } from '../services/adminPaymentBridge.service.js';
import { summarizeProfileCompletion } from '../services/studentProfile.service.js';
import { env } from '../config/env.js';

/**
 * POST /api/payments/orders
 * Creates a Razorpay order for a paid course. The amount is always looked
 * up server-side from the Course document - the client can never dictate
 * the price it pays.
 */
export const createOrder = asyncHandler(async (req, res) => {
  const { courseSlug } = req.body;
  const course = await Course.findOne({ slug: courseSlug, isPublished: true });
  if (!course) throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
  if (!course.isPurchasable) {
    throw AppError.badRequest('This course is not yet open for enrollment.', 'COURSE_NOT_PURCHASABLE');
  }

  const existingEnrollment = await getActiveEnrollment(req.user._id, course._id);
  if (existingEnrollment) {
    throw AppError.conflict('You are already enrolled in this course.', 'ALREADY_ENROLLED');
  }

  // Checked BEFORE Razorpay is involved, not only at enrolment. Both gates
  // exist and both matter: this one stops a student paying for a stage they
  // cannot have, and the one inside createEnrollment stops any future path
  // reaching an enrolment without passing the same test.
  await assertStageAccessible(req.user._id, course);

  if (course.priceInPaise <= 0) {
    // Free course: skip Razorpay entirely and enroll immediately.
    const enrollment = await createEnrollment({ userId: req.user._id, courseId: course._id, course });
    return sendSuccess(res, {
      status: 201,
      message: 'Enrolled successfully (free course).',
      // Where to send the student next: the profile form if it is owed.
      data: { free: true, enrollment, studentProfile: await summarizeProfileCompletion(req.user) },
    });
  }

  const receipt = `nlnd_${String(course._id).slice(-8)}_${Date.now()}`;
  const razorpayOrder = await createRazorpayOrder({
    amountInPaise: course.priceInPaise,
    currency: course.currency,
    receipt,
    notes: { courseId: String(course._id), userId: String(req.user._id) },
  });

  const order = await Order.create({
    userId: req.user._id,
    courseId: course._id,
    razorpayOrderId: razorpayOrder.id,
    amountInPaise: course.priceInPaise,
    currency: course.currency,
    receipt,
  });

  return sendSuccess(res, {
    status: 201,
    message: 'Order created.',
    data: {
      free: false,
      orderId: order._id,
      razorpayOrderId: razorpayOrder.id,
      amountInPaise: course.priceInPaise,
      currency: course.currency,
      razorpayKeyId: env.razorpay.mockMode ? 'rzp_test_mock' : env.razorpay.keyId,
      courseTitle: course.title,
      mockMode: env.razorpay.mockMode,
    },
  });
});

/**
 * POST /api/payments/verify
 * The ONLY place a purchase is marked "paid" and an Enrollment is created.
 * Verifies the Razorpay signature server-side; a client asserting success
 * without a valid signature is rejected (master doc section 63: "No fake
 * success").
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const order = await Order.findOne({ razorpayOrderId: razorpay_order_id, userId: req.user._id });
  if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
  if (order.status === 'paid') {
    // A refresh after paying lands here, and still needs to know whether the
    // profile form comes before the course.
    return sendSuccess(res, {
      message: 'Payment already verified.',
      data: { alreadyPaid: true, studentProfile: await summarizeProfileCompletion(req.user) },
    });
  }

  const isValid = verifyPaymentSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!isValid) {
    order.status = 'failed';
    await order.save();
    await pushPaymentToAdmin({ order, user: req.user, course: await Course.findById(order.courseId), status: 'FAILED' });
    throw AppError.badRequest('Payment verification failed. If money was deducted, contact support.', 'PAYMENT_VERIFICATION_FAILED');
  }

  order.status = 'paid';
  order.razorpayPaymentId = razorpay_payment_id;
  order.razorpaySignature = razorpay_signature;
  await order.save();

  const course = await Course.findById(order.courseId);
  const enrollment = await createEnrollment({ userId: req.user._id, courseId: order.courseId, orderId: order._id, course });
  await pushPaymentToAdmin({ order, user: req.user, course, status: 'PAID' });

  return sendSuccess(res, {
    status: 201,
    message: 'Payment verified. You are now enrolled!',
    data: {
      enrollment,
      order: { id: order._id, status: order.status },
      studentProfile: await summarizeProfileCompletion(req.user),
    },
  });
});

export const getOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.orderId, userId: req.user._id });
  if (!order) throw AppError.notFound('Order not found', 'ORDER_NOT_FOUND');
  return sendSuccess(res, { data: order });
});

/**
 * POST /api/payments/webhook
 * Defense-in-depth: Razorpay can call this directly even if the client
 * never returns to /verify (e.g. browser closed mid-checkout). Requires
 * RAZORPAY_WEBHOOK_SECRET to be configured; verifies the raw body against
 * X-Razorpay-Signature before trusting the payload.
 */
export const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const isValid = verifyWebhookSignature(req.rawBody || '', signature);

  if (!isValid) {
    throw AppError.unauthorized('Invalid webhook signature', 'INVALID_WEBHOOK_SIGNATURE');
  }

  const event = req.body?.event;
  if (event === 'payment.captured') {
    const payment = req.body?.payload?.payment?.entity;
    const razorpayOrderId = payment?.order_id;
    if (razorpayOrderId) {
      const order = await Order.findOne({ razorpayOrderId });
      if (order && order.status !== 'paid') {
        order.status = 'paid';
        order.razorpayPaymentId = payment.id;
        await order.save();
        const [course, user] = await Promise.all([Course.findById(order.courseId), User.findById(order.userId)]);
        await createEnrollment({ userId: order.userId, courseId: order.courseId, orderId: order._id, course });
        await pushPaymentToAdmin({ order, user, course, status: 'PAID' });
      }
    }
  }

  return res.status(200).json({ received: true });
});
