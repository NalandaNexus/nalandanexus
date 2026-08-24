/**
 * DEV-ONLY helper: reproduces the backend's PAYMENTS_MOCK_MODE HMAC
 * signature (see backend `mockSignatureFor`) using the Web Crypto API, so
 * the full purchase flow can be exercised locally without real Razorpay
 * keys. This file is never used when the backend is NOT in mock mode.
 */
async function hmacSha256Hex(secret, message) {
  const encoder = new TextEncoder();
  const key = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await window.crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function buildMockCheckoutResponse(razorpayOrderId) {
  const razorpay_payment_id = `pay_MOCK${Date.now()}`;
  const razorpay_signature = await hmacSha256Hex('mock_secret', `${razorpayOrderId}|${razorpay_payment_id}`);
  return {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id,
    razorpay_signature,
  };
}
