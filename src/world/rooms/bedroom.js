import { HX } from '../kit.js'
import { makeShell } from '../shell.js'
import { railing } from './plants.js'

export const STAIR_HOLE = { x0: 3.9, x1: HX, z0: -1.0, z1: 1.4 }

// Built in: the stairwell opening with its railing. Everything else is placed from the inventory.
export function buildBedroom() {
  const sh = makeShell({
    name: 'bedroom', wall: '#ecd9d6', wainscot: '#cfa9ad', cove: '#ff9cc4',
    floorColor: '#c9a273', doorL: [0.9, 2.9], win: [-1.0, 1.8],
    holeFloor: STAIR_HOLE, skyKind: 1, frameKinds: [1, 4, 0],
    ext: { storey: 'upper', color: '#a9c4b0', batten: '#bcd4c2', windows: [-3.2], balcony: 2.4, extRight: true },
  })
  railing(sh.root, 3.9, -1.0, 3.9, 1.4)
  railing(sh.root, 3.9, -1.0, HX - 0.05, -1.0)
  railing(sh.root, 3.9, 1.4, HX - 0.05, 1.4)
  return sh
}
