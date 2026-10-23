import * as THREE from 'three'
import {
  H, HX, HZ, box, cyl, sphere, woodMat, makeFrame, bookRow, calendarTexture,
} from '../kit.js'
import { makeShell } from '../shell.js'

const DARK = '#6a4630'

export function buildStudy() {
  const sh = makeShell({
    name: 'study', wall: '#e9d9a4', doorR: [0.9, 2.9], win: [-2.2, 0.6],
    curtain: ['#2f9a52', '#bfe3b8'], frameKinds: [0, 3, 2],
  })
  const { root, walls, ceiling, solid, frames } = sh
  const wood = '#d9a763'

  // posters / calendar on the back wall, right of the window
  frames.push(
    makeFrame(walls.back, 0.95, 1.3, [2.6, 3.9, -HZ + 0.03], 0, 1),
    makeFrame(walls.back, 0.95, 1.3, [3.8, 3.9, -HZ + 0.03], 0, 4)
  )
  const cal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.75),
    new THREE.MeshStandardMaterial({ map: calendarTexture(), roughness: 0.8 })
  )
  cal.position.set(4.9, 3.0, -HZ + 0.04)
  walls.back.add(cal)

  // ---------- right wall: sliding closet doors (back part), doorway at the front ----------
  box(walls.right, [0.14, 3.7, 3.35], [HX - 0.09, 0.3, -1.85], DARK)
  ;[[-2.55, 0], [-0.95, 0.06]].forEach(([z, off], i) => {
    const x = HX - 0.2 - off
    box(walls.right, [0.07, 3.35, 1.55], [x, 0.4, z], '#f4ead3')
    box(walls.right, [0.08, 0.55, 1.55], [x - 0.005, 1.6, z], '#dd6a30')
    box(walls.right, [0.09, 3.35, 0.1], [x - 0.005, 0.4, z + (i ? -0.75 : 0.75)], DARK)
    cyl(walls.right, 0.12, 0.05, [x - 0.04, 1.3, z + (i ? -0.5 : 0.5)], '#3a2a22', {}, 16).rotation.z = Math.PI / 2
  })
  box(walls.right, [0.3, 0.95, 0.75], [HX - 0.17, 2.4, 0.2], '#3bb6cc')
  box(walls.right, [0.32, 0.4, 0.77], [HX - 0.18, 2.4, 0.2], '#2a97ad')
  box(walls.right, [0.2, 0.2, 0.55], [HX - 0.13, 3.35, 0.2], '#2c2c36')

  // pendant lamp (rectangular, like the reference)
  const pend = new THREE.Group()
  pend.position.set(0.4, 0, -0.3)
  cyl(pend, 0.015, 0.9, [0, H - 0.9, 0], '#3a3a3a', {}, 6)
  const shade = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.4, 0.9),
    new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffd38a', emissiveIntensity: 1.6, roughness: 0.6 })
  )
  shade.position.y = H - 1.1
  pend.add(shade)
  box(pend, [1.5, 0.08, 1.0], [0, H - 0.92, 0], '#e9dcba')
  ceiling.add(pend)

  // ---------- back-wall furniture ----------
  const cabMat = woodMat('#c8683a', 1, 2, { dark: 0.035, vertical: false })
  box(root, [1.5, 2.7, 1.0], [-4.55, 0, -HZ + 0.5], cabMat)
  ;[0.35, 1.05, 1.75].forEach(y => box(root, [1.3, 0.55, 0.04], [-4.55, y + 0.2, -HZ + 1.02], '#d9835a'))
  box(root, [1.2, 0.2, 0.7], [-4.55, 2.7, -HZ + 0.5], '#5ec4d6')
  box(root, [0.8, 0.5, 0.6], [-4.45, 2.9, -HZ + 0.5], '#e8e0d0')
  solid(-5.35, -3.8, -HZ, -HZ + 1.05)

  const deskTop = woodMat('#dcab62', 2, 1, { dark: 0.04, vertical: false })
  box(root, [4.0, 0.14, 1.5], [-0.7, 1.7, -HZ + 0.75], deskTop)
  box(root, [0.12, 1.7, 1.4], [-2.58, 0, -HZ + 0.75], wood)
  box(root, [1.5, 1.7, 1.45], [0.58, 0, -HZ + 0.75], wood)
  ;[0.2, 0.7, 1.2].forEach(y => {
    box(root, [1.3, 0.44, 0.04], [0.58, y + 0.05, -HZ + 1.5], '#ecc787')
    box(root, [0.4, 0.07, 0.07], [0.58, y + 0.23, -HZ + 1.55], '#6b4a30')
  })
  box(root, [3.3, 1.2, 0.1], [-1.15, 0.2, -HZ + 0.07], '#b9894b')
  solid(-2.7, 1.35, -HZ, -HZ + 1.55)

  cyl(root, 0.2, 0.05, [-2.0, 1.84, -HZ + 0.6], '#3a3a42')
  box(root, [0.05, 0.9, 0.05], [-2.0, 1.88, -HZ + 0.6], '#3a3a42').rotation.z = -0.25
  const lampShade = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#e8561e', emissive: '#ff8a2e', emissiveIntensity: 1.6, roughness: 0.5 })
  )
  lampShade.position.set(-1.78, 2.72, -HZ + 0.6)
  lampShade.rotation.z = 0.3
  root.add(lampShade)
  box(root, [0.55, 0.28, 0.4], [-1.25, 1.84, -HZ + 0.55], '#3f78b8')
  box(root, [0.5, 0.2, 0.38], [-1.25, 2.12, -HZ + 0.55], '#c0392b')
  cyl(root, 0.14, 0.32, [-0.3, 1.84, -HZ + 0.5], '#5ec4d6', {}, 14)
  ;[0, 1, 2].forEach(i => cyl(root, 0.012, 0.28 + i * 0.05, [-0.34 + i * 0.05, 2.1, -HZ + 0.5], ['#e8561e', '#f2d14a', '#3f78b8'][i], {}, 5))
  cyl(root, 0.13, 0.22, [0.2, 1.84, -HZ + 0.5], '#e9e4d6', {}, 14)
  sphere(root, 0.1, [0.62, 1.99, -HZ + 0.55], '#b96a3b')
  cyl(root, 0.2, 0.28, [0.62, 1.84, -HZ + 0.55], '#a9552c', {}, 14)
  box(root, [0.6, 0.02, 0.42], [-0.7, 1.84, -HZ + 1.05], '#f2efe6').rotation.y = 0.2
  box(root, [0.5, 0.02, 0.36], [-0.2, 1.86, -HZ + 1.15], '#fff6d8').rotation.y = -0.35
  cyl(root, 0.05, 0.1, [-0.9, 1.84, -HZ + 0.4], '#2c2c36', {}, 10)

  // chair
  const chair = new THREE.Group()
  chair.position.set(-0.7, 0, -1.7)
  chair.rotation.y = 0.12
  const teal = '#2a9fb0'
  cyl(chair, 0.07, 0.85, [0, 0.1, 0], '#33353e', {}, 10)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    box(chair, [0.62, 0.06, 0.08], [Math.sin(a) * 0.3, 0.08, Math.cos(a) * 0.3], '#33353e').rotation.y = a + Math.PI / 2
    sphere(chair, 0.07, [Math.sin(a) * 0.6, 0.07, Math.cos(a) * 0.6], '#222228')
  }
  box(chair, [1.0, 0.16, 0.95], [0, 0.88, 0], teal)
  box(chair, [0.9, 0.7, 0.12], [0, 1.1, 0.5], teal)
  box(chair, [0.1, 0.4, 0.1], [0, 0.95, 0.38], '#33353e')
  root.add(chair)
  solid(-1.3, -0.1, -2.35, -1.0)

  cyl(root, 0.3, 0.75, [1.95, 0, -HZ + 0.5], '#5ea079', {}, 18)
  cyl(root, 0.31, 0.08, [1.95, 0.5, -HZ + 0.5], '#e9efe4', {}, 18)
  solid(1.6, 2.3, -HZ, -HZ + 0.85)

  // standing lamp, back-right corner
  cyl(root, 0.28, 0.08, [4.7, 0, -HZ + 0.6], '#3a3a42', {}, 16)
  cyl(root, 0.04, 2.9, [4.7, 0.05, -HZ + 0.6], '#3a3a42', {}, 8)
  const standShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.5, 0.7, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffc46a', emissiveIntensity: 1.7, side: THREE.DoubleSide })
  )
  standShade.position.set(4.7, 3.3, -HZ + 0.6)
  root.add(standShade)
  solid(4.35, 5.05, -HZ, -HZ + 0.95)

  // ---------- left wall: tall bookshelf ----------
  const shelfMat = woodMat('#d9a763', 2, 3, { dark: 0.045, vertical: true })
  const sx0 = -HX, sd = 1.45, z0 = 0.3, z1 = 3.45
  const sx = sx0 + sd / 2
  box(root, [sd, 4.5, 0.15], [sx, 0, z0 + 0.075], shelfMat)
  box(root, [sd, 4.5, 0.15], [sx, 0, z1 - 0.075], shelfMat)
  box(root, [0.08, 4.5, z1 - z0], [sx0 + 0.04, 0, (z0 + z1) / 2], shelfMat)
  ;[0.95, 1.85, 2.75, 3.65, 4.5].forEach(y => box(root, [sd, 0.12, z1 - z0], [sx, y - 0.06, (z0 + z1) / 2], shelfMat))
  ;[1.85, 2.75, 3.65].forEach((y, i) => bookRow(root, 'z', z0 + 0.2, z1 - 0.2, y, sx0 + 0.6, 5 + i * 7))
  box(root, [0.9, 0.5, 1.1], [sx, 4.5, 1.0], '#3f78b8')
  box(root, [0.8, 0.4, 0.9], [sx, 4.5, 2.3], '#d9483b')
  box(root, [0.6, 0.35, 0.7], [sx + 0.1, 4.9, 1.0], '#f0e6d0')
  ;[z0 + 0.8, z1 - 0.8].forEach(z => {
    box(root, [0.06, 0.78, 1.25], [sx0 + sd - 0.04, 0.08, z], '#e6bd7c')
    sphere(root, 0.05, [sx0 + sd + 0.02, 0.5, z + (z < 2 ? 0.45 : -0.45)], '#5b3a22')
  })
  box(root, [0.5, 0.35, 0.6], [sx0 + 0.55, 0.95, 1.0], '#2fb0c4')
  box(root, [0.5, 0.3, 0.5], [sx0 + 0.55, 0.95, 2.6], '#e8d9a0')
  solid(-HX, -HX + sd + 0.05, z0 - 0.05, z1 + 0.05)

  // ---------- floor decor ----------
  box(root, [1.15, 0.16, 1.15], [-2.7, 0, 1.7], '#2fb0c4').rotation.y = 0.45
  box(root, [1.15, 0.16, 1.15], [2.0, 0, 2.2], '#2fb0c4').rotation.y = -0.3
  box(root, [1.7, 0.1, 1.15], [3.2, 0, 0.7], '#3aa3d9').rotation.y = 0.5
  for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) {
    const stud = cyl(root, 0.07, 0.05, [3.2 + (i - 1.5) * 0.3 * Math.cos(0.5) - (j - 2.5) * 0.24 * Math.sin(0.5), 0.1, 0.7 + (i - 1.5) * 0.3 * Math.sin(0.5) + (j - 2.5) * 0.24 * Math.cos(0.5)], '#52b8e6', {}, 8)
    stud.castShadow = false
  }
  [[-1.6, 2.4], [-0.2, 2.9], [0.9, 1.5], [1.4, 0.4], [-3.4, 0.4]].forEach(([x, z], i) => sphere(root, 0.1, [x, 0.1, z], i % 2 ? '#f2efe6' : '#e9e4d6'))
  box(root, [0.5, 0.03, 0.38], [-1.9, 0.01, 3.0], '#f4c7a3').rotation.y = 0.8
  box(root, [0.45, 0.03, 0.34], [0.5, 0.01, 3.05], '#9fd0e8').rotation.y = -0.4
  box(root, [0.4, 0.03, 0.3], [3.8, 0.01, 2.6], '#f7f0dc').rotation.y = 0.3
  cyl(root, 0.05, 1.4, [4.9, 0.1, 0.0], '#d9b36a', {}, 8).rotation.x = 0.08

  // ---------- lights ----------
  const pendant = new THREE.PointLight('#ffc57a', 70, 10, 2)
  pendant.position.set(0.4, H - 1.5, -0.3)
  const deskLamp = new THREE.PointLight('#ff9a3c', 26, 7, 2)
  deskLamp.position.set(-1.8, 2.6, -HZ + 0.9)
  const standLamp = new THREE.PointLight('#ffb25a', 32, 8, 2)
  standLamp.position.set(4.4, 3.2, -HZ + 1.0)
  const frontFill = new THREE.PointLight('#ffd9a0', 14, 8, 2)
  frontFill.position.set(-2.8, 2.8, 2.8)
  root.add(pendant, deskLamp, standLamp, frontFill)

  return sh
}
