import * as THREE from 'three'
import { HX, HZ, box, cyl, sphere, makeFrame, bookRow } from '../kit.js'
import { makeShell } from '../shell.js'
import { lampFx, glow } from '../fx.js'
import { plant } from './plants.js'

const WOOD = '#d2a97a'
const DARK = '#9a7248'
const CORAL = '#e8705f'
const TEAL = '#4aa3a8'

export function buildStudy() {
  const sh = makeShell({
    name: 'study', wall: '#d8e0d4', wainscot: '#aab8a8', curtain: '#7f9c92', cove: '#8fe0d0',
    floorColor: '#a9794c', doorR: [0.9, 2.9], win: [-2.2, 0.6], frameKinds: [0, 3, 2], skyKind: 0,
    facade: { windows: [-3.2, 3.2] },
  })
  const { root, walls, solid, frames } = sh

  // desk under the window, with a mat, laptop, mug, plant and book stack
  box(root, [3.8, 0.12, 1.4], [-0.8, 1.7, -HZ + 0.7], WOOD)
  box(root, [0.12, 1.7, 1.3], [-2.64, 0, -HZ + 0.7], WOOD)
  box(root, [0.12, 1.7, 1.3], [1.04, 0, -HZ + 0.7], WOOD)
  box(root, [3.6, 0.08, 0.1], [-0.8, 1.32, -HZ + 0.1], DARK) // modesty rail
  box(root, [1.5, 0.02, 0.75], [-0.35, 1.82, -HZ + 0.85], '#3a3d4a')
  solid(-2.75, 1.15, -HZ, -HZ + 1.45)

  box(root, [0.85, 0.04, 0.58], [-0.3, 1.84, -HZ + 0.85], '#cfd3d9')
  const screen = box(root, [0.85, 0.55, 0.04], [-0.3, 1.88, -HZ + 0.57], '#2c2f38')
  screen.rotation.x = -0.18
  const glowScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.75, 0.46),
    new THREE.MeshBasicMaterial({ color: '#a9d0ff', toneMapped: false })
  )
  glowScreen.position.set(-0.3, 2.16, -HZ + 0.61)
  glowScreen.rotation.x = -0.18
  glowScreen.userData.keep = true
  root.add(glowScreen)
  glow(root, [-0.3, 2.1, -HZ + 0.95], '#7fb0ff', 2.0, 0.35)
  cyl(root, 0.1, 0.18, [0.55, 1.84, -HZ + 0.95], '#f2efe8', {}, 12)
  box(root, [0.5, 0.1, 0.36], [0.65, 1.84, -HZ + 0.3], CORAL).rotation.y = 0.3
  box(root, [0.45, 0.1, 0.32], [0.65, 1.94, -HZ + 0.3], TEAL).rotation.y = -0.2
  cyl(root, 0.13, 0.16, [0.8, 1.84, -HZ + 0.95], '#d9d2c4', {}, 10)
  sphere(root, 0.16, [0.8, 2.12, -HZ + 0.95], '#5fae7a')

  // desk lamp = this room's main light
  cyl(root, 0.22, 0.05, [-1.95, 1.84, -HZ + 0.75], '#2f3138', {}, 16)
  box(root, [0.05, 0.85, 0.05], [-1.95, 1.87, -HZ + 0.75], '#2f3138').rotation.z = -0.2
  const shade = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#ffb35c', emissive: '#ffa040', emissiveIntensity: 1.7 })
  )
  shade.position.set(-1.78, 2.7, -HZ + 0.75)
  shade.userData.keep = true
  root.add(shade)
  lampFx(root, [-1.78, 2.68, -HZ + 0.75], [-1.6, 0, -1.0], '#ffb35c', { size: 2.6, poolR: 2.6, coneH: 0.85, coneR: 0.7 })
  const light = new THREE.PointLight('#ffb35c', 34, 9, 2)
  light.position.set(-1.78, 2.5, -HZ + 1.0)
  root.add(light)

  // chair
  const chair = new THREE.Group()
  chair.position.set(-0.9, 0, -1.9)
  chair.rotation.y = 0.15
  cyl(chair, 0.06, 0.8, [0, 0.05, 0], '#2f3138', {}, 8)
  cyl(chair, 0.4, 0.06, [0, 0, 0], '#2f3138', {}, 16)
  box(chair, [0.95, 0.14, 0.9], [0, 0.85, 0], CORAL)
  box(chair, [0.95, 0.7, 0.1], [0, 1.0, 0.45], CORAL)
  root.add(chair)
  solid(-1.5, -0.3, -2.45, -1.35)

  // pinboard with notes, left of the window
  box(root, [1.8, 1.2, 0.05], [-4.3, 2.0, -HZ + 0.03], '#c9955f')
  box(root, [1.9, 0.06, 0.07], [-4.3, 3.2, -HZ + 0.03], DARK)
  box(root, [1.9, 0.06, 0.07], [-4.3, 1.94, -HZ + 0.03], DARK)
  ;[[-4.85, 2.7, '#f6e58d'], [-4.45, 2.35, '#f4a6b8'], [-4.05, 2.75, '#a8d8f0'], [-3.8, 2.3, '#b8e6a8'], [-4.65, 2.2, '#ffffff']].forEach(([x, y, c], i) =>
    box(root, [0.32, 0.32, 0.03], [x, y, -HZ + 0.07], c).rotation.z = (i - 2) * 0.08)

  // wall shelves with books and a little decor
  ;[3.0, 3.85].forEach((y, i) => {
    box(root, [2.2, 0.08, 0.4], [3.3, y, -HZ + 0.2], DARK)
    bookRow(root, 'x', 2.35, 3.7, y + 0.08, -HZ + 0.25, 4 + i * 5, 0.55)
  })
  box(root, [0.3, 0.3, 0.3], [4.1, 3.08, -HZ + 0.25], CORAL)
  cyl(root, 0.12, 0.28, [4.1, 3.93, -HZ + 0.25], TEAL, {}, 10)
  frames.push(
    makeFrame(walls.back, 0.9, 1.2, [0.95, 3.45, -HZ + 0.03], 0, 1),
    makeFrame(walls.right, 1.5, 1.1, [HX - 0.03, 3.3, -2.0], -Math.PI / 2, 4)
  )

  // bookcase on the left wall + a round wall clock
  ;[0.0, 0.8, 1.6, 2.4].forEach(y => box(root, [0.5, 0.06, 2.2], [-HX + 0.3, y, -0.3], DARK))
  box(root, [0.5, 2.5, 0.06], [-HX + 0.3, 0, -1.4], DARK)
  box(root, [0.5, 2.5, 0.06], [-HX + 0.3, 0, 0.8], DARK)
  ;[0.12, 0.92, 1.72].forEach((y, i) => bookRow(root, 'z', -1.25, 0.7, y + 0.06, -HX + 0.3, 11 + i * 3, 0.6))
  box(root, [0.3, 0.3, 0.3], [-HX + 0.3, 2.46, 0.3], TEAL)
  solid(-HX, -HX + 0.6, -1.5, 0.9)
  cyl(root, 0.42, 0.06, [-HX + 0.05, 3.55, -0.3], '#f6f1e6', {}, 24).rotation.z = Math.PI / 2
  box(root, [0.04, 0.3, 0.04], [-HX + 0.1, 3.55, -0.3], '#2f3138')
  box(root, [0.04, 0.04, 0.22], [-HX + 0.1, 3.55, -0.2], '#2f3138')

  // rug with a border, a beanbag, plants
  box(root, [4.4, 0.03, 2.8], [1.2, 0, 1.0], '#5e7a98')
  box(root, [3.8, 0.04, 2.2], [1.2, 0, 1.0], '#7f9bb8')
  box(root, [3.2, 0.05, 0.12], [1.2, 0, 1.0], '#e8c98a')
  box(root, [1.2, 0.5, 1.2], [3.5, 0, 1.4], TEAL).rotation.y = 0.35
  box(root, [1.0, 0.18, 1.0], [3.5, 0.5, 1.4], '#5fb6bb').rotation.y = 0.35
  solid(2.8, 4.2, 0.7, 2.1)
  plant(root, 4.6, -3.0, 0.95)
  solid(4.2, 5.0, -3.4, -2.6)
  plant(root, -4.5, 2.7, 0.8, '#e8a06a')
  solid(-4.9, -4.1, 2.3, 3.1)
  return sh
}
