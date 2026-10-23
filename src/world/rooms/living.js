import * as THREE from 'three'
import { HX, box } from '../kit.js'
import { makeShell } from '../shell.js'
import { tvTexture } from '../kit.js'
import { glow } from '../fx.js'
import { STAIR_HOLE } from './bedroom.js'

export const STAIR = { x: 4.6, zFoot: 3.0, zTop: -1.0, zStart: 2.3, steps: 12 }
const OAK = '#c9a070'

// Built in: the staircase to the bedroom and the TV unit. Everything else is placed from the inventory.
export function buildLiving(riseTo) {
  const sh = makeShell({
    name: 'living room', wall: '#d6dde8', wainscot: '#9fb0c8', cove: '#9aa8ff',
    floorColor: '#b88f62', doorL: [0.9, 2.9], win: [-1.0, 2.0],
    holeCeil: STAIR_HOLE, skyKind: 1, frameKinds: [3, 0, 4],
    ext: { storey: 'ground', color: '#eadfc6', batten: null, windows: [3.4], doorFront: -3.4, extRight: true },
  })
  const { root, solid } = sh

  const run = (STAIR.zStart - STAIR.zTop) / STAIR.steps
  for (let i = 0; i < STAIR.steps; i++) {
    const h = ((i + 1) * riseTo) / STAIR.steps
    box(root, [1.4, h, run + 0.01], [STAIR.x, 0, STAIR.zStart - (i + 0.5) * run], i % 2 ? '#d9b27a' : '#cfa56c')
  }
  const L = Math.hypot(riseTo, STAIR.zStart - STAIR.zTop)
  const rail = box(root, [0.07, 0.07, L], [3.85, riseTo / 2 + 1.0, (STAIR.zStart + STAIR.zTop) / 2], '#8a6a4a')
  rail.rotation.x = Math.atan2(riseTo, STAIR.zStart - STAIR.zTop)
  solid(3.8, HX, STAIR.zTop, STAIR.zStart + 0.15)

  // TV on a low cabinet (left wall) with a blue backlight
  box(root, [0.8, 0.65, 2.4], [-HX + 0.4, 0, -1.7], OAK)
  ;[-2.3, -1.1].forEach(z => box(root, [0.04, 0.45, 1.0], [-HX + 0.82, 0.1, z], '#e6bd7c'))
  box(root, [0.1, 1.25, 2.0], [-HX + 0.35, 0.65, -1.7], '#1d1f27')
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 1.1), new THREE.MeshBasicMaterial({ map: tvTexture(), toneMapped: false }))
  screen.rotation.y = Math.PI / 2
  screen.position.set(-HX + 0.42, 1.3, -1.7)
  screen.userData.keep = true
  root.add(screen)
  box(root, [0.04, 1.5, 0.05], [-HX + 0.05, 0.7, -2.85], '#cfe0ff', { emissive: '#7f9cff', emissiveIntensity: 2.4 })
  box(root, [0.04, 1.5, 0.05], [-HX + 0.05, 0.7, -0.55], '#cfe0ff', { emissive: '#7f9cff', emissiveIntensity: 2.4 })
  glow(root, [-HX + 0.9, 1.3, -1.7], '#7fb0ff', 3.4, 0.4)
  solid(-HX, -HX + 0.85, -2.95, -0.45)
  return sh
}
