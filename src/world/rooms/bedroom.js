import * as THREE from 'three'
import { HX, HZ, box, cyl, sphere, makeFrame } from '../kit.js'
import { makeShell } from '../shell.js'
import { lampFx, glow, wash } from '../fx.js'
import { plant, railing } from './plants.js'

export const STAIR_HOLE = { x0: 3.9, x1: HX, z0: -1.0, z1: 1.4 }
const BROWN = '#9b6a40'
const BLUE = '#3f5fb0'

export function buildBedroom() {
  const sh = makeShell({
    name: 'bedroom', wall: '#ecd9d6', wainscot: '#cfa9ad', curtain: '#c98a9a', cove: '#ff9cc4',
    floorColor: '#c9a273', doorL: [0.9, 2.9], win: [-1.0, 1.8],
    holeFloor: STAIR_HOLE, skyKind: 1, frameKinds: [1, 4, 0], facade: { windows: [-3.2, 2.4] },
  })
  const { root, walls, solid, frames } = sh

  // bed: brown frame + tall headboard, white mattress, blue duvet, pillows, a folded throw
  box(root, [2.7, 0.4, 4.7], [-1.8, 0, -1.25], BROWN)
  box(root, [2.5, 0.26, 4.5], [-1.8, 0.4, -1.25], '#f1ece4')
  box(root, [2.54, 0.2, 3.1], [-1.8, 0.66, -0.55], BLUE)
  box(root, [2.58, 0.21, 0.5], [-1.8, 0.66, -1.9], '#5f84d6')
  box(root, [1.0, 0.2, 0.6], [-2.35, 0.66, -3.05], '#fff7ee')
  box(root, [1.0, 0.2, 0.6], [-1.25, 0.66, -3.05], '#7f9be0')
  box(root, [2.55, 0.1, 0.8], [-1.8, 0.86, 0.5], '#e8a0b0')
  box(root, [2.9, 1.5, 0.15], [-1.8, 0.3, -HZ + 0.08], BROWN)
  box(root, [2.9, 0.1, 0.2], [-1.8, 1.8, -HZ + 0.1], '#7a5230')
  solid(-3.2, -0.4, -HZ, 1.2)

  // LED strip + glow behind the headboard
  box(root, [2.4, 0.05, 0.05], [-1.8, 1.9, -HZ + 0.22], '#fff0f4', { emissive: '#ff9cc4', emissiveIntensity: 2.4 })
  glow(root, [-1.8, 1.9, -HZ + 0.4], '#ff9cc4', 4.0, 0.4)
  wash(root, [-1.8, 1.2, -HZ + 0.06], 3.2, 1.4, '#ff9cc4', 0.22)

  // right nightstand with the room's main lamp
  box(root, [0.8, 0.7, 0.8], [0.3, 0, -3.1], BROWN)
  box(root, [0.6, 0.04, 0.05], [0.3, 0.45, -2.68], '#6b4a30')
  cyl(root, 0.09, 0.3, [0.3, 0.7, -3.1], '#2f3138', {}, 10)
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.32, 0.4, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: '#ffe0b8', emissive: '#ffb070', emissiveIntensity: 1.8, side: THREE.DoubleSide })
  )
  shade.position.set(0.3, 1.2, -3.1)
  shade.userData.keep = true
  root.add(shade)
  lampFx(root, [0.3, 1.2, -3.1], [-0.6, 0, -2.0], '#ffb070', { size: 2.4, poolR: 2.8, coneH: 1.0, coneR: 0.9 })
  const light = new THREE.PointLight('#ffb070', 32, 9, 2)
  light.position.set(0.3, 1.5, -2.8)
  root.add(light)
  box(root, [0.3, 0.1, 0.4], [0.5, 0.7, -2.8], '#9fc9e2')
  const fill = new THREE.PointLight('#ffd0a0', 16, 7, 2)
  fill.position.set(2.8, 2.6, 1.2)
  root.add(fill)
  solid(-0.15, 0.75, -HZ, -2.65)

  // left nightstand with a small pink lamp
  box(root, [0.7, 0.65, 0.7], [-4.0, 0, -3.2], BROWN)
  box(root, [0.18, 0.28, 0.18], [-4.0, 0.65, -3.2], '#fff0f4', { emissive: '#ff9cc4', emissiveIntensity: 1.6 })
  glow(root, [-4.0, 1.0, -3.2], '#ff9cc4', 1.6, 0.5)
  solid(-4.4, -3.6, -HZ, -2.8)

  // wardrobe: dark frame, pale doors, handles
  box(root, [2.6, 4.0, 0.9], [3.1, 0, -HZ + 0.45], BROWN)
  ;[2.5, 3.75].forEach(x => box(root, [1.15, 3.6, 0.05], [x, 0.2, -HZ + 0.92], '#ecd3a0'))
  ;[3.05, 3.2].forEach(x => box(root, [0.04, 0.5, 0.06], [x, 1.8, -HZ + 0.98], BROWN))
  box(root, [2.4, 0.3, 0.7], [3.1, 4.0, -HZ + 0.45], '#e0d3b0')
  solid(1.75, 4.45, -HZ, -HZ + 0.95)

  // dresser + mirror on the left wall
  box(root, [0.6, 1.0, 1.9], [-HX + 0.3, 0, -1.0], BROWN)
  ;[0.15, 0.55].forEach(y => box(root, [0.04, 0.32, 1.7], [-HX + 0.62, y, -1.0], '#b7845a'))
  box(root, [0.05, 1.5, 1.1], [-HX + 0.05, 1.6, -1.0], '#cfe0ee', { emissive: '#7f9cc0', emissiveIntensity: 0.35 })
  box(root, [0.08, 1.6, 1.2], [-HX + 0.04, 1.55, -1.0], '#e8dcc8')
  box(root, [0.2, 0.3, 0.2], [-HX + 0.3, 1.0, -1.5], '#f2efe6')
  box(root, [0.2, 0.2, 0.3], [-HX + 0.3, 1.0, -0.6], '#e8a0b0')
  cyl(root, 0.1, 0.18, [-HX + 0.3, 1.0, -0.1], '#d9d2c4', {}, 10)
  solid(-HX, -HX + 0.65, -1.95, -0.05)

  // three small frames above the bed
  frames.push(
    makeFrame(walls.back, 0.7, 0.9, [-2.8, 3.35, -HZ + 0.03], 0, 2),
    makeFrame(walls.back, 0.7, 0.9, [-1.8, 3.35, -HZ + 0.03], 0, 4),
    makeFrame(walls.back, 0.7, 0.9, [-0.8, 3.35, -HZ + 0.03], 0, 1)
  )

  // round rug with a ring, cushions, plants, railing around the stairwell opening
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.03, 40), new THREE.MeshStandardMaterial({ color: '#c8a0a8', roughness: 1 }))
  rug.position.set(1.6, 0.015, 1.1)
  rug.receiveShadow = true
  rug.userData.keep = true
  root.add(rug)
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.04, 40), new THREE.MeshStandardMaterial({ color: '#e6c8cc', roughness: 1 }))
  ring.position.set(1.6, 0.02, 1.1)
  ring.userData.keep = true
  root.add(ring)
  box(root, [0.9, 0.18, 0.9], [0.6, 0, 2.4], '#fff0d8').rotation.y = 0.4
  box(root, [0.9, 0.18, 0.9], [2.4, 0, 2.5], '#8ec9d4').rotation.y = -0.5
  plant(root, 4.6, 2.8, 0.9)
  solid(4.2, 5.0, 2.4, 3.2)
  sphere(root, 0.2, [0.9, 0.35, 2.4], '#f2c36b')
  railing(root, 3.9, -1.0, 3.9, 1.4)
  railing(root, 3.9, -1.0, HX - 0.05, -1.0)
  railing(root, 3.9, 1.4, HX - 0.05, 1.4)
  return sh
}
