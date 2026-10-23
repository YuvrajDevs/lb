import * as THREE from 'three'
import { H, HZ, box, cyl, sphere, makeFrame } from '../kit.js'
import { makeShell } from '../shell.js'
import { lampFx, glow } from '../fx.js'
import { plant } from './plants.js'

const CAB = '#d9c9a6'
const OAK = '#d9a763'
const LED = { emissive: '#ffd9a0', emissiveIntensity: 2.2 }

export function buildKitchen() {
  const sh = makeShell({
    name: 'kitchen', wall: '#efe6c9', wainscot: '#d4c48c', curtain: '#e0a458', cove: '#ffd9a0',
    floorColor: '#d1b48a', doorR: [0.9, 2.9], win: [-3.2, -0.4], skyKind: 0, frameKinds: [4, 1, 3],
    facade: { windows: [-3.2, 3.2] },
  })
  const { root, walls, solid, frames } = sh

  // counter along the back wall (sink under the window)
  box(root, [6.4, 1.75, 1.0], [-2.2, 0, -HZ + 0.5], CAB)
  box(root, [6.6, 0.12, 1.1], [-2.2, 1.75, -HZ + 0.55], '#f1eee6')
  box(root, [1.3, 0.05, 0.7], [-1.8, 1.86, -HZ + 0.55], '#a7b0b8')
  cyl(root, 0.04, 0.45, [-1.8, 1.87, -HZ + 0.2], '#b9c0c6', {}, 8)
  ;[-4.3, -4.0].forEach(x => cyl(root, 0.2, 0.03, [x, 1.88, -HZ + 0.55], '#33353e', {}, 16))
  ;[-4.9, -3.6, -2.3, -1.0, 0.3].forEach(x => {
    box(root, [1.1, 1.3, 0.04], [x, 0.2, -HZ + 1.02], '#eadbb6')
    box(root, [0.3, 0.05, 0.06], [x, 1.25, -HZ + 1.07], '#8a6a4a')
  })
  solid(-5.4, 1.15, -HZ, -HZ + 1.15)

  // upper cabinets with warm under-cabinet LEDs
  ;[[-4.5, 1.8], [0.6, 1.7]].forEach(([x, w]) => {
    box(root, [w, 1.3, 0.55], [x, 2.8, -HZ + 0.28], CAB)
    box(root, [w - 0.15, 1.1, 0.04], [x, 2.9, -HZ + 0.57], '#eadbb6')
    box(root, [w - 0.2, 0.04, 0.04], [x, 2.76, -HZ + 0.45], '#fff3d8', LED)
    glow(root, [x, 2.65, -HZ + 0.6], '#ffd9a0', w + 1.0, 0.28)
  })

  // things on the counter: kettle, toaster, herbs, cutting board, cookbooks
  cyl(root, 0.2, 0.3, [-4.65, 1.87, -HZ + 0.4], '#c9ced3', {}, 14)
  sphere(root, 0.1, [-4.65, 2.2, -HZ + 0.4], '#2f3138')
  box(root, [0.6, 0.4, 0.4], [-0.1, 1.87, -HZ + 0.5], '#d9654a')
  box(root, [0.7, 0.05, 0.45], [0.7, 1.87, -HZ + 0.7], '#c89a5e')
  ;[-3.1, -2.7].forEach((x, i) => {
    cyl(root, 0.12, 0.16, [x, 1.87, -HZ + 0.25], '#e9e4d6', {}, 10)
    sphere(root, 0.15, [x, 2.15, -HZ + 0.25], i ? '#5fae7a' : '#4f9a6a')
  })
  box(root, [0.4, 0.1, 0.3], [-0.9, 1.87, -HZ + 0.8], '#3f78b8')
  box(root, [0.4, 0.1, 0.3], [-0.9, 1.97, -HZ + 0.8], '#e8a63c')

  // fridge with magnets
  box(root, [1.3, 3.4, 1.0], [2.2, 0, -HZ + 0.5], '#e8eef0')
  box(root, [1.26, 0.04, 0.04], [2.2, 1.7, -HZ + 1.02], '#a9b4b8')
  box(root, [0.06, 0.8, 0.06], [2.7, 2.0, -HZ + 1.06], '#8f9a9e')
  ;[['#e8566e', 2.5], ['#f2d14a', 2.8], ['#5aa7e8', 3.1]].forEach(([c, y], i) => box(root, [0.16, 0.16, 0.03], [1.8 + i * 0.25, y, -HZ + 1.03], c))
  box(root, [0.6, 0.4, 0.5], [2.2, 3.4, -HZ + 0.5], '#d9a763')
  solid(1.5, 2.9, -HZ, -HZ + 1.05)

  // round table with four stools, a round rug, a fruit bowl and tea
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.03, 40), new THREE.MeshStandardMaterial({ color: '#c9a07a', roughness: 1 }))
  rug.position.set(-0.6, 0.016, 0.6)
  rug.userData.keep = true
  root.add(rug)
  const rugRing = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.04, 40), new THREE.MeshStandardMaterial({ color: '#e6cba4', roughness: 1 }))
  rugRing.position.set(-0.6, 0.02, 0.6)
  rugRing.userData.keep = true
  root.add(rugRing)
  cyl(root, 1.1, 0.1, [-0.6, 0.95, 0.6], OAK, {}, 36)
  cyl(root, 0.12, 0.95, [-0.6, 0, 0.6], '#b9894b', {}, 10)
  cyl(root, 0.5, 0.06, [-0.6, 0, 0.6], '#b9894b', {}, 16)
  ;[[-1.9, 0.6], [0.7, 0.8], [-0.7, 1.9], [-0.4, -0.7]].forEach(([x, z], i) => {
    cyl(root, 0.33, 0.62, [x, 0, z], i % 2 ? '#e0a458' : '#4aa3a8', {}, 18)
    cyl(root, 0.35, 0.06, [x, 0.62, z], i % 2 ? '#f0b86a' : '#5fb6bb', {}, 18)
  })
  cyl(root, 0.3, 0.14, [-0.3, 1.05, 0.9], '#f2efe6', {}, 18)
  ;[[-0.4, 0.95], [-0.2, 0.85], [-0.25, 1.0]].forEach(([x, z], i) => sphere(root, 0.1, [x, 1.26, z], ['#e8566e', '#f08a2a', '#f2d14a'][i]))
  cyl(root, 0.2, 0.28, [-1.0, 1.05, 0.3], '#5a7aa6', {}, 14)
  cyl(root, 0.09, 0.1, [-0.7, 1.05, 0.1], '#f2efe6', {}, 12)
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

  // wall shelf with jars on the left wall, a poster, a plant by the door
  ;[2.6, 3.4].forEach(y => box(root, [0.4, 0.07, 2.6], [-5.2, y, 0.5], OAK))
  ;[-0.6, 0.0, 0.6, 1.2].forEach((dz, i) => {
    cyl(root, 0.15, 0.36, [-5.15, 2.67, 0.5 + dz], '#eef2ee', { transparent: true, opacity: 0.85 }, 12)
    cyl(root, 0.16, 0.07, [-5.15, 3.03, 0.5 + dz], ['#e8a63c', '#d9654a', '#7bb26a', '#5aa7e8'][i], {}, 12)
  })
  cyl(root, 0.1, 0.14, [-5.15, 3.47, -0.4], '#d9654a', {}, 10)
  sphere(root, 0.17, [-5.15, 3.72, -0.4], '#4f9a6a')
  box(root, [0.18, 0.28, 0.18], [-5.15, 3.47, 0.8], '#e0a458')
  box(root, [0.18, 0.22, 0.18], [-5.15, 3.47, 1.1], '#f2efe6')
  frames.push(makeFrame(walls.back, 1.0, 1.4, [4.6, 3.4, -HZ + 0.03], 0, 2))
  plant(root, 4.6, 2.3, 0.9)
  solid(4.2, 5.0, 1.9, 2.7)
  return sh
}
