import * as THREE from 'three'
import { HX, HZ, box, cyl, makeFrame, bookRow } from '../kit.js'
import { makeShell } from '../shell.js'
import { lampFx, glow } from '../fx.js'
import { plant } from './plants.js'

const WOOD = '#d2a97a'
const DARK = '#9a7248'

export function buildStudy() {
  const sh = makeShell({
    name: 'study', wall: '#d8e0d4', floorColor: '#a9794c', doorR: [0.9, 2.9], win: [-2.2, 0.6],
    frameKinds: [0, 3, 2], skyKind: 0,
  })
  const { root, walls, solid, frames } = sh

  // desk under the window
  box(root, [3.8, 0.12, 1.4], [-0.8, 1.7, -HZ + 0.7], WOOD)
  box(root, [0.12, 1.7, 1.3], [-2.64, 0, -HZ + 0.7], WOOD)
  box(root, [0.12, 1.7, 1.3], [1.04, 0, -HZ + 0.7], WOOD)
  solid(-2.75, 1.15, -HZ, -HZ + 1.45)

  // laptop (its screen glows)
  box(root, [0.85, 0.04, 0.58], [-0.3, 1.82, -HZ + 0.8], '#cfd3d9')
  const screen = box(root, [0.85, 0.55, 0.04], [-0.3, 1.86, -HZ + 0.52], '#2c2f38')
  screen.rotation.x = -0.18
  const glowScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.75, 0.46),
    new THREE.MeshBasicMaterial({ color: '#a9d0ff', toneMapped: false })
  )
  glowScreen.position.set(-0.3, 2.14, -HZ + 0.56)
  glowScreen.rotation.x = -0.18
  glowScreen.userData.keep = true
  root.add(glowScreen)
  glow(root, [-0.3, 2.1, -HZ + 0.9], '#7fb0ff', 1.9, 0.35)
  cyl(root, 0.1, 0.18, [0.5, 1.82, -HZ + 0.7], '#f2efe8', {}, 12)
  box(root, [0.5, 0.1, 0.36], [0.6, 1.82, -HZ + 1.0], '#e8705f').rotation.y = 0.3

  // desk lamp = this room's main light
  cyl(root, 0.22, 0.05, [-1.95, 1.82, -HZ + 0.75], '#2f3138', {}, 16)
  box(root, [0.05, 0.85, 0.05], [-1.95, 1.85, -HZ + 0.75], '#2f3138').rotation.z = -0.2
  const shade = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#ffb35c', emissive: '#ffa040', emissiveIntensity: 1.7 })
  )
  shade.position.set(-1.78, 2.68, -HZ + 0.75)
  shade.userData.keep = true
  root.add(shade)
  lampFx(root, [-1.78, 2.66, -HZ + 0.75], [-1.6, 0, -1.0], '#ffb35c', { size: 2.6, poolR: 2.6, coneH: 0.85, coneR: 0.7 })
  const light = new THREE.PointLight('#ffb35c', 34, 9, 2)
  light.position.set(-1.78, 2.5, -HZ + 1.0)
  root.add(light)

  // chair
  const chair = new THREE.Group()
  chair.position.set(-0.9, 0, -1.9)
  chair.rotation.y = 0.15
  cyl(chair, 0.06, 0.8, [0, 0.05, 0], '#2f3138', {}, 8)
  cyl(chair, 0.4, 0.06, [0, 0, 0], '#2f3138', {}, 16)
  box(chair, [0.95, 0.14, 0.9], [0, 0.85, 0], '#e8705f')
  box(chair, [0.95, 0.7, 0.1], [0, 1.0, 0.45], '#e8705f')
  root.add(chair)
  solid(-1.5, -0.3, -2.45, -1.35)

  // wall shelves with a few books
  ;[3.0, 3.9].forEach((y, i) => {
    box(root, [2.2, 0.08, 0.4], [3.3, y, -HZ + 0.2], DARK)
    bookRow(root, 'x', 2.4, 3.9, y + 0.08, -HZ + 0.25, 4 + i * 5, 0.55)
  })
  frames.push(
    makeFrame(walls.back, 0.9, 1.2, [0.9, 3.5, -HZ + 0.03], 0, 1),
    makeFrame(walls.right, 1.5, 1.1, [HX - 0.03, 3.3, -2.0], -Math.PI / 2, 4)
  )

  // low bookcase on the left wall
  box(root, [0.5, 0.06, 2.2], [-HX + 0.3, 0.0, -0.3], DARK)
  ;[0.0, 0.8, 1.6, 2.4].forEach(y => box(root, [0.5, 0.06, 2.2], [-HX + 0.3, y + 0.06, -0.3], DARK))
  box(root, [0.5, 2.5, 0.06], [-HX + 0.3, 0, -1.4], DARK)
  box(root, [0.5, 2.5, 0.06], [-HX + 0.3, 0, 0.8], DARK)
  ;[0.12, 0.92, 1.72].forEach((y, i) => bookRow(root, 'z', -1.25, 0.7, y + 0.06, -HX + 0.3, 11 + i * 3, 0.6))
  solid(-HX, -HX + 0.6, -1.5, 0.9)

  // rug + plant
  box(root, [4.0, 0.03, 2.6], [1.2, 0, 1.0], '#7a8fae')
  plant(root, 4.5, -3.0, 0.9)
  solid(4.1, 4.9, -3.4, -2.6)
  return sh
}
