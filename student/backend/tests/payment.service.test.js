import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.PAYMENTS_MOCK_MODE = 'true';

const { createRazorpayOrder, verifyPaymentSignature, mockSignatureFor } = await import('../src/services/payment.service.js');

test('createRazorpayOrder returns a mock order in mock mode without hitting the network', async () => {
  const order = await createRazorpayOrder({ amountInPaise: 500000, currency: 'INR', receipt: 'r1' });
  assert.ok(order.id.startsWith('order_MOCK'));
  assert.equal(order.amount, 500000);
  assert.equal(order.currency, 'INR');
});

test('verifyPaymentSignature accepts a correctly computed signature', () => {
  const orderId = 'order_MOCKabc123';
  const paymentId = 'pay_MOCKxyz789';
  const signature = mockSignatureFor(orderId, paymentId);
  assert.equal(verifyPaymentSignature({ orderId, paymentId, signature }), true);
});

test('verifyPaymentSignature rejects a tampered/incorrect signature (no fake success)', () => {
  const orderId = 'order_MOCKabc123';
  const paymentId = 'pay_MOCKxyz789';
  assert.equal(verifyPaymentSignature({ orderId, paymentId, signature: 'deadbeef'.repeat(8) }), false);
  assert.equal(verifyPaymentSignature({ orderId, paymentId, signature: '' }), false);
});

test('verifyPaymentSignature rejects a signature that matches a DIFFERENT order (replay protection)', () => {
  const signatureForOrderA = mockSignatureFor('order_A', 'pay_A');
  assert.equal(verifyPaymentSignature({ orderId: 'order_B', paymentId: 'pay_A', signature: signatureForOrderA }), false);
});
