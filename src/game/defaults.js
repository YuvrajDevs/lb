// The standard furnishing every home starts with (and "Reset room" returns to).
// Positions are centres in metres, room-local (origin = floor centre, +z towards the open front).
// Rotation: 0 faces the open front, 1 faces right (+x), 2 faces the back wall, 3 faces left (-x).
// `on: n` puts the item on top of entry n of the same list. Wall items give `wall`, `at` (metres along it) and `v` (metres up).

export const DEFAULTS = {
  study: [
    { id: 'tables-4', at: [-0.8, -3.0], rot: 0 },                       // 0 writing desk under the window
    { id: 'lamps-2', on: 0, at: [-1.4, -3.0] },
    { id: 'seating-1', at: [-0.8, -1.8], rot: 0 },
    { id: 'shelves-2', at: [-5.1, -0.4], rot: 1 },
    { id: 'rugs-5', at: [0.5, 0.9], rot: 0 },
    { id: 'plants-3', at: [4.7, -3.0], rot: 0 },
    { id: 'pendants-3', at: [0.4, -0.3], rot: 0 },
    { id: 'curtains-1', wall: 'back', at: -0.8, v: 1.7 },
    { id: 'art-2', wall: 'back', at: 2.9, v: 2.0 },
    { id: 'art-4', wall: 'right', at: -1.8, v: 1.8 },
  ],
  bedroom: [
    { id: 'beds-4', at: [-1.8, -1.95], rot: 0 },
    { id: 'lamps-3', at: [-3.6, -3.0], rot: 0 },
    { id: 'wardrobes-3', at: [3.1, -3.2], rot: 0 },
    { id: 'plants-2', at: [4.7, -3.2], rot: 0 },
    { id: 'rugs-4', at: [1.0, 1.0], rot: 0 },
    { id: 'pendants-3', at: [-0.4, 0.3], rot: 0 },
    { id: 'curtains-4', wall: 'back', at: 0.4, v: 1.7 },
    { id: 'art-5', wall: 'back', at: -1.8, v: 2.3 },
  ],
  kitchen: [
    { id: 'tables-3', at: [-0.6, 0.6], rot: 0 },                       // 0 round table
    { id: 'lamps-1', on: 0, at: [-0.6, 0.6] },
    { id: 'seating-1', at: [-2.2, 0.6], rot: 0 },
    { id: 'seating-1', at: [1.0, 0.6], rot: 0 },
    { id: 'seating-1', at: [-0.6, 2.2], rot: 0 },
    { id: 'rugs-3', at: [-0.6, 0.9], rot: 0 },
    { id: 'pendants-2', at: [-0.6, 0.6], rot: 0 },
    { id: 'plants-3', at: [4.7, -2.8], rot: 0 },
    { id: 'curtains-2', wall: 'back', at: -1.8, v: 1.7 },
    { id: 'art-4', wall: 'back', at: 4.4, v: 2.3 },
  ],
  living: [
    { id: 'seating-5', at: [0.5, -3.0], rot: 0 },
    { id: 'tables-1', at: [0.5, -0.5], rot: 0 },                       // 1 coffee table
    { id: 'plants-1', on: 1, at: [0.0, -0.5] },
    { id: 'lamps-4', at: [-1.7, -3.2], rot: 0 },
    { id: 'shelves-4', at: [-3.6, -3.35], rot: 0 },
    { id: 'rugs-5', at: [0.5, 1.2], rot: 0 },
    { id: 'plants-4', at: [-3.2, 3.0], rot: 0 },
    { id: 'pendants-4', at: [0.4, -0.3], rot: 0 },
    { id: 'curtains-3', wall: 'back', at: 0.5, v: 1.7 },
    { id: 'art-2', wall: 'back', at: -3.6, v: 3.1 },
  ],
  garden: [
    { id: 'gardenlights-3', at: [-5.0, 6.0] },
    { id: 'gardenlights-3', at: [6.0, 6.5] },
    { id: 'gardenlights-2', at: [-8.5, 5.5] },
  ],
}

/** everything the standard homes use, counted: a fresh player owns exactly this */
export function starterOwned() {
  const owned = {}
  Object.values(DEFAULTS).forEach(list => list.forEach(e => { owned[e.id] = (owned[e.id] || 0) + 1 }))
  return owned
}
