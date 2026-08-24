import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';

const { signAccessToken, verifyAccessToken, hashToken, generateTokenId, generateSecureToken } = await import('../src/utils/jwt.js');

test('signAccessToken/verifyAccessToken round-trip carries user id + role', () => {
  const fakeUser = { _id: '507f1f77bcf86cd799439011', role: 'student', email: 'a@b.com' };
  const token = signAccessToken(fakeUser);
  const payload = verifyAccessToken(token);
  assert.equal(payload.sub, fakeUser._id);
  assert.equal(payload.role, 'student');
});

test('verifyAccessToken rejects a tampered token', () => {
  const fakeUser = { _id: '507f1f77bcf86cd799439011', role: 'student', email: 'a@b.com' };
  const token = signAccessToken(fakeUser);
  const tampered = token.slice(0, -2) + 'xx';
  assert.throws(() => verifyAccessToken(tampered));
});

test('hashToken is deterministic and one-way-looking (not equal to input)', () => {
  const raw = generateSecureToken(16);
  const hash1 = hashToken(raw);
  const hash2 = hashToken(raw);
  assert.equal(hash1, hash2);
  assert.notEqual(hash1, raw);
});

test('generateTokenId produces unique-looking ids', () => {
  const a = generateTokenId();
  const b = generateTokenId();
  assert.notEqual(a, b);
  assert.equal(a.length, 48);
});
