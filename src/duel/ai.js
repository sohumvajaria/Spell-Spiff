// Dumb AI input adapter: casts on a fixed timer. It is just another
// emitter of cast-intent — the engine cannot tell it from a keyboard
// or, later, a rune adapter.

export function attachAI(bus, caster, getState, { intervalMs = 2200 } = {}) {
  const timer = setInterval(() => {
    const me = getState().players[caster];
    if (!me) return;
    const spellId = me.charge ? 'smash' : 'bolt';
    bus.emit('cast-intent', { caster, spellId });
  }, intervalMs);
  return () => clearInterval(timer);
}
