import * as THREE from 'three'
import { H, HX, HZ, box, cyl, sphere, woodMat, makeFrame, tvTexture } from '../kit.js'
import { makeShell } from '../shell.js'
import { plant } from './plants.js'
import { STAIR_HOLE } from './bedroom.js'

export const STAIR = { x: 4.6, zFoot: 3.0, zTop: -1.0, zStart: 2.3, steps: 14 }

export function buildLiving(riseTo) {
  const sh = makeShell({
    name: 'living room', wall: '#efe0b4', doorL: [0.9, 2.9], win: [-1.0, 2.0],
    curtain: ['#e0a23a', '#fff0cf'], holeCeil: STAIR_HOLE, ceilWood: '#b98a50', skyKind: 1, frameKinds: [3, 0, 4],
  })
  const { root, walls, ceiling, solid, frames } = sh

  // ---------- stairs along the right wall (steep, blocky, goes up through the opening) ----------
  const run = (STAIR.zStart - STAIR.zTop) / STAIR.steps
  const stairWood = [woodMat('#cf9a58', 1, 1, { dark: 0.04 }), woodMat('#dcab62', 1, 1, { dark: 0.04 })]
  for (let i = 0; i < STAIR.steps; i++) {
    const h = ((i + 1) * riseTo) / STAIR.steps
    box(root, [1.4, h, run + 0.01], [STAIR.x, 0, STAIR.zStart - (i + 0.5) * run], stairWood[i % 2])
  }
  const L = Math.hypot(riseTo, STAIR.zStart - STAIR.zTop)
  const rail = box(root, [0.08, 0.08, L], [3.85, riseTo / 2 + 1.0, (STAIR.zStart + STAIR.zTop) / 2], '#6a4630')
  rail.rotation.x = Math.atan2(riseTo, STAIR.zStart - STAIR.zTop)
  for (let i = 0; i < 5; i++) {
    const f = i / 4
    const z = STAIR.zStart - f * (STAIR.zStart - STAIR.zTop)
    const hh = f * riseTo
    box(root, [0.07, 1.0, 0.07], [3.85, hh, z], '#6a4630')
  }
  solid(3.8, HX, STAIR.zTop, STAIR.zStart + 0.15)

  // ---------- sofa under the window ----------
  const sofa = '#c9684a'
  box(root, [3.8, 0.55, 1.5], [0.5, 0, -HZ + 0.75], sofa)
  box(root, [3.8, 0.95, 0.4], [0.5, 0.55, -HZ + 0.2], '#b85a3e')
  ;[-1.6, 2.6].forEach(x => box(root, [0.4, 0.95, 1.5], [x, 0, -HZ + 0.75], '#b85a3e'))
  ;[-0.65, 0.5, 1.65].forEach(x => box(root, [1.05, 0.25, 1.1], [x, 0.55, -HZ + 0.95], '#d9805f'))
  box(root, [0.7, 0.55, 0.2], [-1.0, 0.8, -HZ + 0.6], '#f2e8d0').rotation.z = 0.15
  box(root, [0.7, 0.55, 0.2], [2.0, 0.8, -HZ + 0.6], '#2fb0c4').rotation.z = -0.15
  box(root, [0.6, 0.5, 0.2], [0.4, 0.82, -HZ + 0.55], '#e8a63c').rotation.z = 0.05
  solid(-1.75, 2.85, -HZ, -HZ + 1.55)

  // ---------- TV on a low cabinet (left wall) ----------
  box(root, [0.9, 0.7, 2.6], [-HX + 0.45, 0, -2.3], woodMat('#d4a468', 1, 1, { dark: 0.04, vertical: false }))
  ;[-3.0, -1.6].forEach(z => box(root, [0.04, 0.5, 1.1], [-HX + 0.92, 0.1, z], '#e6bd7c'))
  box(root, [0.12, 1.3, 2.1], [-HX + 0.4, 0.7, -2.3], '#1d1d24')
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.95, 1.15),
    new THREE.MeshStandardMaterial({ map: tvTexture(), emissive: '#ffffff', emissiveMap: tvTexture(), emissiveIntensity: 0.9 })
  )
  screen.rotation.y = Math.PI / 2
  screen.position.set(-HX + 0.47, 1.35, -2.3)
  root.add(screen)
  solid(-HX, -HX + 0.95, -3.65, -0.95)
  frames.push(makeFrame(walls.left, 1.8, 1.2, [-HX + 0.03, 3.7, -2.3], Math.PI / 2, 2))

  // ---------- coffee table, rug, cushions, plants, lamp ----------
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.03, 48), new THREE.MeshStandardMaterial({ color: '#86a894', roughness: 1 }))
  rug.position.set(-0.2, 0.016, 0.7)
  rug.receiveShadow = true
  root.add(rug)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 6, 48), new THREE.MeshStandardMaterial({ color: '#f2e8d0', roughness: 1 }))
  ring.rotation.x = Math.PI / 2
  ring.position.set(-0.2, 0.04, 0.7)
  root.add(ring)
  box(root, [1.8, 0.55, 1.0], [-0.2, 0, 0.7], woodMat('#d9a763', 1, 1, { dark: 0.04, vertical: false }))
  cyl(root, 0.13, 0.22, [-0.6, 0.55, 0.7], '#f2efe6', {}, 14)
  box(root, [0.5, 0.05, 0.4], [0.2, 0.55, 0.8], '#e8d9a0').rotation.y = 0.3
  sphere(root, 0.16, [0.2, 0.7, 0.8], '#e8566e')
  solid(-1.15, 0.75, 0.15, 1.25)
  box(root, [1.1, 0.16, 1.1], [-2.4, 0, 1.8], '#2fb0c4').rotation.y = 0.5
  box(root, [1.1, 0.16, 1.1], [1.8, 0, 2.3], '#e8a63c').rotation.y = -0.4

  plant(root, 3.0, -2.9, 1.0)
  solid(2.6, 3.4, -3.3, -2.5)
  plant(root, -4.6, 0.0, 0.8, '#7bb26a')
  solid(-5.0, -4.2, -0.35, 0.35)

  cyl(root, 0.25, 0.07, [-2.45, 0, -3.0], '#3a3a42', {}, 16)
  cyl(root, 0.035, 2.6, [-2.45, 0.05, -3.0], '#3a3a42', {}, 8)
  const lampShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.45, 0.65, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffc46a', emissiveIntensity: 1.7, side: THREE.DoubleSide })
  )
  lampShade.position.set(-2.45, 2.9, -3.0)
  root.add(lampShade)
  solid(-2.8, -2.1, -3.45, -2.55)

  // ---------- round paper pendant ----------
  cyl(ceiling, 0.015, 0.9, [0.2, H - 0.9, 0.4], '#3a3a3a', {}, 6)
  const paper = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 22, 16),
    new THREE.MeshStandardMaterial({ color: '#fff3dc', emissive: '#ffd08e', emissiveIntensity: 1.5, roughness: 0.7 })
  )
  paper.position.set(0.2, H - 1.5, 0.4)
  ceiling.add(paper)

  const pendant = new THREE.PointLight('#ffc98a', 62, 10, 2)
  pendant.position.set(0.2, H - 1.5, 0.4)
  const floorLamp = new THREE.PointLight('#ffb85a', 28, 8, 2)
  floorLamp.position.set(-2.45, 3.2, -2.7)
  const tvGlow = new THREE.PointLight('#8fc8ff', 6, 5, 2)
  tvGlow.position.set(-3.9, 1.4, -2.3)
  const fill = new THREE.PointLight('#ffd9b0', 9, 9, 2)
  fill.position.set(2.0, 2.8, 2.6)
  root.add(pendant, floorLamp, tvGlow, fill)
  return sh
}
