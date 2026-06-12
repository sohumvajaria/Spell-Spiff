import { createBus } from '../input/bus.js';
import { attachKeyboard } from '../input/keyboard.js';

const bus = createBus();

// Player one casts with number keys. Spell ids are placeholders until the
// spell data layer lands.
attachKeyboard(bus, 'p1', {
  1: 'spell-1',
  2: 'spell-2',
  3: 'spell-3',
  4: 'spell-4',
});

bus.on('cast-intent', (intent) => {
  console.log('cast-intent', intent);
});
