import test from 'node:test';
import assert from 'node:assert/strict';

const { levelForXp } = await import('../src/services/xp.service.js');

test('levelForXp: 0 xp is level 1', () => {
  assert.equal(levelForXp(0), 1);
});

test('levelForXp: 499 xp is still level 1, 500 xp is level 2', () => {
  assert.equal(levelForXp(499), 1);
  assert.equal(levelForXp(500), 2);
});

test('levelForXp: 2450 xp is level 5', () => {
  assert.equal(levelForXp(2450), 5);
});
