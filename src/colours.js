// The ten ring colours a child can pick from. Each one is used for the running arc
// and the rocket accents. Every colour is at least 3:1 against the dark page background.
export const RING_COLOURS = Object.freeze([
  { name: 'Blue', hex: '#0072B2' },
  { name: 'Red', hex: '#D32F2F' },
  { name: 'Green', hex: '#2E7D32' },
  { name: 'Purple', hex: '#AB47BC' },
  { name: 'Pink', hex: '#D81B60' },
  { name: 'Orange', hex: '#E65100' },
  { name: 'Teal', hex: '#00897B' },
  { name: 'Yellow', hex: '#FDD835' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Gold', hex: '#B38600' },
]);

export const DEFAULT_RING_COLOUR = RING_COLOURS[0].hex;
