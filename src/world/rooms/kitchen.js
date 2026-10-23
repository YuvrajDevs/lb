import * as THREE from 'three'
import { H, HZ, box, cyl, makeFrame } from '../kit.js'
import { makeShell } from '../shell.js'
import { lampFx } from '../fx.js'
import { plant } from './plants.js'

export function buildKitchen() {
  const sh = makeShell({
    name: 'kitchen', wall: '#efe6c9', floorColor: '#d1b48a', doorR: [0.9, 2.9], win: [-3.2, -0.4],
    skyKind: 0, frameKinds: [4, 1, 3],
  })
  const { root, walls, solid, frames } = sh

  // counter along the back wall (sink under the window), fridge at the end
  box(root, [6.4, 1.75, 1.0], [-2.2, 0, -HZ + 0.5], '#d9c9a6')
  box(root, [6.6, 0.12, 1.1], [-2.2, 1.75, -HZ + 0.55], '#f1eee6')
  box(root, [1.3, 0.05, 0.7], [-1.8, 1.86, -HZ + 0.55], '#a7b0b8')
  cyl(root, 0.04, 0.45, [-1.8, 1.87, -HZ + 0.2], '#b9c0c6', {}, 8)
  ;[-4.3, -4.0].forEach(x => cyl(root, 0.2, 0.03, [x, 1.88, -HZ + 0.55], '#33353e', {}, 16))
  ;[-4.9, -3.6, -2.3, -1.0, 0.3].forEach(x => box(root, [1.1, 1.3, 0.04], [x + 0.0, 0.2, -HZ + 1.02], '#eadbb6'))
  solid(-5.4, 1.15, -HZ, -HZ + 1.15)
  box(root, [1.3, 3.4, 1.0], [2.2, 0, -HZ + 0.5], '#e8eef0')
  box(root, [1.26, 0.04, 0.04], [2.2, 1.7, -HZ + 1.02], '#a9b4b8')
  box(root, [0.06, 0.8, 0.06], [2.7, 2.0, -HZ + 1.06], '#8f9a9e')
  solid(1.5, 2.9, -HZ, -HZ + 1.05)

  // round table + two stools, lit by the pendant
  cyl(root, 1.1, 0.1, [-0.6, 0.95, 0.6], '#d9a763', {}, 36)
  cyl(root, 0.12, 0.95, [-0.6, 0, 0.6], '#b9894b', {}, 10)
  cyl(root, 0.5, 0.06, [-0.6, 0, 0.6], '#b9894b', {}, 16)
  cyl(root, 0.35, 0.65, [-1.9, 0, 0.6], '#e0a458', {}, 18)
  cyl(root, 0.35, 0.65, [0.8, 0, 0.9], '#e0a458', {}, 18)
  cyl(root, 0.2, 0.28, [-0.9, 1.05, 0.4], '#5a7aa6', {}, 14)
  cyl(root, 0.1, 0.12, [-0.2, 1.05, 0.9], '#f2efe6', {}, 12)
  solid(-1.8, 0.65, -0.6, 1.8)

  // pendant = this room's main light
  const cord = cyl(root, 0.015, 1.2, [-0.6, H - 1.2, 0.6], '#33353e', {}, 6)
  cord.castShadow = false
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.62, 0.45, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffc880', emissiveIntensity: 1.8, side: THREE.DoubleSide })
  )
  shade.position.set(-0.6, H - 1.35, 0.6)
  shade.userData.keep = true
  root.add(shade)
  lampFx(root, [-0.6, H - 1.35, 0.6], [-0.6, 0, 0.6], '#ffc880', { size: 3.0, poolR: 3.4, coneH: 3.0, coneR: 1.6 })
  const light = new THREE.PointLight('#ffc880', 52, 10, 2)
  light.position.set(-0.6, H - 1.7, 0.6)
  root.add(light)

  frames.push(makeFrame(walls.back, 1.0, 1.4, [4.6, 3.4, -HZ + 0.03], 0, 2))
  plant(root, 4.6, 2.3, 0.9)
  solid(4.2, 5.0, 1.9, 2.7)
  return sh
}
