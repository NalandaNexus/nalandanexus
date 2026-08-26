import test from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp } from './helpers/testApp.js';

/**
 * Login must not reveal whether an email has an account. Previously the
 * isVerified/isActive checks ran BEFORE the password comparison, so a wrong
 * password against a registered-but-unverified address answered 403
 * EMAIL_NOT_VERIFIED while an unregistered address answered 401
 * INVALID_CREDENTIALS - enough to enumerate accounts without any password.
 */
test('login does not leak account existence to a wrong password', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  // Registered, but never verified.
  await request
    .post('/api/auth/register')
    .send({ name: 'Enum Probe', email: 'enum.probe@example.com', password: 'TestPass123!' });

  const registered = await request
    .post('/api/auth/login')
    .send({ email: 'enum.probe@example.com', password: 'TotallyWrongPassword!' });

  const unregistered = await request
    .post('/api/auth/login')
    .send({ email: 'no.such.user@example.com', password: 'TotallyWrongPassword!' });

  assert.equal(registered.status, unregistered.status, 'status must not differ');
  assert.equal(registered.body.error.code, unregistered.body.error.code, 'error code must not differ');
  assert.equal(registered.body.error.message, unregistered.body.error.message, 'message must not differ');
  assert.equal(registered.status, 401);
  assert.equal(registered.body.error.code, 'INVALID_CREDENTIALS');
});

/** The verification notice must still reach someone who DOES know the password. */
test('correct password on an unverified account still reports EMAIL_NOT_VERIFIED', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  await request
    .post('/api/auth/register')
    .send({ name: 'Unverified', email: 'unverified@example.com', password: 'TestPass123!' });

  const res = await request
    .post('/api/auth/login')
    .send({ email: 'unverified@example.com', password: 'TestPass123!' });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'EMAIL_NOT_VERIFIED');
});
