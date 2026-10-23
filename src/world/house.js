import * as THREE from 'three'
import { D, H, T, W, std, box, cyl, sphere } from './kit.js'
import { bake } from './bake.js'
import { glow, pool } from './fx.js'
import { buildStudy } from './rooms/study.js'
import { buildBedroom, STAIR_HOLE } from './rooms/bedroom.js'
import { buildKitchen } from './rooms/kitchen.js'
import { buildLiving, STAIR } from './rooms/living.js'

export { H }
export const SLAB = 0.72
export const FH = H + SLAB // height of one storey
export const COL = W + 2 * T // spacing between neighbouring rooms

const PLOT = { x: COL + 1.4, zBack: -(D / 2 + T + 1.4), zFront: D / 2 + T + 5.2 } // the fenced garden

function signTexture(text) {
  const c = document.createElement('canvas')
  c.width = 512; c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#d9b27a'; g.fillRect(0, 0, 512, 128)
  g.strokeStyle = '#8a6a4a'; g.lineWidth = 8; g.strokeRect(4, 4, 504, 120)
  g.fillStyle = '#4a3322'
  g.font = '700 54px Georgia, serif'
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, 256, 68, 470)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * A two-storey doll house at night: study (top-left), bedroom (top-right), kitchen (bottom-left),
 * living room (bottom-right), roof, and a fenced garden with a name sign.
 * All static geometry is merged (see bake.js) so the whole house is a few hundred draw calls at most.
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
  const shells = []
  const rooms = specs.map(s => {
    const sh = s.build()
    const ox = (s.col - 0.5) * COL
    const oy = (1 - s.row) * FH
    sh.root.position.set(ox, oy, 0)
    group.add(sh.root)
    shells.push(sh)
    const level = 1 - s.row
    sh.colliders.forEach(c => colliders[level].push({ minX: c.minX + ox, maxX: c.maxX + ox, minZ: c.minZ, maxZ: c.maxZ }))
    sh.frames.forEach(f => frames.push(f))
    return {
      id: s.id, name: s.name, col: s.col, row: s.row, level, ox, oy,
      walls: sh.walls, ceiling: sh.ceiling,
      center: new THREE.Vector3(ox, oy + 2.25, 0),
    }
  })

  // ---------- roof (gable, attic window, chimney) ----------
  const roofBase = FH + H + 0.22
  const hw = COL + 0.6, rh = 3.6, depth = D + 2 * T + 1.0
  const roof = new THREE.Group()
  const tri = new THREE.Shape()
  tri.moveTo(-hw, 0); tri.lineTo(hw, 0); tri.lineTo(0, rh); tri.closePath()
  const prism = new THREE.Mesh(
    new THREE.ExtrudeGeometry(tri, { depth, bevelEnabled: false }),
    [new THREE.MeshStandardMaterial({ color: '#d9d2c4', roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: '#4b5282', roughness: 0.8 })]
  )
  prism.position.set(0, roofBase, -depth / 2)
  prism.castShadow = true
  prism.receiveShadow = true
  roof.add(prism)
  box(roof, [0.5, 0.25, depth + 0.3], [0, roofBase + rh - 0.05, 0], '#2f3350')
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.1, 10, 28), std('#f3eee4'))
  ring.position.set(0, roofBase + 1.5, depth / 2 + 0.02)
  roof.add(ring)
  const atticWin = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 28),
    new THREE.MeshStandardMaterial({ color: '#ffe2a8', emissive: '#ffb860', emissiveIntensity: 1.8 })
  )
  atticWin.position.set(0, roofBase + 1.5, depth / 2 + 0.015)
  roof.add(atticWin)
  box(roof, [0.1, 1.5, 0.05], [0, roofBase + 0.75, depth / 2 + 0.03], '#f3eee4')
  box(roof, [1.5, 0.1, 0.05], [0, roofBase + 1.45, depth / 2 + 0.03], '#f3eee4')
  box(roof, [1.1, 2.6, 1.1], [7.2, roofBase + 0.9, -1.2], '#6a4a52')
  box(roof, [1.3, 0.2, 1.3], [7.2, roofBase + 3.5, -1.2], '#4a3640')
  glow(roof, [0, roofBase + 1.5, depth / 2 + 0.3], '#ffb860', 3.4, 0.55)
  group.add(roof)

  // ---------- fenced garden ----------
  const garden = new THREE.Group()
  const zc = (PLOT.zBack + PLOT.zFront) / 2
  box(garden, [PLOT.x * 2 + 0.6, 0.5, PLOT.zFront - PLOT.zBack + 0.6], [0, -1.0, zc], '#35564f')
  // path of stepping stones from the gate to the house
  ;[4.8, 5.9, 7.0, 8.1].forEach((z, i) => cyl(garden, 0.5, 0.08, [i % 2 ? 0.25 : -0.25, -0.54, z], '#c9c2b2', {}, 14))

  const fence = '#f2eadb'
  const post = (x, z, h = 0.6) => box(garden, [0.13, h, 0.13], [x, -0.5, z], fence)
  const run = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.max(1, Math.round(len / 0.75))
    ;[0.2, 0.45].forEach(y => {
      const r = box(garden, [0.05, 0.07, len], [(x0 + x1) / 2, -0.5 + y, (z0 + z1) / 2], fence)
      r.rotation.y = Math.atan2(x1 - x0, z1 - z0)
    })
    for (let i = 0; i <= n; i++) post(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n)
  }
  const gate = 1.3
  run(-PLOT.x, PLOT.zBack, PLOT.x, PLOT.zBack)
  run(-PLOT.x, PLOT.zBack, -PLOT.x, PLOT.zFront)
  run(PLOT.x, PLOT.zBack, PLOT.x, PLOT.zFront)
  run(-PLOT.x, PLOT.zFront, -gate, PLOT.zFront)
  run(gate, PLOT.zFront, PLOT.x, PLOT.zFront)
  // lanterns on the corners and either side of the gate
  ;[[-PLOT.x, PLOT.zBack], [PLOT.x, PLOT.zBack], [-PLOT.x, PLOT.zFront], [PLOT.x, PLOT.zFront], [-gate, PLOT.zFront], [gate, PLOT.zFront]].forEach(([x, z]) => {
    box(garden, [0.2, 0.3, 0.2], [x, -0.5 + 0.6, z], fence)
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffe2a8', toneMapped: false }))
    lamp.position.set(x, -0.5 + 1.05, z)
    lamp.userData.keep = true
    garden.add(lamp)
    glow(garden, [x, -0.5 + 1.05, z], '#ffb860', 1.5, 0.6)
    pool(garden, [x, -0.5, z], '#ffb860', 2.0, 0.22)
  })
  // bushes
  ;[[-10.4, 5.2], [10.4, 5.6], [-11.8, -1.0], [11.9, 0.4]].forEach(([x, z]) => {
    sphere(garden, 0.8, [x, -0.1, z], '#2f6a54')
    sphere(garden, 0.55, [x + 0.6, -0.25, z + 0.3], '#3b7a62')
  })
  group.add(garden)

  // name sign (kept separate so it can be re-texted: house.setName('X & Y'))
  const signMat = new THREE.MeshStandardMaterial({ map: signTexture('our house'), roughness: 0.8, emissive: '#6b5230', emissiveIntensity: 0.4 })
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.8, 0.1), signMat)
  sign.position.set(-4.4, -0.5 + 1.1, PLOT.zFront - 0.3)
  sign.userData.keep = true
  sign.castShadow = true
  group.add(sign)
  ;[-5.6, -3.2].forEach(x => {
    const p = box(group, [0.14, 1.0, 0.14], [x, -0.5, PLOT.zFront - 0.3], '#8a6a4a')
    p.userData.keep = false
  })
  glow(group, [-4.4, 0.9, PLOT.zFront + 0.4], '#ffb860', 2.6, 0.3)
  const setName = text => {
    signMat.map.dispose()
    signMat.map = signTexture(text)
    signMat.needsUpdate = true
  }

  // ---------- global lights: dim blue night + moon ----------
  const lights = new THREE.Group()
  lights.add(new THREE.HemisphereLight('#8497e6', '#3c3668', 1.35))
  const moon = new THREE.DirectionalLight('#9ab8ff', 2.2)
  moon.target.position.set(0, 5.5, 0)
  moon.position.set(-4.5, 5.5 + 9.2, -20)
  moon.castShadow = true
  moon.shadow.mapSize.set(2048, 2048) // rendered once (see game.js), so the size is cheap
  const sc = moon.shadow.camera
  sc.left = -17; sc.right = 17; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 70
  moon.shadow.bias = -0.0005
  moon.shadow.normalBias = 0.04
  lights.add(moon, moon.target)

  // ---------- merge everything static into a few meshes ----------
  group.updateMatrixWorld(true)
  shells.forEach(sh => {
    bake(sh.root, { exclude: [...Object.values(sh.walls), sh.ceiling] })
    Object.values(sh.walls).forEach(w => bake(w, { clone: true }))
    bake(sh.ceiling, { clone: true })
  })
  bake(roof, { clone: true })
  bake(garden)

  const living = rooms.find(r => r.id === 'living')
  const stairs = {
    x: living.ox + STAIR.x,
    footZ: STAIR.zFoot,
    topZ: STAIR.zTop,
    startZ: STAIR.zStart,
    landingZ: -1.9,
    hole: { x0: living.ox + STAIR_HOLE.x0, z0: STAIR_HOLE.z0, z1: STAIR_HOLE.z1 },
  }

  return {
    group, lights, rooms, colliders, frames, roof, roofBase, stairs, setName,
    bounds: { halfW: PLOT.x + 0.6, yMin: -1.25, yMax: roofBase + rh },
  }
}
