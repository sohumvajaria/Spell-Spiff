// Minimal event bus for input events.
//
// The duel engine only ever sees events from this bus, never raw devices.
// One event type exists today:
//
//   'cast-intent'  payload: { caster, spellId }
//
// Any adapter (keyboard, AI, rune recognizer) emits the same event shape,
// so the engine cannot tell input sources apart.

export function createBus() {
  const listeners = new Map();

  return {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
    },
    off(event, fn) {
      listeners.get(event)?.delete(fn);
    },
    emit(event, payload) {
      for (const fn of listeners.get(event) ?? []) fn(payload);
    },
  };
}
