import { HX } from '../kit.js'
import { makeShell } from '../shell.js'
import { WINDOWS } from '../../game/areas.js'
import { railing } from './plants.js'

export const STAIR_HOLE = { x0: 3.9, x1: HX, z0: -1.0, z1: 1.4 }

// Built in: the stairwell opening with its railing (open at the top of the stairs). Everything else is placed from the inventory.
export function buildBedroom() {
  const sh = makeShell({
    name: 'bedroom', wall: '#ecd9d6', wainscot: '#cfa9ad', cove: '#ffd27a',
    floorColor: '#c9a273', doorL: [0.9, 2.9], win: WINDOWS.bedroom.x, winY: WINDOWS.bedroom.y,
    holeFloor: STAIR_HOLE, frameKinds: [1, 4, 0],
    ext: { storey: 'upper', color: '#a9c4b0', batten: '#bcd4c2', windows: [-3.2], balcony: 2.4, extRight: true },
  })
  railing(sh.root, 3.9, -1.0, 3.9, 1.4)
  railing(sh.root, 3.9, 1.4, HX - 0.13, 1.4)
  // nobody walks over the stairwell; the top of the stairs (z = -1.0) stays open
  sh.colliders.push({ minX: STAIR_HOLE.x0, maxX: STAIR_HOLE.x1, minZ: STAIR_HOLE.z0, maxZ: STAIR_HOLE.z1, stair: true })
  return sh
}
