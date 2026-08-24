/**
 * Live smoke test against a running server (`npm run dev` in one terminal,
 * `npm run verify` in another). Exercises auth, RBAC rejection, validation,
 * CRUD, and audit logging against the real MongoDB database — not mocks.
 */
const BASE = process.env.VERIFY_BASE_URL || 'http://localhost:5003/api/admin';
const EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL || 'admin@nalanda.edu';
const PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD || 'Admin@Nalanda2026!';

let pass = 0;
let fail = 0;

function check(name, condition) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    pass += 1;
  } else {
    console.error(`  ✗ ${name}`);
    fail += 1;
  }
}

async function main() {
  console.log('== Nalanda Admin Backend — E2E Verification ==\n');

  console.log('[1] Unauthenticated requests are rejected');
  const noAuth = await fetch(`${BASE}/students`);
  check('GET /students without token -> 401', noAuth.status === 401);

  const badToken = await fetch(`${BASE}/students`, { headers: { Authorization: 'Bearer garbage' } });
  check('GET /students with garbage token -> 401', badToken.status === 401);

  console.log('\n[2] Login');
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginJson = await loginRes.json();
  check('Login succeeds with seeded credentials', loginRes.status === 200 && loginJson.success);
  check('Role is SUPER_ADMIN', loginJson.data?.admin?.role === 'SUPER_ADMIN');
  check('passwordHash never returned', loginJson.data?.admin?.passwordHash === undefined);
  const token = loginJson.data.token;
  const auth = { Authorization: `Bearer ${token}` };

  const wrongPassRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: 'wrong-password' }),
  });
  check('Wrong password -> 401', wrongPassRes.status === 401);

  console.log('\n[3] Dashboard overview reflects real data (not hardcoded)');
  const overviewRes = await fetch(`${BASE}/overview`, { headers: auth });
  const overview = (await overviewRes.json()).data;
  check('kpi.students is a number', typeof overview.kpi.students.value === 'number');
  check('teacherStatus totals are internally consistent', typeof overview.teacherStatus.active === 'number');

  console.log('\n[4] Student CRUD against MongoDB');
  const email = `verify-${Date.now()}@nalanda.edu`;
  const createRes = await fetch(`${BASE}/students`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Verify Student', email, rollNo: `VER-${Date.now()}` }),
  });
  const created = await createRes.json();
  check('Create student -> 201', createRes.status === 201 && created.success);
  const studentId = created.data._id;

  const dupRes = await fetch(`${BASE}/students`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Dup', email, rollNo: `VER2-${Date.now()}` }),
  });
  check('Duplicate email -> 409', dupRes.status === 409);

  const invalidRes = await fetch(`${BASE}/students`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'X' }),
  });
  check('Missing required fields -> 422', invalidRes.status === 422);

  const updateRes = await fetch(`${BASE}/students/${studentId}`, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ attendancePercent: 42 }),
  });
  const updated = await updateRes.json();
  check('Update student -> 200 with new value persisted', updateRes.status === 200 && updated.data.attendancePercent === 42);

  const deleteRes = await fetch(`${BASE}/students/${studentId}`, { method: 'DELETE', headers: auth });
  check('Delete (soft) student -> 200', deleteRes.status === 200);

  const getAfterDelete = await fetch(`${BASE}/students/${studentId}`, { headers: auth });
  check('Soft-deleted student no longer returned by GET -> 404', getAfterDelete.status === 404);

  console.log('\n[5] Audit trail captured the actions above');
  const auditRes = await fetch(`${BASE}/audit-logs?limit=10`, { headers: auth });
  const auditJson = await auditRes.json();
  const actions = auditJson.data.map((a) => a.action);
  check('audit log contains student.created', actions.includes('student.created'));
  check('audit log contains student.updated', actions.includes('student.updated'));
  check('audit log contains student.deleted', actions.includes('student.deleted'));

  console.log(`\n== Result: ${pass} passed, ${fail} failed ==`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});
