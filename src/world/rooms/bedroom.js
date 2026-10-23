import * as THREE from 'three'
import { H, HX, HZ, box, cyl, sphere, woodMat, makeFrame } from '../kit.js'
import { makeShell } from '../shell.js'
import { plant, railing } from './plants.js'

export const STAIR_HOLE = { x0: 3.9, x1: HX, z0: -1.0, z1: 1.4 }

export function buildBedroom() {
  const sh = makeShell({
    name: 'bedroom', wall: '#f0d6bb', doorL: [0.9, 2.9], win: [-1.0, 1.8],
    curtain: ['#e86f9a', '#ffd9e4'], holeFloor: STAIR_HOLE, ceilWood: '#c49a62', skyKind: 1, frameKinds: [1, 4, 0],
  })
  const { root, walls, ceiling, solid, frames } = sh
  const wood = '#c79a5c'

  // low bed (futon on a platform), head against the back wall
  box(root, [2.8, 0.28, 5.0], [-1.7, 0, -1.1], woodMat(wood, 2, 3, { dark: 0.04, vertical: false }))
  box(root, [2.5, 0.3, 4.7], [-1.7, 0.28, -1.1], '#f4ede2')
  box(root, [2.56, 0.2, 3.2], [-1.7, 0.58, -0.35], '#f3b7c7')
  box(root, [2.58, 0.21, 0.5], [-1.7, 0.58, -1.3], '#e98fab')
  box(root, [2.9, 1.1, 0.2], [-1.7, 0.28, -HZ + 0.1], wood)
  ;[-2.3, -1.1].forEach(x => box(root, [1.0, 0.25, 0.7], [x, 0.58, -3.0], '#fffaf0'))
  // plush bear
  sphere(root, 0.3, [-0.9, 0.95, 0.4], '#e8b48a')
  sphere(root, 0.22, [-0.9, 1.35, 0.4], '#e8b48a')
  sphere(root, 0.09, [-1.05, 1.52, 0.4], '#d49a70')
  sphere(root, 0.09, [-0.75, 1.52, 0.4], '#d49a70')
  solid(-3.15, -0.25, -HZ, 1.45)

  // bedside table + paper lamp
  box(root, [0.9, 0.75, 0.9], [0.25, 0, -3.05], wood)
  cyl(root, 0.1, 0.08, [0.25, 0.75, -3.05], '#3a3a42', {}, 12)
  const lampMat = new THREE.MeshStandardMaterial({ color: '#ffe2c4', emissive: '#ffa868', emissiveIntensity: 1.8 })
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), lampMat)
  lamp.position.set(0.25, 1.15, -3.05)
  root.add(lamp)
  box(root, [0.45, 0.04, 0.3], [0.25, 0.77, -2.7], '#9fc9e2')
  solid(-0.25, 0.75, -HZ, -2.55)

  // wardrobe on the back wall, right
  box(root, [2.8, 4.1, 1.0], [3.95 - 0.1, 0, -HZ + 0.5], woodMat('#d4a468', 2, 3, { dark: 0.04, vertical: true }))
  ;[2.95, 4.15].forEach(x => box(root, [1.15, 3.7, 0.05], [x - 0.1, 0.2, -HZ + 1.02], '#f1e6cf'))
  ;[3.45, 3.65].forEach(x => box(root, [0.05, 0.5, 0.06], [x - 0.1, 1.8, -HZ + 1.06], '#6b4a30'))
  box(root, [2.4, 0.45, 0.8], [3.85, 4.1, -HZ + 0.5], '#e0d3b0')
  solid(2.5, HX, -HZ, -HZ + 1.05)

  // low shelf on the left wall + plants
  box(root, [0.8, 1.5, 2.2], [-HX + 0.4, 0, -2.3], wood)
  ;[0.55, 1.05].forEach(y => box(root, [0.7, 0.05, 2.1], [-HX + 0.45, y, -2.3], '#e6bd7c'))
  box(root, [0.5, 0.3, 0.8], [-HX + 0.4, 1.5, -2.8], '#3f78b8')
  box(root, [0.45, 0.25, 0.7], [-HX + 0.4, 1.5, -1.8], '#e8d9a0')
  solid(-HX, -HX + 0.85, -3.45, -1.15)
  plant(root, -4.55, -0.45, 1.0)
  solid(-4.95, -4.15, -0.85, -0.05)
  plant(root, 4.3, -3.0, 0.7, '#e8a63c')

  // round rug + floor cushions
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.03, 48), new THREE.MeshStandardMaterial({ color: '#e8a0b8', roughness: 1 }))
  rug.position.set(1.4, 0.015, 0.9)
  rug.receiveShadow = true
  root.add(rug)
  box(root, [1.1, 0.16, 1.1], [-0.8, 0, 2.5], '#fff0d8').rotation.y = 0.4
  box(root, [1.1, 0.16, 1.1], [2.0, 0, 1.4], '#8ec9d4').rotation.y = -0.5
  box(root, [0.5, 0.03, 0.4], [1.0, 0.01, 2.6], '#f4c7a3').rotation.y = 0.7

  // poster above the bed
  frames.push(makeFrame(walls.back, 1.5, 1.1, [-1.7, 3.7, -HZ + 0.03], 0, 2))

  // railing around the stairwell opening
  railing(root, 3.9, -1.0, 3.9, 1.4)
  railing(root, 3.9, -1.0, HX - 0.05, -1.0)
  railing(root, 3.9, 1.4, HX - 0.05, 1.4)

  // paper-lantern pendant
  const cord = cyl(ceiling, 0.015, 0.9, [0.2, H - 0.9, 0.0], '#3a3a3a', {}, 6)
  cord.castShadow = false
  const lantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 22, 16),
    new THREE.MeshStandardMaterial({ color: '#ffe5cc', emissive: '#ffb98a', emissiveIntensity: 1.5, roughness: 0.7 })
  )
  lantern.scale.y = 0.85
  lantern.position.set(0.2, H - 1.5, 0.0)
  ceiling.add(lantern)

  const pendant = new THREE.PointLight('#ffb88a', 62, 10, 2)
  pendant.position.set(0.2, H - 1.5, 0.0)
  const bedLamp = new THREE.PointLight('#ff9a60', 24, 7, 2)
  bedLamp.position.set(0.3, 1.5, -2.8)
  const fill = new THREE.PointLight('#ffd9b0', 10, 9, 2)
  fill.position.set(-2.5, 2.8, 2.6)
  root.add(pendant, bedLamp, fill)
  return sh
}
