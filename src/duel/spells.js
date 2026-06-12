// Spell data layer. Pure data and a pure resolve function — no timers,
// no DOM, no engine state, so all of it runs headless under Node.
//
// Beats cycle: bolt > counter > smash > shield > bolt.
//   - shield blocks a bolt
//   - smash breaks through a shield
//   - counter negates a smash and reflects damage back
//   - a bolt is too fast to counter and hits through it

export const SPELLS = {
  bolt: {
    id: 'bolt',
    name: 'Bolt',
    type: 'attack',
    damage: 8,
    castTimeMs: 600,
    cooldownMs: 1000,
    beats: ['counter'],
  },
  smash: {
    id: 'smash',
    name: 'Smash',
    type: 'heavy',
    damage: 22,
    castTimeMs: 1800,
    cooldownMs: 4000,
    requiresCharge: true,
    beats: ['shield'],
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    type: 'shield',
    damage: 0,
    castTimeMs: 300,
    cooldownMs: 2500,
    beats: ['bolt'],
  },
  counter: {
    id: 'counter',
    name: 'Counter',
    type: 'counter',
    damage: 12, // reflected onto the attacker on a successful counter
    castTimeMs: 500,
    cooldownMs: 3500,
    beats: ['smash'],
  },
};

const OFFENSIVE = new Set(['attack', 'heavy']);

function isOffensive(spell) {
  return spell !== null && OFFENSIVE.has(spell.type);
}

// Resolves one attack from `attacker` landing on a defender whose active
// cast is `defense` (a shield/counter spell, or null for nothing active).
// Returns damage dealt each way plus what happened.
function resolveAttack(attacker, defense) {
  if (defense && defense.beats.includes(attacker.id)) {
    if (defense.type === 'counter') {
      return { outcome: 'countered', damageToDefender: 0, damageToAttacker: defense.damage };
    }
    return { outcome: 'blocked', damageToDefender: 0, damageToAttacker: 0 };
  }
  // Attack wins outright (its beats list names the defense) or nothing
  // relevant was up — either way it lands.
  return { outcome: 'hit', damageToDefender: attacker.damage, damageToAttacker: 0 };
}

// Pure resolve over both players' active casts. Either cast may be null.
// Returns { damageToA, damageToB, events } where each event is
// { attacker: 'a'|'b', spellId, outcome: 'hit'|'blocked'|'countered' }.
export function resolve(castA, castB) {
  let damageToA = 0;
  let damageToB = 0;
  const events = [];

  if (isOffensive(castA)) {
    const r = resolveAttack(castA, isOffensive(castB) ? null : castB);
    damageToB += r.damageToDefender;
    damageToA += r.damageToAttacker;
    events.push({ attacker: 'a', spellId: castA.id, outcome: r.outcome });
  }
  if (isOffensive(castB)) {
    const r = resolveAttack(castB, isOffensive(castA) ? null : castA);
    damageToA += r.damageToDefender;
    damageToB += r.damageToAttacker;
    events.push({ attacker: 'b', spellId: castB.id, outcome: r.outcome });
  }

  return { damageToA, damageToB, events };
}
