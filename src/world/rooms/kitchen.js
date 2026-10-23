import * as THREE from 'three'
import { H, HZ, box, cyl, sphere, makeFrame, stripeRug } from '../kit.js'
import { makeShell } from '../shell.js'
import { plant } from './plants.js'

export function buildKitchen() {
  const sh = makeShell({
    name: 'kitchen', wall: '#f1e2b8', doorR: [0.9, 2.9], win: [-3.2, -0.4], floor: 'wood',
    curtain: ['#d9483b', '#fff1e6'], ceilWood: '#b98a50', skyKind: 0, frameKinds: [4, 1, 3],
  })
  const { root, walls, ceiling, solid, frames } = sh
  const cab = '#c7a06a', top = '#ebe5d6'

  // counter along the back wall, with the sink under the window
  box(root, [6.55, 1.8, 1.1], [-2.075, 0, -HZ + 0.55], cab)
  ;[-4.9, -3.7, -2.5, -1.3, -0.1, 0.9].forEach(x => {
    box(root, [1.05, 1.4, 0.04], [x, 0.2, -HZ + 1.12], '#dcb37c')
    box(root, [0.3, 0.06, 0.05], [x, 1.3, -HZ + 1.16], '#6b4a30')
  })
  box(root, [6.75, 0.12, 1.2], [-2.075, 1.8, -HZ + 0.6], top)
  box(root, [1.4, 0.04, 0.8], [-1.8, 1.9, -HZ + 0.6], '#9aa3ab') // sink basin
  cyl(root, 0.04, 0.6, [-1.8, 1.92, -HZ + 0.22], '#b9c0c6', {}, 10)
  box(root, [0.05, 0.05, 0.35], [-1.8, 2.5, -HZ + 0.38], '#b9c0c6')
  // stove + hood
  box(root, [1.2, 0.08, 0.8], [-4.4, 1.92, -HZ + 0.6], '#26262c')
  ;[-0.28, 0.28].forEach(dx => cyl(root, 0.22, 0.03, [-4.4 + dx, 2.0, -HZ + 0.6], '#454550', {}, 18))
  cyl(root, 0.24, 0.4, [-4.12, 2.0, -HZ + 0.6], '#b7bec5', { metalness: 0.4, roughness: 0.4 }, 18)
  sphere(root, 0.1, [-4.12, 2.45, -HZ + 0.6], '#8a9097')
  box(root, [1.5, 0.5, 0.9], [-4.4, 3.35, -HZ + 0.55], '#c9ced3', { metalness: 0.3, roughness: 0.5 })
  box(root, [0.4, H - 3.85, 0.4], [-4.4, 3.85, -HZ + 0.4], '#c9ced3')
  // upper cabinet + under-cabinet light
  box(root, [1.7, 1.3, 0.7], [0.95, 2.75, -HZ + 0.35], cab)
  box(root, [1.6, 0.05, 0.4], [0.95, 2.7, -HZ + 0.6], new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffd38a', emissiveIntensity: 2 }))
  // jars on the counter
  ;[['#e8a63c', 0.2], ['#7bb26a', 0.17], ['#d9654a', 0.18]].forEach(([c, r], i) => {
    cyl(root, r, 0.45, [-3.2 + i * 0.5 - 0.1, 1.92, -HZ + 0.35], '#e9f0ee', { transparent: true, opacity: 0.85 }, 14)
    cyl(root, r * 1.05, 0.1, [-3.2 + i * 0.5 - 0.1, 2.37, -HZ + 0.35], c, {}, 14)
  })
  solid(-5.35, 1.3, -HZ, -HZ + 1.25)

  // fridge
  box(root, [1.4, 3.5, 1.1], [2.9, 0, -HZ + 0.55], '#cfe9e0')
  box(root, [1.36, 0.04, 0.04], [2.9, 1.75, -HZ + 1.12], '#9db8b0')
  box(root, [0.06, 0.8, 0.06], [3.45, 2.0, -HZ + 1.14], '#7f9a94')
  box(root, [0.06, 0.6, 0.06], [3.45, 1.0, -HZ + 1.14], '#7f9a94')
  ;[['#e8566e', 2.4], ['#f2d14a', 2.7], ['#5aa7e8', 3.0]].forEach(([c, y], i) => box(root, [0.18, 0.18, 0.03], [2.5 + i * 0.3, y, -HZ + 1.13], c))
  box(root, [0.9, 0.35, 0.6], [2.9, 3.5, -HZ + 0.55], '#d9a763')
  solid(2.15, 3.65, -HZ, -HZ + 1.15)

  // low round table (chabudai) with tea things
  cyl(root, 1.35, 0.1, [-0.5, 0.95, 0.5], '#d9a763', {}, 40)
  ;[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(root, [0.14, 0.95, 0.14], [-0.5 + sx * 0.8, 0, 0.5 + sz * 0.8], '#b9894b'))
  cyl(root, 0.2, 0.3, [-0.9, 1.05, 0.2], '#5a7aa6', {}, 16)
  sphere(root, 0.09, [-0.9, 1.4, 0.2], '#5a7aa6')
  ;[[-0.4, 0.0], [-0.1, 0.6]].forEach(([dx, dz]) => cyl(root, 0.1, 0.12, [-0.5 + dx, 1.05, 0.5 + dz], '#f2efe6', {}, 12))
  cyl(root, 0.3, 0.16, [-0.2, 1.05, 1.0], '#c0392b', {}, 18)
  ;[[-0.3, 1.0], [-0.1, 1.05], [-0.15, 0.9]].forEach(([dx, dz]) => sphere(root, 0.1, [dx + 0.0, 1.27, dz], '#f08a2a'))
  cyl(root, 0.28, 0.04, [0.2, 1.05, 0.1], '#f7f0dc', {}, 18)
  solid(-1.95, 0.95, -0.9, 1.95)
  ;[['#2fb0c4', -0.5, -1.7, 0.1], ['#e8a63c', -2.55, 0.6, 0.5], ['#d9654a', 1.6, 0.4, -0.3], ['#7bb26a', -0.4, 2.7, 0.2]].forEach(([c, x, z, r]) => {
    box(root, [1.0, 0.14, 1.0], [x, 0, z], c).rotation.y = r
  })

  // striped rug
  const rug = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.03, 1.3), new THREE.MeshStandardMaterial({ map: stripeRug('#c0392b', '#f4ebd8'), roughness: 1 }))
  rug.position.set(-2.6, 0.016, -1.3)
  rug.receiveShadow = true
  root.add(rug)

  // shelves on the left wall: jars + plant
  ;[2.5, 3.3].forEach(y => box(root, [0.5, 0.1, 3.4], [-5.15, y, 0.4], '#d9a763'))
  ;[[-0.6, '#e8a63c'], [0.1, '#d9654a'], [0.8, '#7bb26a'], [1.5, '#5aa7e8']].forEach(([dz, c]) => {
    cyl(root, 0.17, 0.4, [-5.1, 2.6, 0.4 + dz], '#eef2ee', { transparent: true, opacity: 0.85 }, 12)
    cyl(root, 0.18, 0.08, [-5.1, 3.0, 0.4 + dz], c, {}, 12)
  })
  box(root, [0.3, 0.4, 0.5], [-5.15, 3.4, -0.7], '#c8683a')
  ;[0, 1, 2].forEach(i => sphere(root, 0.17, [-5.15, 3.95 + i * 0.1, -0.7 + (i - 1) * 0.15], '#4f9a5a'))
  plant(root, 4.6, 2.4, 0.9, '#7bb26a')
  solid(4.2, 5.0, 2.0, 2.8)

  frames.push(makeFrame(walls.back, 1.0, 1.4, [4.6, 3.6, -HZ + 0.03], 0, 2))

  // pendant over the table
  cyl(ceiling, 0.015, 0.9, [-0.5, H - 0.9, 0.5], '#3a3a3a', {}, 6)
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.7, 0.5, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffd38a', emissiveIntensity: 1.8, side: THREE.DoubleSide })
  )
  shade.position.set(-0.5, H - 1.15, 0.5)
  ceiling.add(shade)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: '#fff6dc', toneMapped: false }))
  bulb.position.set(-0.5, H - 1.3, 0.5)
  ceiling.add(bulb)

  const pendant = new THREE.PointLight('#ffcf86', 64, 10, 2)
  pendant.position.set(-0.5, H - 1.7, 0.5)
  const strip = new THREE.PointLight('#ffd6a0', 14, 5, 2)
  strip.position.set(0.9, 2.4, -HZ + 0.8)
  const fill = new THREE.PointLight('#ffd9a0', 10, 9, 2)
  fill.position.set(-3.0, 2.8, 2.8)
  root.add(pendant, strip, fill)
  return sh
}
