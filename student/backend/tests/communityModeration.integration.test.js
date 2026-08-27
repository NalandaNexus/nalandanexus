import test from 'node:test';
import assert from 'node:assert/strict';
import { bootTestApp, registerAndLogin, bearer } from './helpers/testApp.js';

/**
 * Covers the two defects the community feed had:
 *  - anything a student posted appeared instantly on the anonymous Landing
 *    Page, and no route anywhere could take it down again;
 *  - markup was stored verbatim, relying entirely on React escaping it.
 */

test('a new post does NOT reach the anonymous public feed until approved', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const student = await registerAndLogin(request, { name: 'Feed Student', email: 'feed@example.com' });

  const created = await request
    .post('/api/student/community/posts')
    .set(bearer(student.accessToken))
    .send({ body: 'My progress this week has been steady.' });
  assert.equal(created.status, 201);
  const postId = created.body.data.id;

  // Visible in the in-app feed straight away...
  const inApp = await request.get('/api/student/community/posts').set(bearer(student.accessToken));
  assert.equal(inApp.status, 200);
  assert.ok(inApp.body.data.some((p) => String(p.id) === String(postId)), 'author should see own post in-app');

  // ...but not to an anonymous visitor, and not counted on the public stats.
  const highlights = await request.get('/api/public/highlights');
  assert.equal(highlights.status, 200);
  assert.equal(highlights.body.data.length, 0, 'unapproved post must not reach the public feed');

  const stats = await request.get('/api/public/stats');
  assert.equal(stats.body.data.communityPosts, 0, 'counter must match what the feed renders');
});

test('the public counter never exceeds what the public feed renders', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const student = await registerAndLogin(request, { name: 'Counter Student', email: 'counter@example.com' });
  const created = await request
    .post('/api/student/community/posts')
    .set(bearer(student.accessToken))
    .send({ body: 'A post that will be approved.' });

  // Approve it directly through the model, mirroring what the admin route does.
  const { Post } = await import('../src/models/Post.js');
  await Post.findByIdAndUpdate(created.body.data.id, { isApprovedForPublic: true });

  const [highlights, stats] = await Promise.all([
    request.get('/api/public/highlights'),
    request.get('/api/public/stats'),
  ]);

  assert.equal(highlights.body.data.length, 1);
  assert.equal(
    stats.body.data.communityPosts,
    highlights.body.data.length,
    'counter and feed must agree'
  );
});

test('a student can delete their own post but not another student\'s', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const a = await registerAndLogin(request, { name: 'Author A', email: 'author.a@example.com' });
  const b = await registerAndLogin(request, { name: 'Author B', email: 'author.b@example.com' });

  const created = await request
    .post('/api/student/community/posts')
    .set(bearer(a.accessToken))
    .send({ body: 'A post belonging to student A.' });
  const postId = created.body.data.id;

  // B must not be able to delete A's post.
  const bAttempt = await request.delete(`/api/student/community/posts/${postId}`).set(bearer(b.accessToken));
  assert.equal(bAttempt.status, 404, "another student's post must not be deletable");

  const stillThere = await request.get('/api/student/community/posts').set(bearer(a.accessToken));
  assert.ok(stillThere.body.data.some((p) => String(p.id) === String(postId)), 'post must survive B\'s attempt');

  // The author can.
  const aDelete = await request.delete(`/api/student/community/posts/${postId}`).set(bearer(a.accessToken));
  assert.equal(aDelete.status, 200);

  const afterDelete = await request.get('/api/student/community/posts').set(bearer(a.accessToken));
  assert.ok(!afterDelete.body.data.some((p) => String(p.id) === String(postId)), 'post must be gone');
});

test('markup is stripped from a post before it is stored', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const student = await registerAndLogin(request, { name: 'XSS Student', email: 'xss@example.com' });

  const created = await request
    .post('/api/student/community/posts')
    .set(bearer(student.accessToken))
    .send({ body: '<script>alert(document.cookie)</script>Real progress update' });

  assert.equal(created.status, 201);
  assert.ok(!created.body.data.body.includes('<script'), 'script tag must not survive');
  assert.ok(!created.body.data.body.includes('</script>'), 'closing tag must not survive');
  assert.ok(created.body.data.body.includes('Real progress update'), 'legitimate text must survive');

  // Confirm it is the STORED value that is clean, not just the response.
  const { Post } = await import('../src/models/Post.js');
  const stored = await Post.findById(created.body.data.id).lean();
  assert.ok(!stored.body.includes('<script'), 'stored value must be clean too');
});

test('a post consisting only of markup is rejected, not silently emptied', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const student = await registerAndLogin(request, { name: 'Empty Student', email: 'empty@example.com' });

  const res = await request
    .post('/api/student/community/posts')
    .set(bearer(student.accessToken))
    .send({ body: '<script></script>' });

  assert.equal(res.status, 422, 'must fail the min-length check after stripping');
});

test('ordinary comparison operators are not mangled by sanitisation', async (t) => {
  const { request, teardown } = await bootTestApp();
  t.after(teardown);

  const student = await registerAndLogin(request, { name: 'Math Student', email: 'math@example.com' });

  const body = 'I learned that 5 < 10 and 20 > 3 today.';
  const res = await request
    .post('/api/student/community/posts')
    .set(bearer(student.accessToken))
    .send({ body });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.body, body, 'prose containing < and > must be preserved exactly');
});
