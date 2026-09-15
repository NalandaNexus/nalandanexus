import { apiClient } from './apiClient';

let checkoutScriptPromise = null;

/** Lazily loads Razorpay's Checkout.js exactly once. */
function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(true);
  if (checkoutScriptPromise) return checkoutScriptPromise;

  checkoutScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Could not load the Razorpay checkout script. Check your internet connection.'));
    document.body.appendChild(script);
  });

  return checkoutScriptPromise;
}

export const paymentService = {
  /**
   * Full purchase flow for a course:
   * 1. Ask the backend to create a Razorpay order (server resolves the price).
   * 2. Open Razorpay's hosted checkout UI.
   * 3. Send the checkout result to the backend for signature verification.
   * The backend is the only party that ever marks a purchase "paid" - this
   * function just orchestrates the UI and relays results.
   */
  async purchaseCourse({ courseSlug, studentName, studentEmail, onStatus }) {
    onStatus?.('creating-order');
    const orderRes = await apiClient.post('/payments/orders', { courseSlug });

    if (orderRes.data.free) {
      onStatus?.('enrolled-free');
      return { free: true, enrollment: orderRes.data.enrollment, studentProfile: orderRes.data.studentProfile };
    }

    await loadRazorpayCheckout();
    onStatus?.('awaiting-checkout');

    const { razorpayOrderId, amountInPaise, currency, razorpayKeyId, courseTitle, mockMode } = orderRes.data;

    return new Promise((resolve, reject) => {
      const options = {
        key: razorpayKeyId,
        amount: amountInPaise,
        currency,
        name: 'Nalanda Nexus',
        description: courseTitle,
        order_id: razorpayOrderId,
        prefill: { name: studentName, email: studentEmail },
        theme: { color: '#AB5236' },
        handler: async (response) => {
          try {
            onStatus?.('verifying-payment');
            const verifyRes = await apiClient.post('/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            onStatus?.('verified');
            resolve({ free: false, enrollment: verifyRes.data.enrollment, studentProfile: verifyRes.data.studentProfile });
          } catch (err) {
            onStatus?.('verification-failed');
            reject(err);
          }
        },
        modal: {
          ondismiss: () => reject(new Error('Payment checkout was closed before completing.')),
        },
      };

      if (mockMode) {
        // Local/dev mode without real Razorpay keys: simulate the checkout
        // handler directly instead of opening the real widget (which would
        // reject a fake key id). This still exercises the full
        // create-order -> verify -> enrollment pipeline against the backend.
        // eslint-disable-next-line no-console
        console.warn('[Payments] Backend is running in PAYMENTS_MOCK_MODE - simulating a successful checkout for local testing.');
        import('./paymentMock').then(async ({ buildMockCheckoutResponse }) => {
          const mockResponse = await buildMockCheckoutResponse(razorpayOrderId);
          options.handler(mockResponse);
        });
        return;
      }

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        onStatus?.('payment-failed');
        reject(new Error(response?.error?.description || 'Payment failed.'));
      });
      rzp.open();
    });
  },

  /**
   * Checks a coupon without spending it.
   *
   * The figures that come back are for display only. Redemption recomputes all
   * of them server-side, so a stale or tampered preview cannot decide what a
   * student pays.
   */
  async validateCoupon({ courseSlug, code }) {
    const res = await apiClient.post('/coupons/validate', { courseSlug, code });
    return res.data;
  },

  /**
   * Redeems a coupon that covers the full price.
   *
   * Razorpay is not involved and is not loaded: there is nothing to charge, and
   * a ₹0 order would be rejected by the gateway anyway. The backend re-validates
   * and claims the coupon atomically before enrolling.
   */
  async enrollWithCoupon({ courseSlug, code }) {
    const res = await apiClient.post('/coupons/redeem', { courseSlug, code });
    return res.data;
  },

  async getOrderStatus(orderId) {
    const res = await apiClient.get(`/payments/orders/${orderId}`);
    return res.data;
  },
};
