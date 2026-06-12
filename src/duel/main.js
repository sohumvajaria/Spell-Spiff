import { createBus } from '../input/bus.js';
import { attachKeyboard } from '../input/keyboard.js';
import { attachAI } from './ai.js';
import { createDuel } from './engine.js';
import { SPELLS } from './spells.js';

const bus = createBus();
const duel = createDuel();

// Player one casts with number keys. A rune adapter will replace this
// mapping later by emitting the same cast-intent events (see
// src/input/keyboard.js for the seam).
attachKeyboard(bus, 'p1', {
  1: 'bolt',
  2: 'smash',
  3: 'shield',
  4: 'counter',
});

attachAI(bus, 'p2', () => duel.state);

bus.on('cast-intent', ({ caster, spellId }) => {
  duel.castIntent(caster, spellId, performance.now());
});

// --- Minimal text rendering until the combat HUD lands ---
const stateEl = document.getElementById('duel-state');
const feedEl = document.getElementById('duel-feed');

function describePlayer(id, p) {
  const cast = p.cast ? ` casting ${SPELLS[p.cast.spellId].name}` : '';
  const def = p.defense ? ` [${SPELLS[p.defense.spellId].name} up]` : '';
  const charge = p.charge ? ' ⚡charged' : '';
  return `${id}: ${p.hp} HP${charge}${cast}${def}`;
}

function render() {
  const s = duel.state;
  if (s.phase === 'match-over') {
    stateEl.textContent =
      `${s.winner === 'p1' ? 'YOU WIN' : 'AI WINS'} the match ` +
      `(${s.wins.p1}–${s.wins.p2}). Refresh to rematch.`;
  } else {
    stateEl.textContent =
      `Round ${s.round} (wins ${s.wins.p1}–${s.wins.p2})\n` +
      `${describePlayer('You', s.players.p1)}\n` +
      `${describePlayer('AI', s.players.p2)}`;
  }
  feedEl.textContent = s.feed.slice(-8).map((e) => e.text).join('\n');
}

function loop() {
  duel.tick(performance.now());
  render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
