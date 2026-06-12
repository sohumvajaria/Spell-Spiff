import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDuel,
  MAX_HP,
  ROUND_RESET_MS,
  DEFENSE_ACTIVE_MS,
} from '../src/duel/engine.js';
import { SPELLS } from '../src/duel/spells.js';

const { bolt, smash, shield, counter } = SPELLS;

// Casts a p1 bolt at `t` and ticks past its windup. Returns the time at
// which bolt comes off cooldown and can be cast again.
function landBolt(duel, t) {
  assert.ok(duel.castIntent('p1', 'bolt', t), `bolt refused at ${t}`);
  duel.tick(t + bolt.castTimeMs);
  return t + bolt.castTimeMs + bolt.cooldownMs;
}

// Drives p1 bolts until the current round ends. Returns a time safely
// after the last tick.
function winRoundAsP1(duel, t) {
  while (duel.state.phase === 'fighting') {
    t = landBolt(duel, t);
  }
  return t;
}

test('cast winds up for castTimeMs before damage lands', () => {
  const duel = createDuel();
  assert.ok(duel.castIntent('p1', 'bolt', 0));
  duel.tick(bolt.castTimeMs - 1);
  assert.equal(duel.state.players.p2.hp, MAX_HP);
  assert.ok(duel.state.players.p1.cast);
  duel.tick(bolt.castTimeMs);
  assert.equal(duel.state.players.p2.hp, MAX_HP - bolt.damage);
  assert.equal(duel.state.players.p1.cast, null);
});

test('cannot start a cast while one is winding up', () => {
  const duel = createDuel();
  assert.ok(duel.castIntent('p1', 'bolt', 0));
  assert.equal(duel.castIntent('p1', 'shield', 100), false);
});

test('unknown spell id is refused', () => {
  const duel = createDuel();
  assert.equal(duel.castIntent('p1', 'fireball', 0), false);
});

test('cooldown blocks recast until it elapses', () => {
  const duel = createDuel();
  const readyAt = landBolt(duel, 0);
  assert.equal(duel.castIntent('p1', 'bolt', readyAt - 1), false);
  assert.ok(duel.castIntent('p1', 'bolt', readyAt));
});

test('smash requires charge; a landed bolt grants it; smash consumes it', () => {
  const duel = createDuel();
  assert.equal(duel.castIntent('p1', 'smash', 0), false);

  const t = landBolt(duel, 0);
  assert.equal(duel.state.players.p1.charge, true);

  assert.ok(duel.castIntent('p1', 'smash', t));
  duel.tick(t + smash.castTimeMs);
  assert.equal(duel.state.players.p1.charge, false);
  assert.equal(
    duel.state.players.p2.hp,
    MAX_HP - bolt.damage - smash.damage,
  );
});

test('shield blocks a bolt and stays up; it expires on its own', () => {
  const duel = createDuel();
  assert.ok(duel.castIntent('p2', 'shield', 0));
  assert.ok(duel.castIntent('p1', 'bolt', 0));
  duel.tick(shield.castTimeMs); // shield up
  duel.tick(bolt.castTimeMs); // bolt fires into it
  assert.equal(duel.state.players.p2.hp, MAX_HP);
  assert.ok(duel.state.players.p2.defense, 'shield survives the block');

  duel.tick(shield.castTimeMs + DEFENSE_ACTIVE_MS.shield);
  assert.equal(duel.state.players.p2.defense, null);
});

test('counter reflects a smash and is consumed', () => {
  const duel = createDuel();
  let t = landBolt(duel, 0); // earn charge; p2 down one bolt
  const p2HpBefore = duel.state.players.p2.hp;

  assert.ok(duel.castIntent('p1', 'smash', t));
  const smashFiresAt = t + smash.castTimeMs;
  // p2 reads the long windup and counters in time.
  assert.ok(duel.castIntent('p2', 'counter', smashFiresAt - counter.castTimeMs - 100));
  duel.tick(smashFiresAt - 100); // counter comes up first
  duel.tick(smashFiresAt);

  assert.equal(duel.state.players.p2.hp, p2HpBefore);
  assert.equal(duel.state.players.p1.hp, MAX_HP - counter.damage);
  assert.equal(duel.state.players.p2.defense, null, 'counter is consumed');
});

test('round ends at zero HP and the next round starts fresh', () => {
  const duel = createDuel();
  const t = winRoundAsP1(duel, 0);

  assert.equal(duel.state.phase, 'round-over');
  assert.deepEqual(duel.state.wins, { p1: 1, p2: 0 });
  assert.equal(duel.castIntent('p1', 'bolt', t), false);

  duel.tick(t + ROUND_RESET_MS);
  assert.equal(duel.state.phase, 'fighting');
  assert.equal(duel.state.round, 2);
  assert.equal(duel.state.players.p1.hp, MAX_HP);
  assert.equal(duel.state.players.p2.hp, MAX_HP);
  assert.equal(duel.state.players.p1.charge, false);
});

test('two round wins take the match and lock out further casts', () => {
  const duel = createDuel();
  let t = winRoundAsP1(duel, 0);
  duel.tick(t + ROUND_RESET_MS);
  t = winRoundAsP1(duel, t + ROUND_RESET_MS);

  assert.equal(duel.state.phase, 'match-over');
  assert.equal(duel.state.winner, 'p1');
  assert.deepEqual(duel.state.wins, { p1: 2, p2: 0 });
  assert.equal(duel.castIntent('p2', 'bolt', t), false);
});
