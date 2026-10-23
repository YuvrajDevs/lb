import { makeShell } from '../shell.js'

// The study has nothing built in: every piece of furniture is placed from the inventory (see game/defaults.js).
export function buildStudy() {
  return makeShell({
    name: 'study', wall: '#d8e0d4', wainscot: '#aab8a8', cove: '#8fe0d0',
    floorColor: '#a9794c', doorR: [0.9, 2.9], win: [-2.2, 0.6], frameKinds: [0, 3, 2], skyKind: 0,
    ext: { storey: 'upper', color: '#a9c4b0', batten: '#bcd4c2', windows: [-3.2, 3.2], extLeft: true },
  })
}
