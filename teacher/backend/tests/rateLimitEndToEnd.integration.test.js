import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Rate limiting through the real app, across two instances.
 *
 * The store is unit-tested separately; what this file proves is the part that
 * actually protects the login route - that the limiter is wired to the shared
 * store, that a real HTTP 429 comes out at the threshold, and that the counter
 * carries across processes.
 *
 * Instance B is a REAL CHILD PROCESS, not a second server in this one. Two
 * servers created inside a single process still share the module-level limiter
 * object and therefore its store, so an in-process "second instance" passes
 * even with the per-process default store - verified by mutation: removing the
 * shared store failed nothing until this became a genuine second process. Only
 * a separate process proves the counter lives in the database, which is the
 * deployment shape being checked (several Render instances behind a load
 * balancer, the live symptom being ratelimit-remaining reading
 * 19,19,18,17,18... - climbing back up).
 */

let mongod;
let instanceA;
let instanceB;
let baseA;
let baseB;

// Deliberately small so the threshold is reachable in a test, and set BEFORE
// the app is imported (config/env.js reads process.env once).
const LIMIT = 5;

before(async () => {
  mongod = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'ratelimit_e2e_secret';
  process.env.CLIENT_URL = 'http://localhost:5174';
  process.env.AUTH_RATE_LIMIT_MAX = String(LIMIT);
  process.env.RATE_LIMIT_MAX = '100000';
  process.env.RATE_LIMIT_WINDOW_MS = '60000';

  const { connectDatabase } = await import('../src/config/db.js');
  await connectDatabase({ retries: 1 });

  const { createApp } = await import('../src/app.js');
  instanceA = http.createServer(createApp());
  await new Promise((r) => instanceA.listen(0, '127.0.0.1', r));
  baseA = `http://127.0.0.1:${instanceA.address().port}`;

  // A genuinely separate process, sharing only the database.
  instanceB = spawn(process.execPath, ['tests/helpers/secondInstance.mjs'], {
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('second instance did not start')), 60_000);
    instanceB.stdout.on('data', (chunk) => {
      const match = /READY (\d+)/.exec(String(chunk));
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    instanceB.on('exit', (code) => reject(new Error(`second instance exited early (${code})`)));
  });
  baseB = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((r) => instanceA.close(r));
  instanceB.kill();
  const mongoose = (await import('mongoose')).default;
  await mongoose.connection.close();
  await mongod.stop();
});

/** A failed login from a named caller. The limiter keys on IP, so the header pins it. */
async function failedLogin(base, ip) {
  const res = await fetch(`${base}/api/teacher/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify({ email: 'nobody@nowhere.test', password: 'WrongPassword123!' }),
  });
  return { status: res.status, remaining: res.headers.get('ratelimit-remaining') };
}

test('repeated failed logins are refused with 429 at the threshold', async () => {
  const ip = '203.0.113.10';
  const seen = [];

  for (let i = 0; i < LIMIT + 3; i += 1) {
    seen.push((await failedLogin(baseA, ip)).status);
  }

  const rejected = seen.filter((s) => s === 429);
  assert.ok(rejected.length >= 3, `expected 429s after ${LIMIT} attempts, saw ${seen.join(',')}`);
  assert.equal(seen[seen.length - 1], 429, 'the limit must still hold on the last attempt');
  assert.ok(seen.slice(0, LIMIT).every((s) => s === 401), 'attempts within the allowance must be answered normally');
});

/**
 * The decisive one. An attacker's requests land on whichever instance the load
 * balancer picks; the count has to follow them.
 */
test('the counter carries across instances, so a second one cannot refill the allowance', async () => {
  const ip = '203.0.113.20';

  // Spend the whole allowance on instance A.
  for (let i = 0; i < LIMIT; i += 1) {
    const res = await failedLogin(baseA, ip);
    assert.equal(res.status, 401, `attempt ${i + 1} should be a normal failure`);
  }

  // The very next attempt on the OTHER instance must already be refused.
  const onB = await failedLogin(baseB, ip);
  assert.equal(onB.status, 429, 'switching instances must not hand back a fresh allowance');
});

test('the remaining count never climbs back up as requests alternate between instances', async () => {
  const ip = '203.0.113.30';
  const remaining = [];

  for (let i = 0; i < LIMIT; i += 1) {
    const res = await failedLogin(i % 2 === 0 ? baseA : baseB, ip);
    if (res.remaining !== null) remaining.push(Number(res.remaining));
  }

  // The live symptom was a value that went back up between requests.
  for (let i = 1; i < remaining.length; i += 1) {
    assert.ok(
      remaining[i] <= remaining[i - 1],
      `remaining must never increase within a window, saw ${remaining.join(',')}`
    );
  }
});

test('one caller being limited does not lock out everybody else', async () => {
  const attacker = '203.0.113.40';
  for (let i = 0; i < LIMIT + 2; i += 1) await failedLogin(baseA, attacker);
  assert.equal((await failedLogin(baseA, attacker)).status, 429, 'precondition: the attacker is limited');

  const bystander = await failedLogin(baseB, '203.0.113.41');
  assert.equal(bystander.status, 401, 'a different caller must be unaffected, on either instance');
});

test('a refusal is a proper JSON error, not an HTML error page', async () => {
  const ip = '203.0.113.50';
  for (let i = 0; i < LIMIT + 1; i += 1) await failedLogin(baseA, ip);

  const res = await fetch(`${baseA}/api/teacher/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify({ email: 'nobody@nowhere.test', password: 'WrongPassword123!' }),
  });
  assert.equal(res.status, 429);

  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'RATE_LIMITED');
  assert.ok(body.message, 'a client needs something to show the user');
});
