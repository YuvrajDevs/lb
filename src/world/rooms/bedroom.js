import * as THREE from 'three'
import { HX, HZ, box, cyl, makeFrame } from '../kit.js'
import { makeShell } from '../shell.js'
import { lampFx } from '../fx.js'
import { plant, railing } from './plants.js'

export const STAIR_HOLE = { x0: 3.9, x1: HX, z0: -1.0, z1: 1.4 }
const BROWN = '#9b6a40'

export function buildBedroom() {
  const sh = makeShell({
    name: 'bedroom', wall: '#ecd9d6', floorColor: '#c9a273', doorL: [0.9, 2.9], win: [-1.0, 1.8],
    holeFloor: STAIR_HOLE, skyKind: 1, frameKinds: [1, 4, 0],
  })
  const { root, walls, solid, frames } = sh

  // bed: brown frame, white mattress, blue duvet
  box(root, [2.7, 0.4, 4.7], [-1.8, 0, -1.25], BROWN)
  box(root, [2.5, 0.26, 4.5], [-1.8, 0.4, -1.25], '#f1ece4')
  box(root, [2.54, 0.2, 3.1], [-1.8, 0.66, -0.55], '#3f5fb0')
  box(root, [2.58, 0.21, 0.5], [-1.8, 0.66, -1.9], '#5f84d6')
  box(root, [1.0, 0.2, 0.6], [-1.8, 0.66, -3.05], '#7f9be0')
  box(root, [2.8, 1.1, 0.15], [-1.8, 0.3, -HZ + 0.08], BROWN)
  solid(-3.2, -0.4, -HZ, 1.2)

  // bedside table with the room's lamp
  box(root, [0.8, 0.7, 0.8], [0.3, 0, -3.1], BROWN)
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
  const fill = new THREE.PointLight('#ffd0a0', 16, 7, 2) // keeps the wardrobe doors from falling into shadow
  fill.position.set(2.8, 2.6, 1.2)
  root.add(fill)
  solid(-0.15, 0.75, -HZ, -2.65)

  // wardrobe: dark frame, pale doors
  box(root, [2.6, 4.0, 0.9], [3.1, 0, -HZ + 0.45], BROWN)
  ;[2.5, 3.75].forEach(x => box(root, [1.15, 3.6, 0.05], [x - 0.0, 0.2, -HZ + 0.92], '#ecd3a0'))
  ;[3.05, 3.2].forEach(x => box(root, [0.04, 0.5, 0.06], [x + 0.0, 1.8, -HZ + 0.98], BROWN))
  solid(1.75, 4.45, -HZ, -HZ + 0.95)

  frames.push(makeFrame(walls.back, 1.4, 1.0, [-1.8, 3.5, -HZ + 0.03], 0, 2))

  // rug + plant + railing around the stairwell opening
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.03, 40), new THREE.MeshStandardMaterial({ color: '#c8a0a8', roughness: 1 }))
  rug.position.set(1.6, 0.015, 1.1)
  rug.receiveShadow = true
  rug.userData.keep = true
  root.add(rug)
  plant(root, -4.6, -0.4, 0.9)
  solid(-5.0, -4.2, -0.8, 0.0)
  railing(root, 3.9, -1.0, 3.9, 1.4)
  railing(root, 3.9, -1.0, HX - 0.05, -1.0)
  railing(root, 3.9, 1.4, HX - 0.05, 1.4)
  return sh
}
