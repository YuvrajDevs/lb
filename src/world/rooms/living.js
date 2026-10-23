import * as THREE from 'three'
import { HX, HZ, box, cyl, sphere, makeFrame, tvTexture, bookRow } from '../kit.js'
import { makeShell } from '../shell.js'
import { lampFx, glow } from '../fx.js'
import { plant } from './plants.js'
import { STAIR_HOLE } from './bedroom.js'

export const STAIR = { x: 4.6, zFoot: 3.0, zTop: -1.0, zStart: 2.3, steps: 12 }
const OAK = '#c9a070'
const DARK = '#9a7248'

export function buildLiving(riseTo) {
  const sh = makeShell({
    name: 'living room', wall: '#d6dde8', wainscot: '#9fb0c8', curtain: '#6f84a8', cove: '#9aa8ff',
    floorColor: '#b88f62', doorL: [0.9, 2.9], win: [-1.0, 2.0],
    holeCeil: STAIR_HOLE, skyKind: 1, frameKinds: [3, 0, 4],
    ext: { storey: 'ground', color: '#eadfc6', batten: null, windows: [3.4], doorFront: -3.4, extRight: true },
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

  // sofa under the window with cushions and a throw
  const sofa = '#e08a68', sofaDark = '#d27a58'
  box(root, [3.6, 0.55, 1.4], [0.5, 0, -HZ + 0.7], sofa)
  box(root, [3.6, 0.9, 0.35], [0.5, 0.55, -HZ + 0.18], sofaDark)
  ;[-1.45, 2.45].forEach(x => box(root, [0.35, 0.9, 1.4], [x, 0, -HZ + 0.7], sofaDark))
  ;[-0.55, 0.55, 1.65].forEach(x => box(root, [1.0, 0.18, 1.0], [x, 0.55, -HZ + 0.9], '#ea9a78'))
  box(root, [0.7, 0.55, 0.2], [-0.6, 0.8, -HZ + 0.55], '#f2e8d0').rotation.z = 0.12
  box(root, [0.7, 0.55, 0.2], [1.8, 0.8, -HZ + 0.55], '#4a8f96').rotation.z = -0.12
  box(root, [0.55, 0.5, 0.18], [0.5, 0.8, -HZ + 0.52], '#f2c36b').rotation.z = 0.05
  box(root, [0.5, 0.12, 1.0], [2.45, 0.92, -HZ + 0.8], '#6f84a8') // throw over the arm
  solid(-1.6, 2.6, -HZ, -HZ + 1.45)

  // TV on a low cabinet (left wall) with a blue LED backlight
  box(root, [0.8, 0.65, 2.4], [-HX + 0.4, 0, -1.7], OAK)
  ;[-2.3, -1.1].forEach(z => box(root, [0.04, 0.45, 1.0], [-HX + 0.82, 0.1, z], '#e6bd7c'))
  box(root, [0.1, 1.25, 2.0], [-HX + 0.35, 0.65, -1.7], '#1d1f27')
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.85, 1.1),
    new THREE.MeshBasicMaterial({ map: tvTexture(), toneMapped: false })
  )
  screen.rotation.y = Math.PI / 2
  screen.position.set(-HX + 0.42, 1.3, -1.7)
  screen.userData.keep = true
  root.add(screen)
  box(root, [0.04, 1.5, 0.05], [-HX + 0.05, 0.7, -2.85], '#cfe0ff', { emissive: '#7f9cff', emissiveIntensity: 2.4 })
  box(root, [0.04, 1.5, 0.05], [-HX + 0.05, 0.7, -0.55], '#cfe0ff', { emissive: '#7f9cff', emissiveIntensity: 2.4 })
  glow(root, [-HX + 0.9, 1.3, -1.7], '#7fb0ff', 3.4, 0.4)
  box(root, [0.3, 0.2, 0.4], [-HX + 0.4, 0.65, -0.9], '#e8d9a0')
  solid(-HX, -HX + 0.85, -2.95, -0.45)
  frames.push(makeFrame(walls.left, 1.6, 1.1, [-HX + 0.03, 3.5, -1.7], Math.PI / 2, 2))

  // tall bookshelf in the back-left corner
  box(root, [1.4, 3.6, 0.1], [-4.6, 0, -HZ + 0.05], DARK)
  box(root, [0.08, 3.6, 0.5], [-5.3, 0, -HZ + 0.25], DARK)
  box(root, [0.08, 3.6, 0.5], [-3.9, 0, -HZ + 0.25], DARK)
  ;[0.0, 0.9, 1.8, 2.7, 3.55].forEach(y => box(root, [1.4, 0.07, 0.5], [-4.6, y, -HZ + 0.25], DARK))
  ;[0.97, 1.87].forEach((y, i) => bookRow(root, 'x', -5.2, -4.0, y, -HZ + 0.25, 21 + i * 4, 0.7))
  box(root, [0.5, 0.4, 0.35], [-5.0, 2.77, -HZ + 0.25], '#f2efe6')
  cyl(root, 0.15, 0.4, [-4.2, 2.77, -HZ + 0.25], '#4a8f96', {}, 12)
  sphere(root, 0.2, [-4.2, 3.3, -HZ + 0.25], '#5fae7a')
  box(root, [0.35, 0.35, 0.35], [-4.7, 0.07, -HZ + 0.25], '#e8a63c')
  solid(-5.35, -3.85, -HZ, -HZ + 0.55)

  // rug with a border + coffee table with books and a plant
  box(root, [4.0, 0.03, 2.6], [0.0, 0, 0.9], '#a9a090')
  box(root, [3.5, 0.04, 2.1], [0.0, 0, 0.9], '#c7c0b0')
  box(root, [2.8, 0.05, 0.1], [0.0, 0, 0.9], '#9aa8c8')
  box(root, [1.5, 0.5, 0.9], [0.0, 0, 0.9], OAK)
  cyl(root, 0.12, 0.2, [-0.4, 0.5, 0.9], '#f2efe6', {}, 12)
  box(root, [0.5, 0.07, 0.38], [0.25, 0.5, 0.9], '#3f78b8')
  box(root, [0.45, 0.07, 0.34], [0.25, 0.57, 0.9], '#e8a63c')
  cyl(root, 0.1, 0.12, [0.25, 0.64, 0.9], '#d9d2c4', {}, 10)
  sphere(root, 0.13, [0.25, 0.85, 0.9], '#5fae7a')
  solid(-0.85, 0.85, 0.4, 1.4)
  box(root, [1.0, 0.18, 1.0], [-2.4, 0, 1.9], '#4a8f96').rotation.y = 0.5
  box(root, [1.0, 0.18, 1.0], [2.0, 0, 2.2], '#f2c36b').rotation.y = -0.4

  plant(root, 3.1, -3.0, 1.0)
  solid(2.7, 3.5, -3.4, -2.6)
  plant(root, -4.5, 3.0, 0.8, '#e8a06a')

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
