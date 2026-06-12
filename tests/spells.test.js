import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPELLS, resolve } from '../src/duel/spells.js';

const { bolt, smash, shield, counter } = SPELLS;

test('bolt vs nothing hits for bolt damage', () => {
  const r = resolve(bolt, null);
  assert.equal(r.damageToB, bolt.damage);
  assert.equal(r.damageToA, 0);
  assert.equal(r.events[0].outcome, 'hit');
});

test('shield blocks bolt', () => {
  const r = resolve(bolt, shield);
  assert.equal(r.damageToB, 0);
  assert.equal(r.damageToA, 0);
  assert.equal(r.events[0].outcome, 'blocked');
});

test('bolt hits through counter', () => {
  const r = resolve(bolt, counter);
  assert.equal(r.damageToB, bolt.damage);
  assert.equal(r.damageToA, 0);
  assert.equal(r.events[0].outcome, 'hit');
});

test('smash breaks through shield', () => {
  const r = resolve(smash, shield);
  assert.equal(r.damageToB, smash.damage);
  assert.equal(r.damageToA, 0);
  assert.equal(r.events[0].outcome, 'hit');
});

test('counter negates smash and reflects damage', () => {
  const r = resolve(smash, counter);
  assert.equal(r.damageToB, 0);
  assert.equal(r.damageToA, counter.damage);
  assert.equal(r.events[0].outcome, 'countered');
});

test('smash vs nothing hits for smash damage', () => {
  const r = resolve(smash, null);
  assert.equal(r.damageToB, smash.damage);
});

test('both attacking trade damage with no defense applied', () => {
  const r = resolve(bolt, smash);
  assert.equal(r.damageToB, bolt.damage);
  assert.equal(r.damageToA, smash.damage);
  assert.equal(r.events.length, 2);
  assert.ok(r.events.every((e) => e.outcome === 'hit'));
});

test('defense vs defense does nothing', () => {
  const r = resolve(shield, counter);
  assert.equal(r.damageToA, 0);
  assert.equal(r.damageToB, 0);
  assert.equal(r.events.length, 0);
});

test('resolve is symmetric', () => {
  const ab = resolve(smash, counter);
  const ba = resolve(counter, smash);
  assert.equal(ab.damageToA, ba.damageToB);
  assert.equal(ab.damageToB, ba.damageToA);
});
