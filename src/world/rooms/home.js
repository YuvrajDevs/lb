import { makeShell } from '../shell.js'
import { WINDOWS } from '../../game/areas.js'

// The starter home: a single room, front door in the middle, windows on every side. Nothing is built in:
// the bed, cupboard, table, bookshelf and lamp a new player starts with are placed from the inventory.
export function buildHome() {
  return makeShell({
    name: 'home', wall: '#e9e2d6', wainscot: '#c9b9a0', cove: '#ffd27a',
    floorColor: '#b98a5a', win: WINDOWS.home.x, winY: WINDOWS.home.y, frameKinds: [0, 3, 2],
    ext: { storey: 'ground', color: '#eadfc6', batten: null, windows: [-3.4, 3.4], doorFront: 0, extLeft: true, extRight: true },
  })
}
