/**
 * A second teacher-API process, for the cross-instance rate-limit test.
 *
 * It has to be a real child process. Two servers created inside one process
 * still share the module-level limiter object — and therefore its store — so an
 * in-process "second instance" passes even with the per-process default store,
 * which is precisely the bug being guarded against. Only a separate process
 * proves the counter lives in the database.
 *
 * Reads MONGODB_URI and AUTH_RATE_LIMIT_MAX from the environment and prints the
 * port it bound to, so the parent can address it.
 */
import http from 'node:http';

const { connectDatabase } = await import('../../src/config/db.js');
await connectDatabase({ retries: 1 });

const { createApp } = await import('../../src/app.js');
const server = http.createServer(createApp());

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
console.log(`READY ${server.address().port}`);
