// Keyboard input adapter: number keys -> cast-intent events.
//
// SEAM — rune adapter goes here later:
// When the recognizer is validated, a rune adapter will sit next to this
// file. On pen-up it will take the recognizer's top match name, map it to
// a spellId, and emit the exact same event:
//
//   bus.emit('cast-intent', { caster, spellId });
//
// Nothing downstream changes. The engine consumes cast-intent and never
// knows whether a key press or a drawn rune produced it.

export function attachKeyboard(bus, caster, keyToSpellId) {
  const handler = (e) => {
    const spellId = keyToSpellId[e.key];
    if (spellId) bus.emit('cast-intent', { caster, spellId });
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
