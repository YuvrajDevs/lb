import * as THREE from 'three'
import { W, D, H, T, HX, std, box, cyl, sphere } from './kit.js'
import { buildStudy } from './rooms/study.js'
import { buildBedroom, STAIR_HOLE } from './rooms/bedroom.js'
import { buildKitchen } from './rooms/kitchen.js'
import { buildLiving, STAIR } from './rooms/living.js'

export { H }
export const SLAB = 0.72
export const FH = H + SLAB // height of one storey
export const COL = W + 2 * T // spacing between neighbouring rooms

/**
 * A two-storey doll house: study (top-left), bedroom (top-right), kitchen (bottom-left), living room (bottom-right).
 * Returns the scene graph plus everything the game needs: rooms, per-storey colliders, stairs, frames.
 */
export function buildHouse() {
  const group = new THREE.Group()
  const specs = [
    { id: 'study', name: 'study', col: 0, row: 0, build: buildStudy },
    { id: 'bedroom', name: 'bedroom', col: 1, row: 0, build: buildBedroom },
    { id: 'kitchen', name: 'kitchen', col: 0, row: 1, build: buildKitchen },
    { id: 'living', name: 'living room', col: 1, row: 1, build: () => buildLiving(FH) },
  ]

  const colliders = [[], []] // [ground, upper]
  const frames = []
  const rooms = specs.map(s => {
    const sh = s.build()
    const ox = (s.col - 0.5) * COL
    const oy = (1 - s.row) * FH
    sh.root.position.set(ox, oy, 0)
    group.add(sh.root)
    const level = 1 - s.row
    sh.colliders.forEach(c => colliders[level].push({ minX: c.minX + ox, maxX: c.maxX + ox, minZ: c.minZ, maxZ: c.maxZ }))
    sh.frames.forEach(f => frames.push(f))
    return {
      id: s.id, name: s.name, col: s.col, row: s.row, level, ox, oy,
      walls: sh.walls, ceiling: sh.ceiling,
      center: new THREE.Vector3(ox, oy + 2.25, 0),
    }
  })
  const top = rooms.filter(r => r.row === 0)

  // ---------- roof (gable, with an attic window and a chimney) ----------
  const roofBase = FH + H + 0.22
  const hw = COL + 0.6, rh = 3.6, depth = D + 2 * T + 1.0
  const roof = new THREE.Group()
  const tri = new THREE.Shape()
  tri.moveTo(-hw, 0); tri.lineTo(hw, 0); tri.lineTo(0, rh); tri.closePath()
  const prism = new THREE.Mesh(
    new THREE.ExtrudeGeometry(tri, { depth, bevelEnabled: false }),
    [std('#f0e2bd'), std('#8a4f48', { roughness: 0.8 })]
  )
  prism.position.set(0, roofBase, -depth / 2)
  prism.castShadow = true
  prism.receiveShadow = true
  roof.add(prism)
  box(roof, [0.5, 0.25, depth + 0.3], [0, roofBase + rh - 0.05, 0], '#5c3a38')
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.1, 10, 32), std('#6a4630'))
  ring.position.set(0, roofBase + 1.5, depth / 2 + 0.02)
  roof.add(ring)
  const atticWin = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 32),
    new THREE.MeshStandardMaterial({ color: '#ffe2a8', emissive: '#ffb860', emissiveIntensity: 1.8 })
  )
  atticWin.position.set(0, roofBase + 1.5, depth / 2 + 0.015)
  roof.add(atticWin)
  box(roof, [0.12, 1.5, 0.05], [0, roofBase + 0.75, depth / 2 + 0.03], '#6a4630')
  box(roof, [1.5, 0.12, 0.05], [0, roofBase + 1.45, depth / 2 + 0.03], '#6a4630')
  box(roof, [1.1, 2.6, 1.1], [7.2, roofBase + 0.9, -1.2], '#a85a4a')
  box(roof, [1.3, 0.2, 1.3], [7.2, roofBase + 3.5, -1.2], '#7a3e36')
  group.add(roof)

  // ---------- garden base ----------
  box(group, [2 * COL + 3.0, 0.5, D + 2 * T + 3.0], [0, -1.0, 0.6], '#7da66a')
  box(group, [2 * COL + 3.0, 0.08, 0.3], [0, -0.52, D / 2 + T + 2.0], '#a9c88f')
  ;[[-10.6, 4.6], [10.6, 4.9], [-12.3, -1.0], [12.4, 0.5]].forEach(([x, z]) => {
    sphere(group, 0.8, [x, -0.1, z], '#4f9a5a')
    sphere(group, 0.55, [x + 0.6, -0.25, z + 0.3], '#5fae68')
  })
  ;[[-2.5, 6.0], [0.4, 6.7], [3.2, 7.3]].forEach(([x, z]) => cyl(group, 0.5, 0.08, [x, -0.5, z], '#d8cdb0', {}, 16))
  ;[[-7.5, 5.8, '#e8566e'], [-7.0, 6.1, '#f2d14a'], [8.0, 6.0, '#e8566e'], [8.6, 5.7, '#ffffff']].forEach(([x, z, c]) => {
    cyl(group, 0.02, 0.35, [x, -0.5, z], '#4f9a5a', {}, 5)
    sphere(group, 0.11, [x, -0.1, z], c)
  })

  // ---------- global lights ----------
  const lights = new THREE.Group()
  lights.add(new THREE.HemisphereLight('#ffcb9a', '#5b4a78', 0.5))
  const sun = new THREE.DirectionalLight('#ff9650', 2.6)
  sun.target.position.set(0, 5.5, 0)
  sun.position.set(-3.5, 5.5 + 9.2, -20)
  sun.castShadow = true
  sun.shadow.mapSize.set(4096, 4096)
  const sc = sun.shadow.camera
  sc.left = -17; sc.right = 17; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 70
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.04
  lights.add(sun, sun.target)

  // stairs: where you step on, and where you arrive
  const living = rooms.find(r => r.id === 'living')
  const stairs = {
    x: living.ox + STAIR.x,
    footZ: STAIR.zFoot,
    topZ: STAIR.zTop,
    startZ: STAIR.zStart,
    landingZ: -1.9,
    hole: { x0: living.ox + STAIR_HOLE.x0, x1: living.ox + HX, z0: STAIR_HOLE.z0, z1: STAIR_HOLE.z1 },
  }

  return {
    group, lights, rooms, colliders, frames, roof, roofBase, top, stairs,
    bounds: { halfW: COL + 0.7, yMin: -1.0, yMax: roofBase + rh },
  }
}
