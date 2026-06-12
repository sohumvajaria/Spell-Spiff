// Template store: raw stroke samples per rune name, persisted to
// localStorage. Points stay raw; the recognizer normalizes on load.

const STORAGE_KEY = 'spell-spiff-templates';

// Shape: { [runeName]: [ [{x,y}, ...], ... ] }
export function loadTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return typeof data === 'object' && data !== null ? data : {};
  } catch {
    return {};
  }
}

export function saveTemplates(templates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function exportTemplates(templates) {
  return JSON.stringify(templates, null, 2);
}

// Merges imported runes into the existing set, appending samples for
// names that already exist. Throws on malformed input.
export function importTemplates(existing, json) {
  const incoming = JSON.parse(json);
  if (typeof incoming !== 'object' || incoming === null || Array.isArray(incoming)) {
    throw new Error('Expected an object mapping rune names to sample arrays');
  }
  const merged = { ...existing };
  for (const [name, samples] of Object.entries(incoming)) {
    if (!Array.isArray(samples)) throw new Error(`Samples for "${name}" must be an array`);
    for (const sample of samples) {
      if (!Array.isArray(sample) || sample.some((p) => typeof p.x !== 'number' || typeof p.y !== 'number')) {
        throw new Error(`Malformed sample in "${name}"`);
      }
    }
    merged[name] = [...(merged[name] || []), ...samples];
  }
  return merged;
}
