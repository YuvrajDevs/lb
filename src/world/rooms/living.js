import * as THREE from 'three'
import { HX, HZ, box, cyl, makeFrame, tvTexture } from '../kit.js'
import { makeShell } from '../shell.js'
import { lampFx, glow } from '../fx.js'
import { plant } from './plants.js'
import { STAIR_HOLE } from './bedroom.js'

export const STAIR = { x: 4.6, zFoot: 3.0, zTop: -1.0, zStart: 2.3, steps: 12 }

export function buildLiving(riseTo) {
  const sh = makeShell({
    name: 'living room', wall: '#d6dde8', floorColor: '#b88f62', doorL: [0.9, 2.9], win: [-1.0, 2.0],
    holeCeil: STAIR_HOLE, skyKind: 1, frameKinds: [3, 0, 4],
  })
  const { root, walls, solid, frames } = sh

  // stairs along the right wall (steep, blocky, up through the opening)
  const run = (STAIR.zStart - STAIR.zTop) / STAIR.steps
  for (let i = 0; i < STAIR.steps; i++) {
    const h = ((i + 1) * riseTo) / STAIR.steps
    box(root, [1.4, h, run + 0.01], [STAIR.x, 0, STAIR.zStart - (i + 0.5) * run], i % 2 ? '#d9b27a' : '#cfa56c')
  }
  const L = Math.hypot(riseTo, STAIR.zStart - STAIR.zTop)
  const rail = box(root, [0.07, 0.07, L], [3.85, riseTo / 2 + 1.0, (STAIR.zStart + STAIR.zTop) / 2], '#8a6a4a')
  rail.rotation.x = Math.atan2(riseTo, STAIR.zStart - STAIR.zTop)
  solid(3.8, HX, STAIR.zTop, STAIR.zStart + 0.15)

  // sofa under the window
  const sofa = '#e08a68'
  box(root, [3.6, 0.55, 1.4], [0.5, 0, -HZ + 0.7], sofa)
  box(root, [3.6, 0.9, 0.35], [0.5, 0.55, -HZ + 0.18], '#d27a58')
  ;[-1.45, 2.45].forEach(x => box(root, [0.35, 0.9, 1.4], [x, 0, -HZ + 0.7], '#d27a58'))
  box(root, [0.7, 0.55, 0.2], [-0.6, 0.8, -HZ + 0.55], '#f2e8d0').rotation.z = 0.12
  box(root, [0.7, 0.55, 0.2], [1.8, 0.8, -HZ + 0.55], '#4a8f96').rotation.z = -0.12
  solid(-1.6, 2.6, -HZ, -HZ + 1.45)

  // TV on a low cabinet (left wall) - it glows blue
  box(root, [0.8, 0.65, 2.4], [-HX + 0.4, 0, -2.3], '#c9a070')
  box(root, [0.1, 1.25, 2.0], [-HX + 0.35, 0.65, -2.3], '#1d1f27')
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.85, 1.1),
    new THREE.MeshBasicMaterial({ map: tvTexture(), toneMapped: false })
  )
  screen.rotation.y = Math.PI / 2
  screen.position.set(-HX + 0.42, 1.3, -2.3)
  screen.userData.keep = true
  root.add(screen)
  glow(root, [-HX + 0.9, 1.3, -2.3], '#7fb0ff', 3.2, 0.4)
  solid(-HX, -HX + 0.85, -3.55, -1.05)
  frames.push(makeFrame(walls.left, 1.6, 1.1, [-HX + 0.03, 3.5, -2.3], Math.PI / 2, 2))

  // rug + coffee table
  box(root, [3.6, 0.03, 2.3], [0.0, 0, 0.9], '#c7c0b0')
  box(root, [1.5, 0.5, 0.9], [0.0, 0, 0.9], '#c9a070')
  cyl(root, 0.12, 0.2, [-0.4, 0.5, 0.9], '#f2efe6', {}, 12)
  solid(-0.85, 0.85, 0.4, 1.4)

  plant(root, 3.0, -2.9, 1.0)
  solid(2.6, 3.4, -3.3, -2.5)

  // floor lamp = this room's main light
  cyl(root, 0.25, 0.06, [-2.5, 0, -3.0], '#2f3138', {}, 16)
  cyl(root, 0.035, 2.5, [-2.5, 0.05, -3.0], '#2f3138', {}, 8)
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.45, 0.65, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffbe70', emissiveIntensity: 1.8, side: THREE.DoubleSide })
  )
  shade.position.set(-2.5, 2.85, -3.0)
  shade.userData.keep = true
  root.add(shade)
  lampFx(root, [-2.5, 2.85, -3.0], [-2.2, 0, -2.0], '#ffbe70', { size: 3.0, poolR: 3.0, coneH: 2.8, coneR: 1.5 })
  const light = new THREE.PointLight('#ffbe70', 42, 10, 2)
  light.position.set(-2.5, 2.6, -2.6)
  root.add(light)
  solid(-2.85, -2.15, -3.4, -2.6)
  return sh
}
