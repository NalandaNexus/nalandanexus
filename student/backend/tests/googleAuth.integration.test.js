import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';

// Enables Google sign-in in the app under test. Read when the app boots.
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';

/**
 * Continue with Google: whose account a Google identity reaches, and whose name
 * that account shows.
 *
 * Google cannot be reached from a test, and must not be. The one call that
 * talks to Google - verifying the ID token's signature - is replaced with one
 * that reads a test token, and it still insists on this app's audience. Every
 * step after it runs for real: the lookup, the linking, the naming, the session
 * and what /auth/me reports.
 */
OAuth2Client.prototype.verifyIdToken = async function verifyTestToken({ idToken, audience }) {
  if (audience !== process.env.GOOGLE_CLIENT_ID) throw new Error('audience mismatch');
  let payload;
  try {
    payload = JSON.parse(Buffer.from(idToken, 'base64url').toString('utf8'));
  } catch {
    throw new Error('not a token');
  }
  if (!payload?.sub || payload.forged) throw new Error('bad signature');
  return { getPayload: () => payload };
};

let ctx;
let request;
let User;
let StudentProfile;
let authService;

before(async () => {
  ctx = await bootTestApp();
  request = ctx.request;
  ({ User } = await import('../src/models/User.js'));
  ({ StudentProfile } = await import('../src/models/StudentProfile.js'));
  authService = await import('../src/services/auth.service.js');
  await User.init();
});

after(async () => {
  await ctx.teardown();
});

const uniq = () => crypto.randomBytes(4).toString('hex');
const token = (claims) => Buffer.from(JSON.stringify({ email_verified: true, ...claims })).toString('base64url');
const google = (claims) => request.post('/api/auth/google').send({ idToken: token(claims) });
const me = (accessToken) => request.get('/api/auth/me').set(bearer(accessToken));

test('a new Google student is named by Google, and keeps that name on screen', async () => {
  const claims = { sub: `g-${uniq()}`, email: `adarsh.${uniq()}@example.com`, name: 'Adarsh Tiwari' };
  const res = await google(claims);

  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.isNewUser, true);
  assert.equal(res.body.data.user.name, 'Adarsh Tiwari');

  const session = await me(res.body.data.accessToken);
  assert.equal(session.body.data.user.name, 'Adarsh Tiwari', 'the restored session shows the same name');

  const stored = await User.findOne({ email: claims.email }).lean();
  assert.equal(stored.googleId, claims.sub, 'linked by the stable Google identity');
  assert.equal(stored.isVerified, true);
  assert.equal(await StudentProfile.countDocuments({ userId: stored._id }), 1);
});

test('signing in again reaches the same account and never renames it', async () => {
  const sub = `g-${uniq()}`;
  const email = `repeat.${uniq()}@example.com`;
  const first = await google({ sub, email, name: 'Adarsh Tiwari' });
  const id = first.body.data.user._id;

  const renamedAtGoogle = await google({ sub, email, name: 'Adarsh T.' });
  assert.equal(renamedAtGoogle.status, 200);
  assert.equal(renamedAtGoogle.body.data.isNewUser, false);
  assert.equal(renamedAtGoogle.body.data.user._id, id, 'the same account');
  assert.equal(renamedAtGoogle.body.data.user.name, 'Adarsh Tiwari', 'a later sign-in is not an edit');

  // The student records their official name on their profile; Google must not undo it.
  const saved = await request
    .put('/api/student/profile/completion')
    .set(bearer(renamedAtGoogle.body.data.accessToken))
    .send({ fullName: 'Adarsh Kumar Tiwari', guardianName: 'Ramesh Tiwari', grade: 'Class 10', phone: '9876543210' });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));

  const again = await google({ sub, email, name: 'Adarsh Tiwari' });
  assert.equal(again.body.data.user.name, 'Adarsh Kumar Tiwari', 'the official name the student entered is kept');
  assert.equal(await User.countDocuments({ email }), 1, 'and there is still one account');
});

test('the Google identity, not the email, decides the account', async () => {
  const sub = `g-${uniq()}`;
  const first = await google({ sub, email: `before.${uniq()}@example.com`, name: 'Kavya Rao' });

  const changedAddress = await google({ sub, email: `after.${uniq()}@example.com`, name: 'Kavya Rao' });
  assert.equal(changedAddress.status, 200);
  assert.equal(changedAddress.body.data.user._id, first.body.data.user._id, 'an address changed at Google is the same student');
  assert.equal(await User.countDocuments({ googleId: sub }), 1);
});

test('an existing verified account is linked, keeping its name and its password', async () => {
  const email = `priya.${uniq()}@example.com`;
  const existing = await registerAndLogin(request, { name: 'Priya Verma', email });

  const res = await google({ sub: `g-${uniq()}`, email, name: 'Priya V' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.user._id, existing.user._id, 'linked, not duplicated');
  assert.equal(res.body.data.user.name, 'Priya Verma', 'the name its verified owner chose is kept');

  const password = await request.post('/api/auth/login').send({ email, password: 'TestPass123!' });
  assert.equal(password.status, 200, 'and their password still works');
  assert.equal(await User.countDocuments({ email }), 1);
});

test("an unverified signup under a student's email cannot name, or keep a password on, their account", async () => {
  const email = `owner.${uniq()}@example.com`;
  const signup = await request.post('/api/auth/register').send({ name: 'Somebody Else', email, password: 'StrangerPass123!' });
  assert.equal(signup.status, 201);
  const staleLink = new URL(signup.body.data.verificationUrlFallback).searchParams.get('token');

  const res = await google({ sub: `g-${uniq()}`, email, name: 'Adarsh Tiwari' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.data.user.name, 'Adarsh Tiwari', "Google's verified name, not the one a stranger typed");
  assert.equal((await me(res.body.data.accessToken)).body.data.user.name, 'Adarsh Tiwari');

  const strangerLogin = await request.post('/api/auth/login').send({ email, password: 'StrangerPass123!' });
  assert.equal(strangerLogin.status, 401, 'the unproven password no longer opens the account');
  const oldLink = await request.post('/api/auth/verify-email').send({ token: staleLink });
  assert.equal(oldLink.status, 400, 'nor does the old verification link');
  assert.equal(await User.countDocuments({ email }), 1);
});

test('an address linked to a different Google account is refused, not re-pointed', async () => {
  const email = `taken.${uniq()}@example.com`;
  const firstSub = `g-first-${uniq()}`;
  assert.equal((await google({ sub: firstSub, email, name: 'First Owner' })).status, 201);

  const res = await google({ sub: `g-second-${uniq()}`, email, name: 'Second Person' });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'GOOGLE_ACCOUNT_MISMATCH');

  const stored = await User.findOne({ email }).lean();
  assert.equal(stored.googleId, firstSub, 'still linked to the account that owned it');
  assert.equal(stored.name, 'First Owner');
});

test('several first sign-ins at once create exactly one account', async () => {
  const claims = { sub: `g-race-${uniq()}`, email: `race.${uniq()}@example.com`, name: 'Race Student' };
  const results = await Promise.all(Array.from({ length: 6 }, () => google(claims)));

  assert.ok(
    results.every((r) => r.status === 200 || r.status === 201),
    results.map((r) => `${r.status} ${JSON.stringify(r.body).slice(0, 160)}`).join(' | ')
  );
  assert.equal(new Set(results.map((r) => r.body.data.user._id)).size, 1, 'every request reached the same account');
  assert.equal(results.filter((r) => r.body.data.isNewUser).length, 1, 'and only one of them created it');
  assert.equal(await User.countDocuments({ email: claims.email }), 1);
  const user = await User.findOne({ email: claims.email }).lean();
  assert.equal(await StudentProfile.countDocuments({ userId: user._id }), 1);
});

test('the name comes from what Google says, in that order', async () => {
  const identity = (claims) => authService.googleIdentityFromPayload({ sub: 's', email: 'Someone.Here@Example.com', ...claims });

  assert.equal(identity({ name: 'Adarsh Tiwari', given_name: 'Ignored' }).name, 'Adarsh Tiwari');
  assert.equal(identity({ given_name: 'Adarsh', family_name: 'Tiwari' }).name, 'Adarsh Tiwari', 'given and family name when name is absent');
  assert.equal(identity({ name: '   Adarsh    Tiwari  ' }).name, 'Adarsh Tiwari');
  assert.equal(identity({}).name, 'Someone.Here', 'the address only when Google gives no name at all');
  assert.equal(identity({ name: 'x'.repeat(200) }).name.length, 120);
  assert.equal(identity({}).email, 'someone.here@example.com');

  const long = await google({ sub: `g-${uniq()}`, email: `long.${uniq()}@example.com`, name: `Very ${'Long '.repeat(40)}Name` });
  assert.equal(long.status, 201, 'a name longer than the account allows still signs in');
});

test('an unverified Google email or a credential that fails verification is refused', async () => {
  const email = `refused.${uniq()}@example.com`;
  const unverified = await request.post('/api/auth/google').send({ idToken: token({ sub: `g-${uniq()}`, email, name: 'No Verify', email_verified: false }) });
  assert.equal(unverified.status, 401);
  assert.equal(unverified.body.error.code, 'GOOGLE_EMAIL_UNVERIFIED');

  const forged = await google({ sub: `g-${uniq()}`, email, name: 'Forged', forged: true });
  assert.equal(forged.status, 401);
  assert.equal(forged.body.error.code, 'INVALID_GOOGLE_TOKEN');

  assert.equal(await User.countDocuments({ email }), 0, 'no account was created by either');
});
