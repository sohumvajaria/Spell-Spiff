// Duel state machine. Headless and clock-injected: callers pass `now`
// (milliseconds) into castIntent and tick, so Node tests can drive it
// with a fake clock and the page drives it with performance.now().
//
// Flow per round: consume cast-intents -> windup for castTimeMs ->
// fire -> resolve against the defender's active defense -> deduct HP.
// Round ends at zero HP. Best of three rounds wins the match.
//
// Charge rule: landing a bolt grants charge; smash requires and
// consumes it.

import { SPELLS, resolve } from './spells.js';

export const MAX_HP = 50;
export const ROUND_WINS_TO_TAKE_MATCH = 2;
export const ROUND_RESET_MS = 2000;

// How long a defensive cast stays up after its windup completes.
export const DEFENSE_ACTIVE_MS = { shield: 1200, counter: 700 };

function makePlayer() {
  return {
    hp: MAX_HP,
    charge: false,
    cast: null, // { spellId, startedAt, firesAt }
    defense: null, // { spellId, expiresAt }
    cooldowns: {}, // spellId -> ready-at timestamp
  };
}

function other(caster) {
  return caster === 'p1' ? 'p2' : 'p1';
}

export function createDuel() {
  const state = {
    phase: 'fighting', // 'fighting' | 'round-over' | 'match-over'
    round: 1,
    wins: { p1: 0, p2: 0 },
    players: { p1: makePlayer(), p2: makePlayer() },
    feed: [], // { at, text } most recent last
    nextRoundAt: null,
    winner: null,
  };

  function log(at, text) {
    state.feed.push({ at, text });
    if (state.feed.length > 30) state.feed.shift();
  }

  function castIntent(caster, spellId, now) {
    if (state.phase !== 'fighting') return false;
    const p = state.players[caster];
    const spell = SPELLS[spellId];
    if (!spell || p.cast) return false;
    if ((p.cooldowns[spellId] ?? 0) > now) return false;
    if (spell.requiresCharge && !p.charge) {
      log(now, `${caster} needs charge for ${spell.name}`);
      return false;
    }
    p.cast = { spellId, startedAt: now, firesAt: now + spell.castTimeMs };
    log(now, `${caster} starts ${spell.name}`);
    return true;
  }

  function applyHit(attackerId, spell, now) {
    const defenderId = other(attackerId);
    const attacker = state.players[attackerId];
    const defender = state.players[defenderId];
    const defenseSpell = defender.defense ? SPELLS[defender.defense.spellId] : null;

    const r = resolve(spell, defenseSpell);
    const outcome = r.events[0].outcome;
    defender.hp = Math.max(0, defender.hp - r.damageToB);
    attacker.hp = Math.max(0, attacker.hp - r.damageToA);

    if (outcome === 'hit') {
      log(now, `${attackerId} ${spell.name} hits ${defenderId} for ${r.damageToB}`);
      if (spell.id === 'bolt') attacker.charge = true;
    } else if (outcome === 'blocked') {
      log(now, `${defenderId} blocks ${spell.name}`);
    } else if (outcome === 'countered') {
      log(now, `${defenderId} counters ${spell.name}, ${r.damageToA} reflected`);
      defender.defense = null; // a counter is consumed when it triggers
    }
    return outcome;
  }

  function fire(casterId, now) {
    const p = state.players[casterId];
    const spell = SPELLS[p.cast.spellId];
    p.cast = null;
    p.cooldowns[spell.id] = now + spell.cooldownMs;
    if (spell.type === 'attack' || spell.type === 'heavy') {
      if (spell.requiresCharge) p.charge = false;
      applyHit(casterId, spell, now);
    } else {
      p.defense = { spellId: spell.id, expiresAt: now + DEFENSE_ACTIVE_MS[spell.id] };
      log(now, `${casterId} raises ${spell.name}`);
    }
  }

  function endRound(now) {
    const p1Dead = state.players.p1.hp <= 0;
    const p2Dead = state.players.p2.hp <= 0;
    let roundWinner = null;
    if (p1Dead && !p2Dead) roundWinner = 'p2';
    if (p2Dead && !p1Dead) roundWinner = 'p1';
    // Both dead at once is a draw: nobody scores, the round replays.

    if (roundWinner) {
      state.wins[roundWinner]++;
      log(now, `${roundWinner} takes round ${state.round}`);
      if (state.wins[roundWinner] >= ROUND_WINS_TO_TAKE_MATCH) {
        state.phase = 'match-over';
        state.winner = roundWinner;
        log(now, `${roundWinner} wins the match`);
        return;
      }
    } else {
      log(now, `round ${state.round} is a draw`);
    }
    state.phase = 'round-over';
    state.nextRoundAt = now + ROUND_RESET_MS;
  }

  function startNextRound(now) {
    state.round++;
    state.players.p1 = makePlayer();
    state.players.p2 = makePlayer();
    state.phase = 'fighting';
    state.nextRoundAt = null;
    log(now, `round ${state.round} — fight`);
  }

  function tick(now) {
    if (state.phase === 'round-over') {
      if (now >= state.nextRoundAt) startNextRound(now);
      return;
    }
    if (state.phase !== 'fighting') return;

    for (const id of ['p1', 'p2']) {
      const p = state.players[id];
      if (p.defense && p.defense.expiresAt <= now) p.defense = null;
      if (p.cast && p.cast.firesAt <= now) fire(id, now);
      if (state.players.p1.hp <= 0 || state.players.p2.hp <= 0) {
        endRound(now);
        return;
      }
    }
  }

  return { state, castIntent, tick };
}
