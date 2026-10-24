import * as THREE from 'three'
import { box, cyl, sphere } from './kit.js'
import { glow, pool } from './fx.js'
import { PLAYGROUND } from '../game/areas.js'

// The playground behind the house: a soft play floor with swings, a slide, a seesaw, a roundabout and a sandpit,
// benches and lamps, and three game stations at the far end. The stations are where the 3D games will start
// (for now they glow and say "soon"). Ground level is y = -0.5, like the garden.

const Y = -0.5
const WOOD = '#8a6a4a', METAL = '#3a3f58', RED = '#d0584a', TEAL = '#3f8f8a', CREAM = '#f2eadb'

function labelTexture(title, sub) {
  const c = document.createElement('canvas')
  c.width = 512; c.height = 192
  const g = c.getContext('2d')
  g.fillStyle = '#1a1730'; g.fillRect(0, 0, 512, 192)
  g.strokeStyle = '#ffd27a'; g.lineWidth = 6; g.strokeRect(8, 8, 496, 176)
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillStyle = '#fff1d0'; g.font = '600 64px Oswald, sans-serif'; g.fillText(title, 256, 78, 470)
  g.fillStyle = '#ffd27a'; g.font = '400 36px Oswald, sans-serif'; g.fillText(sub, 256, 142, 470)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function buildPlayground() {
  const group = new THREE.Group()
  const solids = [] // { minX, maxX, minZ, maxZ } things you can't walk through
  const solid = (x, z, w, d) => solids.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 })
  const { x: HW, zNear, zFar } = PLAYGROUND
  const zc = (zNear + zFar) / 2

  // the soft play floor, with a lighter border and a path up from the back gate
  // (the two layers start a little below ground level, so their undersides never share a plane with the
  //  equipment standing on them)
  box(group, [HW * 2 - 2, 0.1, zNear - zFar - 2.4], [0, Y - 0.04, zc - 0.4], '#2f3560')
  box(group, [HW * 2 - 3, 0.09, zNear - zFar - 3.4], [0, Y - 0.02, zc - 0.4], '#38407a')
  for (let k = 0; k < 6; k++) cyl(group, 0.55, 0.08, [Math.sin(k * 0.6) * 0.4, Y, zNear - 0.8 - k * 1.1], '#c9c2b2', {}, 14)

  // swings
  const sx = -9, sz = -12
  ;[-1, 1].forEach(s => {
    const leg = box(group, [0.12, 3.4, 0.12], [sx + s * 2.2, Y, sz - 0.6], METAL); leg.rotation.x = 0.18
    const leg2 = box(group, [0.12, 3.4, 0.12], [sx + s * 2.2, Y, sz + 0.6], METAL); leg2.rotation.x = -0.18
  })
  box(group, [4.6, 0.14, 0.14], [sx, Y + 3.3, sz], METAL)
  ;[-0.9, 0.9].forEach(dx => {
    [-0.25, 0.25].forEach(dz => box(group, [0.03, 2.4, 0.03], [sx + dx + dz, Y + 0.95, sz], '#c8c8d8'))
    box(group, [0.8, 0.08, 0.35], [sx + dx, Y + 0.9, sz], RED)
  })
  solid(sx, sz, 5.2, 1.8)

  // slide: a little tower with a ladder and a chute
  const lx = 8, lz = -12
  box(group, [1.6, 2.2, 1.6], [lx, Y, lz], TEAL)
  box(group, [1.8, 0.12, 1.8], [lx, Y + 2.2, lz], CREAM)
  for (let k = 0; k < 6; k++) box(group, [1.0, 0.06, 0.06], [lx, Y + 0.3 + k * 0.36, lz - 1.0], WOOD)
  const chute = box(group, [1.0, 0.1, 4.0], [lx, Y + 1.0, lz + 2.4], '#f0c040')
  chute.rotation.x = 0.5
  ;[-0.5, 0.5].forEach(dx => { const r = box(group, [0.08, 0.25, 4.0], [lx + dx, Y + 1.05, lz + 2.4], '#e0a020'); r.rotation.x = 0.5 })
  solid(lx, lz + 1.2, 1.9, 5.4)

  // seesaw
  const wx = -2, wz = -19
  box(group, [0.5, 0.6, 0.5], [wx, Y, wz], METAL)
  const plank = box(group, [4.4, 0.12, 0.45], [wx, Y + 0.62, wz], RED)
  plank.rotation.z = 0.16
  ;[-1, 1].forEach(s => box(group, [0.1, 0.4, 0.5], [wx + s * 1.9, Y + 0.62 + s * 0.3, wz], METAL))
  solid(wx, wz, 4.6, 0.8)

  // roundabout
  const rx = 9, rz = -21
  cyl(group, 1.7, 0.18, [rx, Y, rz], TEAL, {}, 28)
  cyl(group, 0.12, 1.1, [rx, Y + 0.18, rz], METAL, {}, 10)
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2
    const bar = box(group, [0.06, 0.06, 1.6], [rx + Math.cos(a) * 0.8, Y + 1.0, rz + Math.sin(a) * 0.8], METAL)
    bar.rotation.y = -a
  }
  solid(rx, rz, 3.4, 3.4)

  // sandpit
  const px = -10, pz = -21
  ;[[0, -1.6, 3.6, 0.2], [0, 1.6, 3.6, 0.2], [-1.7, 0, 0.2, 3.2], [1.7, 0, 0.2, 3.2]].forEach(([dx, dz, w, d]) => box(group, [w, 0.3, d], [px + dx, Y, pz + dz], WOOD))
  box(group, [3.2, 0.2, 3.0], [px, Y, pz], '#d8c08a')
  sphere(group, 0.35, [px - 0.6, Y + 0.25, pz + 0.4], '#d8c08a')
  solid(px, pz, 3.8, 3.6)

  // benches and lamps along the sides
  ;[[-14, -9], [14, -9], [-14, -17], [14, -17]].forEach(([x, z]) => {
    box(group, [0.5, 0.45, 1.8], [x, Y, z], WOOD)
    box(group, [0.1, 0.5, 1.8], [x + (x < 0 ? -0.22 : 0.22), Y + 0.45, z], WOOD)
    solid(x, z, 0.7, 2.0)
  })
  ;[[-14.5, -6.5], [14.5, -6.5], [-14.5, -26.5], [14.5, -26.5], [0, -13.5]].forEach(([x, z]) => {
    cyl(group, 0.07, 2.8, [x, Y, z], '#2f3138', {}, 8)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffe2a8', toneMapped: false }))
    head.position.set(x, Y + 3.0, z)
    head.userData.keep = true
    group.add(head)
    glow(group, [x, Y + 3.0, z], '#ffcc66', 2.4, 0.6)
    pool(group, [x, Y + 0.08, z], '#ffcc66', 3.2, 0.26)
    solid(x, z, 0.3, 0.3)
  })

  // the game stations: glowing pads with a floating gem and a board saying what is coming
  const stations = []
  ;[[-8, -25.5, 'Star catch', '#ffd46b'], [0, -26, 'Couple quiz', '#ff8fb8'], [8, -25.5, 'Arcade', '#7fe0ff']].forEach(([x, z, name, color]) => {
    cyl(group, 1.4, 0.12, [x, Y, z], '#1a1730', {}, 32)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.06, 8, 40), new THREE.MeshBasicMaterial({ color, toneMapped: false }))
    ring.rotation.x = -Math.PI / 2
    ring.position.set(x, Y + 0.14, z)
    ring.userData.keep = true
    group.add(ring)
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color, toneMapped: false }))
    gem.position.set(x, Y + 1.6, z)
    gem.userData.keep = true
    gem.userData.spin = true
    group.add(gem)
    glow(group, [x, Y + 1.6, z], color, 3.2, 0.55)
    pool(group, [x, Y + 0.14, z], color, 2.0, 0.3)
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.08), new THREE.MeshBasicMaterial({ map: labelTexture(name, 'coming soon'), toneMapped: false }))
    board.position.set(x, Y + 2.9, z - 0.9)
    board.userData.keep = true
    group.add(board)
    ;[-1.05, 1.05].forEach(dx => box(group, [0.08, 2.6, 0.08], [x + dx, Y, z - 0.98], '#2f3138')) // just behind the board
    solid(x, z - 0.9, 2.5, 0.3)
    stations.push({ x, z, name, gem })
  })

  return { group, solids, stations }
}
