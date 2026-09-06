import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

/**
 * Surviving a cold student service.
 *
 * Render spins these services down, so the first request after idle spends
 * 30-60s waking up. The bridge used to give every call a flat 8s and no retry,
 * which turned that wake-up into "the Student service is unavailable" for coupon
 * campaign creation, both listings, the CSV export and course publishing - even
 * when the operation went on to succeed.
 *
 * The rule that keeps a retry safe is that only transport failures and 5xx are
 * repeated. A 4xx is the peer answering: CAMPAIGN_EXISTS after an attempt that
 * actually landed is a deterministic answer, not something to try again.
 */

let peer;
let base;
let script;
let received;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'bridge_retry_secret';
  process.env.CLIENT_URL = 'http://localhost:5175';

  peer = http.createServer(async (req, res) => {
    received.push(`${req.method} ${req.url}`);
    const step = script.shift() || { status: 200, body: { success: true, data: { ok: true } } };
    if (step.hangMs) {
      await new Promise((r) => setTimeout(r, step.hangMs));
    }
    if (res.writableEnded) return;
    res.writeHead(step.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(step.body ?? {}));
  });
  await new Promise((r) => peer.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${peer.address().port}`;

  process.env.STUDENT_BACKEND_URL = base;
  process.env.STUDENT_BACKEND_SERVICE_KEY = 'bridge_key';
});

after(async () => {
  await new Promise((r) => peer.close(r));
});

async function bridge() {
  return import('../src/services/studentCourseBridge.service.js');
}

test('a 5xx from a waking service is retried and then succeeds', async () => {
  script = [
    { status: 503, body: { success: false } },
    { status: 201, body: { success: true, data: { campaign: { id: 'c1', name: 'Launch 25' }, coupons: [{ code: 'NNAA-BBBB-CC' }] } } },
  ];
  received = [];

  const { createCampaign } = await bridge();
  const result = await createCampaign({ courseSlug: 'prarambh', name: 'Launch 25', count: 25 });

  assert.equal(received.length, 2, 'one retry after the 503');
  assert.equal(result.campaign.name, 'Launch 25');
});

test('a 4xx is returned immediately and never repeated', async () => {
  // The peer has judged the request. Repeating CAMPAIGN_EXISTS would only be
  // slower, and - after an attempt that already landed - could turn a correct
  // "it already exists" into a confusing sequence of retries.
  script = [{ status: 409, body: { success: false, error: { code: 'CAMPAIGN_EXISTS', message: 'A campaign named "Launch 25" already exists for this course.' } } }];
  received = [];

  const { createCampaign } = await bridge();
  await assert.rejects(
    () => createCampaign({ courseSlug: 'prarambh', name: 'Launch 25', count: 25 }),
    (err) => {
      assert.equal(received.length, 1, 'exactly one attempt for a 4xx');
      assert.equal(err.code, 'CAMPAIGN_EXISTS', `got ${err.code}`);
      assert.match(err.message, /already exists/, 'the peer sentence survives, not a raw JSON blob');
      return true;
    }
  );
});

test('the retry after a timed-out create cannot mint a second campaign', async () => {
  // The exact cold-start sequence: attempt 1 outruns its budget while the
  // operation lands anyway, so attempt 2 meets the unique index. The bridge must
  // surface that verdict rather than retrying into a third state.
  script = [
    { status: 502, body: { success: false } },
    { status: 409, body: { success: false, error: { code: 'CAMPAIGN_EXISTS', message: 'A campaign named "Launch 25" already exists for this course.' } } },
  ];
  received = [];

  const { createCampaign } = await bridge();
  await assert.rejects(
    () => createCampaign({ courseSlug: 'prarambh', name: 'Launch 25', count: 25 }),
    (err) => {
      assert.equal(received.length, 2, 'retried the 502, stopped at the 409');
      assert.equal(err.code, 'CAMPAIGN_EXISTS');
      return true;
    }
  );
});

test('three transport failures give up rather than looping', async () => {
  script = [
    { status: 500, body: {} },
    { status: 500, body: {} },
    { status: 500, body: {} },
    { status: 200, body: { success: true, data: [] } },
  ];
  received = [];

  const { listCampaigns } = await bridge();
  await assert.rejects(() => listCampaigns({}));
  assert.equal(received.length, 3, 'bounded at three attempts, never a loop');
});

test('the first attempt is short so a dead peer fails fast', async () => {
  // 8s then 35s then 35s: the escalation exists so a genuinely dead service is
  // not held for 105s, while a cold one still gets time to wake.
  const src = await (await import('node:fs')).promises.readFile(
    new URL('../src/services/studentCourseBridge.service.js', import.meta.url), 'utf8');
  assert.match(src, /ATTEMPT_TIMEOUTS_MS\s*=\s*\[8000,\s*35000,\s*35000\]/, 'same budget as the teacher bridge');
  assert.match(src, /RETRY_BACKOFF_MS\s*=\s*\[1000,\s*3000\]/);
});
