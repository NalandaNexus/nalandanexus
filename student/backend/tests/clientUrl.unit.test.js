import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * CLIENT_URL is the CORS allow-list AND the base for links in outgoing email.
 * env.js is evaluated once at import, so each case runs in its own process.
 */
function loadEnv(clientUrl) {
  const out = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      "const { env } = await import('./src/config/env.js');" +
        'process.stdout.write(JSON.stringify({ urls: env.clientUrls, canonical: env.clientUrl }));',
    ],
    {
      cwd: backendRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        CLIENT_URL: clientUrl,
        NODE_ENV: 'test',
        JWT_ACCESS_SECRET: 'test_access_secret',
        JWT_REFRESH_SECRET: 'test_refresh_secret',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/unused',
      },
    }
  );
  return JSON.parse(out);
}

test('a multi-origin CLIENT_URL does not leak the whole list into email links', () => {
  const { urls, canonical } = loadEnv(
    'https://www.nalandanexus.com,https://nalandanexus.com,https://nalandanexus.vercel.app'
  );

  assert.deepEqual(urls, [
    'https://www.nalandanexus.com',
    'https://nalandanexus.com',
    'https://nalandanexus.vercel.app',
  ]);

  // The regression this guards: clientUrl used to be the raw CLIENT_URL
  // string, so every verification and password-reset email contained
  // "https://a.com,https://b.com/verify-email?token=..." - a dead link.
  assert.equal(canonical, 'https://www.nalandanexus.com');
  assert.ok(!canonical.includes(','), 'the canonical URL must be a single origin');
  assert.equal(`${canonical}/verify-email?token=abc`, 'https://www.nalandanexus.com/verify-email?token=abc');
});

test('www and the apex are treated as the separate origins they are', () => {
  const { urls } = loadEnv('https://www.nalandanexus.com,https://nalandanexus.com');
  assert.ok(urls.includes('https://www.nalandanexus.com'));
  assert.ok(urls.includes('https://nalandanexus.com'));
  assert.equal(urls.length, 2, 'neither may be collapsed into the other');
});

test('trailing slashes and stray whitespace are tolerated', () => {
  // Both are easy to introduce pasting a URL out of a browser address bar into
  // a hosting dashboard, and a real Origin header never carries a trailing
  // slash - so an unstripped entry would match nothing and silently break CORS.
  const { urls, canonical } = loadEnv(' https://www.nalandanexus.com/ , https://nalandanexus.com// ');
  assert.deepEqual(urls, ['https://www.nalandanexus.com', 'https://nalandanexus.com']);
  assert.equal(canonical, 'https://www.nalandanexus.com');
});

test('a single-origin CLIENT_URL still behaves exactly as before', () => {
  const { urls, canonical } = loadEnv('https://nalandanexus.vercel.app');
  assert.deepEqual(urls, ['https://nalandanexus.vercel.app']);
  assert.equal(canonical, 'https://nalandanexus.vercel.app');
});
