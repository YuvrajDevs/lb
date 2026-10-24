import * as THREE from 'three'
import { D, H, T, W, HX, HZ, std, box, cyl, sphere } from './kit.js'
import { bake } from './bake.js'
import { glow, pool, cone } from './fx.js'
import { buildStudy } from './rooms/study.js'
import { buildBedroom, STAIR_HOLE } from './rooms/bedroom.js'
import { buildKitchen } from './rooms/kitchen.js'
import { buildLiving, STAIR } from './rooms/living.js'
import { buildHome } from './rooms/home.js'
import { buildItem } from './items/index.js'
import { signs as buildSign } from './items/decor.js'
import { ITEM_BY_ID } from '../game/catalog.js'
import { WINDOWS, PLOTS, getHomeKind, gardenArea } from '../game/areas.js'
import { furnishArea, paintTexture, floorTex } from './furnish.js'
import { CLIFF_Z, streamX } from './scenery.js'
import { buildPlayground } from './playground.js'
import { NEIGHBOUR_PLOT_Z } from './neighbours.js'
import { PLAYGROUND } from '../game/areas.js'

export { H }
export const SLAB = 0.72
export const FH = H + SLAB // height of one storey
export const COL = W + 2 * T // spacing between neighbouring rooms


function signTexture(text) {
  const c = document.createElement('canvas')
  c.width = 768; c.height = 220
  const g = c.getContext('2d')
  g.fillStyle = '#7a5a3c'; g.fillRect(0, 0, 768, 220)
  for (let y = 0; y < 220; y += 18) { g.fillStyle = y % 36 ? 'rgba(255,230,190,0.06)' : 'rgba(0,0,0,0.08)'; g.fillRect(0, y, 768, 9) }
  g.strokeStyle = '#e9d3a8'; g.lineWidth = 10; g.strokeRect(10, 10, 748, 200)
  g.fillStyle = '#fff1d0'
  g.font = '600 104px Oswald, sans-serif'
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, 384, 112, 680)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/**
 * A doll house at night with a fenced garden and a name sign. For a couple: two storeys, study (top-left),
 * bedroom (top-right), kitchen (bottom-left), living room (bottom-right). For a solo player: the starter home,
 * one room on a smaller plot. All static geometry is merged (see bake.js): a few hundred draw calls at most.
 */
export function buildHouse(opts = {}) {
  const group = new THREE.Group()
  const solo = getHomeKind() === 'solo'
  const P = PLOTS[getHomeKind()]
  const PLOT = { x: P.x, zBack: -(D / 2 + T + 2.4), zFront: D / 2 + T + 5.2 } // the fenced garden
  const BUSHES = P.bushes
  const specs = solo
    ? [{ id: 'home', name: 'home', col: 0.5, row: 1, build: buildHome }]
    : [
      { id: 'study', name: 'study', col: 0, row: 0, build: buildStudy },
      { id: 'bedroom', name: 'bedroom', col: 1, row: 0, build: buildBedroom },
      { id: 'kitchen', name: 'kitchen', col: 0, row: 1, build: buildKitchen },
      { id: 'living', name: 'living room', col: 1, row: 1, build: () => buildLiving(FH) },
    ]
  const topRow = Math.min(...specs.map(s => s.row))

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
    sh.colliders.forEach(c => colliders[level].push({ minX: c.minX + ox, maxX: c.maxX + ox, minZ: c.minZ, maxZ: c.maxZ, stair: c.stair }))
    sh.frames.forEach(f => frames.push(f))
    const placed = new THREE.Group() // everything the player has put in this room
    sh.root.add(placed)
    const light = new THREE.PointLight('#ffd9a0', 14, 10, 2)
    sh.root.add(light)
    // a soft warm fill from the open front, so furniture facing the room is not left in cool shade
    const fill = new THREE.PointLight('#ffd58a', 5.5, 9, 2)
    fill.position.set(0, 3.0, 1.4) // well inside the room: close to the front wall it left a bright spot on it
    sh.root.add(fill)
    return {
      id: s.id, name: s.name, col: s.col, row: s.row, level, ox, oy, sh, placed, light, fill, furnished: null, top: s.row === topRow,
      walls: sh.walls, ceiling: sh.ceiling, door: sh.door, doorX: sh.doorX,
      center: new THREE.Vector3(ox, oy + 2.25, 0),
    }
  })

  // ---------- roof (gable, attic window, chimney) ----------
  const roofBase = (solo ? 0 : FH) + H + 0.22
  const hw = (solo ? HX + T : COL) + 0.6, rh = solo ? 2.6 : 3.6, depth = D + 2 * T + 1.0
  const roof = new THREE.Group()
  const tri = new THREE.Shape()
  tri.moveTo(-hw, 0); tri.lineTo(hw, 0); tri.lineTo(0, rh); tri.closePath()
  const prism = new THREE.Mesh(
    new THREE.ExtrudeGeometry(tri, { depth, bevelEnabled: false }),
    [new THREE.MeshStandardMaterial({ color: '#a9c4b0', roughness: 0.6 }), new THREE.MeshPhysicalMaterial({ color: '#9a5a50', roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3 })]
  )
  prism.position.set(0, roofBase, -depth / 2)
  prism.castShadow = true
  prism.receiveShadow = true
  roof.add(prism)
  box(roof, [0.5, 0.25, depth + 0.3], [0, roofBase + rh - 0.05, 0], '#5c3a38')
  // shingle rows lying on both slopes, plus barge boards along the gable edges and an eave band
  const slope = Math.atan2(rh, hw)
  const slopeLen = Math.hypot(hw, rh)
  for (let i = 1; i < 14; i++) {
    const t = i / 14
    ;[-1, 1].forEach(sd => {
      const x = sd * hw * (1 - t), y = roofBase + rh * t
      const row = box(roof, [slopeLen / 14 + 0.05, 0.05, depth + 0.1], [x + sd * 0.4, y + 0.02, 0], i % 2 ? '#a8645a' : '#8a4f48')
      row.rotation.z = -sd * slope
      row.position.x = x - sd * (slopeLen / 28) * Math.cos(slope)
      row.position.y = y + (slopeLen / 28) * Math.sin(slope) + 0.03 + (i % 2) * 0.015 // alternate rows a little proud: overlaps never share a plane
    })
  }
  [-1, 1].forEach(sd => {
    [depth / 2 + 0.05, -depth / 2 - 0.05].forEach(z => {
      const bb = box(roof, [slopeLen + 0.2, 0.22, 0.14], [sd * hw / 2, roofBase + rh / 2 - 0.02, z], '#f6f1e6')
      bb.rotation.z = -sd * slope
    })
  })
  box(roof, [hw * 2 + 0.8, 0.22, 0.3], [0, roofBase - 0.02, depth / 2 - 0.1], '#f6f1e6')
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.1, 10, 28), std('#f3eee4'))
  const atticY = roofBase + (solo ? 1.05 : 1.5)
  ring.position.set(0, atticY, depth / 2 + 0.02)
  roof.add(ring)
  const atticWin = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 28),
    new THREE.MeshStandardMaterial({ color: '#ffe2a8', emissive: '#ffcc66', emissiveIntensity: 1.8 })
  )
  atticWin.position.set(0, atticY, depth / 2 + 0.015)
  roof.add(atticWin)
  box(roof, [0.1, 1.5, 0.05], [0, atticY - 0.75, depth / 2 + 0.03], '#f3eee4')
  box(roof, [1.5, 0.1, 0.05], [0, atticY - 0.05, depth / 2 + 0.03], '#f3eee4')
  const chimX = solo ? 3.2 : 7.2, chimH = solo ? 2.0 : 2.6
  box(roof, [1.1, chimH, 1.1], [chimX, roofBase + 0.9, -1.2], '#b0705a')
  box(roof, [1.3, 0.2, 1.3], [chimX, roofBase + 0.9 + chimH - 0.1, -1.2], '#7a4a40')
  glow(roof, [0, atticY, depth / 2 + 0.3], '#ffcc66', 3.4, 0.55)
  group.add(roof)

  // ---------- fenced garden ----------
  const garden = new THREE.Group()
  const defaultFence = new THREE.Group() // the standard picket fence (hidden when a fence from the shop is applied)
  const itemFence = new THREE.Group()
  const gardenPlaced = new THREE.Group() // garden lights the player has placed
  const street = new THREE.Group() // road, lamps, trees, the sign's lamp: only shown from the street view
  const zc = (PLOT.zBack + PLOT.zFront) / 2
  box(garden, [PLOT.x * 2 + 0.6, 0.5, PLOT.zFront - PLOT.zBack + 0.6], [0, -1.0, zc], '#35564f')
  // stepping stones from the gate to the front door
  for (let k = 0; k < 5; k++) { const t = k / 4; cyl(garden, 0.5, 0.08, [0.2 + (P.doorX - 0.2) * t, -0.54, 8.4 - 3.5 * t], '#c9c2b2', {}, 14) }
  glow(street, [P.doorX, 3.3, 4.2], '#ffcc66', 2.6, 0.5)
  pool(street, [P.doorX, -0.5, 5.2], '#ffcc66', 2.2, 0.28)

  // the cliff walk: a wet, glossy stone path that mirrors the lamps, and a low railing at the edge of the drop to the sea
  const wet = new THREE.MeshPhysicalMaterial({ color: '#3a3558', roughness: 0.16, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 })
  // the glowing stream crosses the walk on its way to the waterfall: the paving stops either side and a wide
  // wooden deck carries the walk over the water, running all the way from the land to the cliff edge so the
  // stream slips out of sight beneath it and reappears as the waterfall
  const dz0 = PLOT.zFront - 0.6, dz1 = CLIFF_Z - 0.75 // the deck's land end and cliff end
  const sxs = []
  for (let z = dz0; z <= dz1 + 0.01; z += 0.5) sxs.push(streamX(z))
  const gap = [Math.min(...sxs) - 2.4, Math.max(...sxs) + 2.4]
  ;[[-110, gap[0]], [gap[1], 110]].forEach(([a, b]) => {
    box(street, [b - a, 0.25, 2.6], [(a + b) / 2, -0.73, PLOT.zFront + 1.7], wet)
    for (let x = Math.ceil(a / 1.5) * 1.5; x < b - 0.2; x += 1.5) if (x > a + 0.2) box(street, [0.04, 0.02, 2.6], [x, -0.48, PLOT.zFront + 1.7], '#2a2642') // paving joints
  })
  const deckL = gap[1] - gap[0] + 0.4, deckX = (gap[0] + gap[1]) / 2, deckD = dz1 - dz0, deckZ = (dz0 + dz1) / 2
  box(street, [deckL, 0.16, deckD], [deckX, -0.42, deckZ], '#8a6a4a')
  for (let x = gap[0] + 0.2; x <= gap[1]; x += 0.45) box(street, [0.05, 0.02, deckD], [x, -0.26, deckZ], '#6b4f36') // plank lines
  ;[dz0 + 0.08, dz1 - 0.08].forEach(z => { // posts stand just inside the deck's edge, not flush with it
    box(street, [deckL, 0.08, 0.08], [deckX, 0.35, z], '#6b4f36')
    for (let k = 0; k <= 4; k++) box(street, [0.1, 0.87, 0.1], [gap[0] + ((gap[1] - gap[0]) * k) / 4, -0.44, z], '#6b4f36')
  })
  const edgeZ = CLIFF_Z - 0.7
  for (let x = -110; x <= 110; x += 2) box(street, [0.14, 0.95, 0.14], [x, -0.55, edgeZ], '#d8d0e8')
  box(street, [220, 0.1, 0.1], [0, 0.4, edgeZ], '#f2eadb')
  box(street, [220, 0.06, 0.06], [0, 0.0, edgeZ], '#f2eadb')
  // street lamps stand at the land-side edge of the walk, their arms reaching out over it towards the sea
  const postZ = PLOT.zFront + 0.55, headZ = postZ + 0.85
  ;[-9.5, 9.5].forEach(x => {
    cyl(street, 0.08, 3.4, [x, -0.5, postZ], '#2f3138', {}, 8)
    box(street, [0.08, 0.08, 0.9], [x, 2.85, postZ + 0.45], '#2f3138')
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: '#ffe2a8', toneMapped: false }))
    head.position.set(x, 2.78, headZ)
    head.userData.keep = true
    street.add(head)
    glow(street, [x, 2.75, headZ], '#ffcc66', 2.4, 0.6)
    cone(street, [x, 2.7, headZ], '#ffcc66', 3.0, 1.6, 0.16)
    pool(street, [x, -0.48, headZ], '#ffcc66', 3.0, 0.3) // on top of the path, not inside it
  })

  const fence = '#f2eadb'
  const post = (x, z, h = 0.6) => box(defaultFence, [0.13, h, 0.13], [x, -0.5, z], fence)
  const run = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const n = Math.max(1, Math.round(len / 0.75))
    ;[0.2, 0.45].forEach(y => {
      const r = box(defaultFence, [0.05, 0.07, len], [(x0 + x1) / 2, -0.5 + y, (z0 + z1) / 2], fence)
      r.rotation.y = Math.atan2(x1 - x0, z1 - z0)
    })
    for (let i = 0; i <= n; i++) post(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n)
  }
  const gate = 1.3
  run(-PLOT.x, PLOT.zBack, -gate, PLOT.zBack) // (the back fence has a gate too, out to the playground)
  run(gate, PLOT.zBack, PLOT.x, PLOT.zBack)
  run(-PLOT.x, PLOT.zBack, -PLOT.x, PLOT.zFront)
  run(PLOT.x, PLOT.zBack, PLOT.x, PLOT.zFront)
  run(-PLOT.x, PLOT.zFront, -gate, PLOT.zFront)
  run(gate, PLOT.zFront, PLOT.x, PLOT.zFront)
  // the garden gate: two little picket leaves that swing outward when someone walks up to them (see game.js)
  const gateGroup = new THREE.Group()
  group.add(gateGroup)
  // a gate: two little picket leaves that swing outward (dir +1 towards the sea, -1 towards the back)
  const makeGate = (z, dir) => [-1, 1].map(side => {
    const pivot = new THREE.Group()
    pivot.position.set(side * gate, -0.5, z)
    const leaf = new THREE.Group()
    const mat = std('#f2eadb')
    const add = (w, h, d, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, 0); m.castShadow = true; m.userData.keep = true; leaf.add(m) }
    add(gate - 0.08, 0.07, 0.05, -side * gate / 2, 0.2)
    add(gate - 0.08, 0.07, 0.05, -side * gate / 2, 0.5)
    for (let i = 0; i < 4; i++) add(0.1, 0.62, 0.05, -side * (0.15 + i * (gate - 0.3) / 3), 0.31)
    pivot.add(leaf)
    gateGroup.add(pivot)
    return { pivot, side: side * dir }
  })
  const gateLeaves = makeGate(PLOT.zFront, 1)
  const backGateLeaves = makeGate(PLOT.zBack, -1)
  // lanterns on the corners and either side of the gate
  ;[[-PLOT.x, PLOT.zBack], [PLOT.x, PLOT.zBack], [-PLOT.x, PLOT.zFront], [PLOT.x, PLOT.zFront], [-gate, PLOT.zFront], [gate, PLOT.zFront], [-gate, PLOT.zBack], [gate, PLOT.zBack]].forEach(([x, z]) => {
    box(garden, [0.2, 0.3, 0.2], [x, -0.5 + 0.6, z], fence)
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffe2a8', toneMapped: false }))
    lamp.position.set(x, -0.5 + 1.05, z)
    lamp.userData.keep = true
    garden.add(lamp)
    glow(garden, [x, -0.5 + 1.05, z], '#ffcc66', 1.5, 0.6)
    pool(garden, [x, -0.5, z], '#ffcc66', 2.0, 0.22)
  })
  // a signpost by the back gate, so the way to the playground is never a secret
  {
    const px = gate + 0.75, pz = PLOT.zBack + 0.55
    box(garden, [0.1, 1.5, 0.1], [px, -0.5, pz], '#6b4a30')
    const wood = std('#7a5a3c')
    const face = new THREE.MeshBasicMaterial({ map: signTexture('Playground ↑'), toneMapped: false })
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.32, 0.05), [wood, wood, wood, wood, face, wood])
    board.position.set(px, -0.5 + 1.25, pz + 0.06)
    board.userData.keep = true
    garden.add(board)
    glow(garden, [px, 0.9, pz + 0.3], '#ffcc66', 1.1, 0.35)
  }
  // bushes
  // (the two beside the house are smaller and sit in the gap to the fence, so they never poke through a wall)
  BUSHES.forEach(([x, z, r]) => {
    sphere(garden, r, [x, -0.5 + r * 0.5, z], '#2f6a54')
    sphere(garden, r * 0.7, [x + (r < 0.6 ? 0 : 0.6), -0.5 + r * 0.3, z + 0.5], '#3b7a62')
  })
  const playground = buildPlayground()
  group.add(garden, defaultFence, itemFence, gardenPlaced, street, playground.group)

  // name sign on two posts, lit by its own street lamp (kept separate so it can be re-texted: setName('X & Y'))
  const SX = P.signX, SZ = PLOT.zFront - 0.6
  // (the name is painted on the front face only; the edges and the back are plain wood)
  const signMat = new THREE.MeshStandardMaterial({ map: signTexture(opts.name || ''), roughness: 0.8, emissive: '#7a5a3c', emissiveIntensity: 0.55 })
  signMat.emissiveMap = signMat.map
  const signWood = std('#6b4a30')
  const defaultSign = new THREE.Group()
  const sign = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.1, 0.14), [signWood, signWood, signWood, signWood, signMat, signWood])
  sign.position.set(SX, -0.5 + 1.25, SZ)
  sign.userData.keep = true
  sign.castShadow = true
  defaultSign.add(sign)
  ;[SX - 1.6, SX + 1.6].forEach(x => box(defaultSign, [0.16, 1.2, 0.16], [x, -0.5, SZ], '#6b4a30'))
  group.add(defaultSign)
  let itemSign = null
  let signText = opts.name || ''
  // lamp post with an arm reaching over the board and a cone of light falling on it
  const PX = SX - 2.9
  cyl(street, 0.07, 3.0, [PX, -0.5, SZ], '#2f3138', {}, 8)
  box(street, [2.9, 0.08, 0.08], [SX - 1.45, 2.45, SZ], '#2f3138')
  const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.45), new THREE.MeshBasicMaterial({ color: '#ffe2a8', toneMapped: false }))
  lampHead.position.set(SX, 2.38, SZ)
  lampHead.userData.keep = true
  street.add(lampHead)
  glow(street, [SX, 2.3, SZ], '#ffd27a', 2.8, 0.7)
  cone(street, [SX, 2.3, SZ + 0.1], '#ffd27a', 2.6, 1.9, 0.16)
  pool(street, [SX, -0.5, SZ + 0.9], '#ffd27a', 2.6, 0.3)
  const setName = text => {
    signText = text
    itemSign?.setText(text)
    signMat.map.dispose()
    signMat.map = signTexture(text)
    signMat.emissiveMap = signMat.map
    signMat.needsUpdate = true
  }

  // ---------- garden collision: first person can walk out of the front door, but not through the fence ----------
  const gc = colliders[0]
  const fw = 0.2
  gc.push({ minX: -PLOT.x - fw, maxX: -gate, minZ: PLOT.zBack - fw, maxZ: PLOT.zBack + fw }) // back fence, with its gate gap
  gc.push({ minX: gate, maxX: PLOT.x + fw, minZ: PLOT.zBack - fw, maxZ: PLOT.zBack + fw })
  // the playground's big frames (swings, slide, the station boards); everything small out here you float through
  playground.solids.forEach(c => gc.push(c))
  // your garden's side fences
  gc.push({ minX: -PLOT.x - fw, maxX: -PLOT.x + fw, minZ: PLOT.zBack, maxZ: PLOT.zFront })
  gc.push({ minX: PLOT.x - fw, maxX: PLOT.x + fw, minZ: PLOT.zBack, maxZ: PLOT.zFront })
  gc.push({ minX: -PLOT.x, maxX: -gate, minZ: PLOT.zFront - fw, maxZ: PLOT.zFront + fw }) // front fence, with the gate gap
  gc.push({ minX: gate, maxX: PLOT.x, minZ: PLOT.zFront - fw, maxZ: PLOT.zFront + fw })

  // ---------- the open ground outside the fences: the whole neighbourhood is yours to wander ----------
  // You can walk all round the outside of every plot, between the homes, along the cliff and out to the
  // playground. Only the neighbours' fenced gardens, the stream and the cliff railing stop you, and an invisible
  // edge where the land starts to rise (behind the homes) or the world ends (past the last home either side).
  const [walkL, walkR] = opts.walk || [-PLOT.x, PLOT.x]
  const L = Math.min(walkL - 2, -PLAYGROUND.x - 1), R = Math.max(walkR + 2, PLAYGROUND.x + 1) // a little room past the outermost fence
  const BACK = -7.6 // behind the homes the hills start: the band you can walk ends here (but the playground is open)
  const PG = PLAYGROUND
  gc.push({ minX: L - 3, maxX: L, minZ: PG.zFar - 3, maxZ: CLIFF_Z + 2 }) // the far left
  gc.push({ minX: R, maxX: R + 3, minZ: PG.zFar - 3, maxZ: CLIFF_Z + 2 }) // the far right
  gc.push({ minX: L, maxX: R, minZ: CLIFF_Z - 0.7 - fw, maxZ: CLIFF_Z + 2 }) // the cliff railing
  gc.push({ minX: L, maxX: -PG.x, minZ: PG.zFar - 3, maxZ: BACK }) // the hills behind, either side of the playground
  gc.push({ minX: PG.x, maxX: R, minZ: PG.zFar - 3, maxZ: BACK })
  gc.push({ minX: -PG.x, maxX: PG.x, minZ: PG.zFar - 3, maxZ: PG.zFar }) // the playground's far edge
  // the neighbours' gardens are theirs: walk round them, and up to their gates
  ;(opts.plots || []).forEach(({ x, half }) => gc.push({ minX: x - half - fw, maxX: x + half + fw, minZ: NEIGHBOUR_PLOT_Z[0] - fw, maxZ: NEIGHBOUR_PLOT_Z[1] + fw }))
  // the stream runs down to the waterfall in a little valley; it is crossed on the deck along the cliff walk
  for (let z = BACK; z < PLOT.zFront - 0.6; z += 0.5) {
    const sx = streamX(z + 0.25)
    gc.push({ minX: sx - 3.2, maxX: sx + 3.2, minZ: z, maxZ: z + 0.5, stream: true })
  }

  // ---------- global lights: an evening sky (rose above, violet below) and the low sun over the sea ----------
  const lights = new THREE.Group()
  const hemi = new THREE.HemisphereLight('#5a6cb8', '#22203e', 0.75) // night: blue sky light, dark ground
  lights.add(hemi)
  const moon = new THREE.DirectionalLight('#9fb4ff', 1.3) // moonlight: the scene's one shadow-casting key light
  moon.target.position.set(0, 5.5, 0)
  moon.position.set(4.5, 5.5 + 9, 22) // from the moon over the sea, so the front of the house is silvered
  moon.castShadow = true
  moon.shadow.mapSize.set(2048, 2048) // rendered once (see game.js), so the size is cheap
  const sc = moon.shadow.camera
  sc.left = -17; sc.right = 17; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 70
  moon.shadow.bias = -0.0005
  moon.shadow.normalBias = 0.04
  lights.add(moon, moon.target)
  // coloured rim lights, like the neon spill in the references: they graze the glossy surfaces from both sides
  const rimL = new THREE.DirectionalLight('#b06cff', 0.7)
  rimL.position.set(-18, 7, 8)
  const rimR = new THREE.DirectionalLight('#ff8a5a', 0.5)
  rimR.position.set(18, 5, 10)
  lights.add(rimL, rimR)

  // ---------- the garden: swap the fence or the sign for ones from the shop ----------
  const fenceRuns = [
    [-PLOT.x, PLOT.zBack, -gate, PLOT.zBack], [gate, PLOT.zBack, PLOT.x, PLOT.zBack], [-PLOT.x, PLOT.zBack, -PLOT.x, PLOT.zFront], [PLOT.x, PLOT.zBack, PLOT.x, PLOT.zFront],
    [-PLOT.x, PLOT.zFront, -gate, PLOT.zFront], [gate, PLOT.zFront, PLOT.x, PLOT.zFront],
  ]
  function setFence(tier) {
    itemFence.clear()
    defaultFence.visible = !tier
    if (!tier) return
    const item = ITEM_BY_ID[`fences-${tier}`]
    fenceRuns.forEach(([x0, z0, x1, z1]) => {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.ceil(len / 2.8)
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n
        const seg = buildItem(item)
        seg.scale.x = len / (n * 2.8)
        seg.position.set(x0 + (x1 - x0) * t, -0.5, z0 + (z1 - z0) * t)
        seg.rotation.y = Math.atan2(-(z1 - z0), x1 - x0)
        itemFence.add(seg)
      }
    })
  }
  function setSign(tier) {
    if (itemSign) { group.remove(itemSign.group); itemSign = null }
    defaultSign.visible = !tier
    if (!tier) return
    const g = new THREE.Group()
    const api = buildSign(tier, g, signText)
    g.position.set(SX, -0.5, SZ)
    group.add(g)
    itemSign = { group: g, setText: api.setText }
  }

  // ---------- furnishing: put the layouts on the grid ----------
  const roomById = id => rooms.find(r => r.id === id)
  const prepared = new Set()
  function applyLight(r, light) {
    if (!light) {
      // every lamp is off: only dim moonlight coming in through the window
      const w = WINDOWS[r.id].x
      r.light.intensity = 2.4; r.light.position.set((w[0] + w[1]) / 2, 3.0, -1.6); r.light.color.set('#8fa4e8')
      r.fill.intensity = 1.2; r.fill.color.set('#7f8fd0')
      r.sh.setCove(false)
      return
    }
    r.sh.setCove(true)
    r.fill.intensity = 5.5; r.fill.color.set('#ffd58a')
    r.light.color.set(light.color)
    // the room light follows its lamp but keeps well clear of the walls and ceiling: right next to a wall it
    // burns a bright hot spot onto the paint
    const cl = (v, m) => Math.min(Math.max(v, -m), m)
    r.light.position.set(cl(light.x, HX - 1.6), Math.min(Math.max(light.y, 2.2), 3.6), cl(light.z, HZ - 1.4))
    r.light.intensity = light.power
  }
  /** rebuild one area from its layout entries; bake=false keeps the pieces separate (while editing) */
  let switches = opts.switches || {}
  function furnish(areaId, entries, { bakeIt = true } = {}) {
    if (areaId === 'garden') {
      gardenPlaced.clear()
      const { group: g } = furnishArea(gardenArea(), entries, { y0: -0.5, switches })
      gardenPlaced.add(g)
      if (bakeIt) { gardenPlaced.updateMatrixWorld(true); bake(gardenPlaced, { clone: true }) }
      return
    }
    const r = roomById(areaId)
    r.placed.clear()
    const { group: g, light } = furnishArea(r.areaSpec || areaSpec(areaId), entries, { switches })
    r.placed.add(g)
    applyLight(r, light)
    if (bakeIt) { group.updateMatrixWorld(true); bake(g) }
    r.furnished = entries
  }
  function setStyle(roomId, st) {
    const r = roomById(roomId)
    r.sh.setPaint(st?.paint ? paintTexture(st.paint) : null)
    r.sh.setFloor(st?.floor ? floorTex(st.floor) : null)
  }
  rooms.forEach(r => { r.areaSpec = areaSpec(r.id) })
  rooms.map(r => r.id).forEach(id => {
    furnish(id, opts.layout?.[id] || [], { bakeIt: false })
    setStyle(id, opts.style?.[id])
    prepared.add(id)
  })
  furnish('garden', opts.layout?.garden || [], { bakeIt: false })
  setFence(opts.fence || 0)
  setSign(opts.sign || 0)

  // ---------- merge everything static into a few meshes ----------
  group.updateMatrixWorld(true)
  shells.forEach((sh, k) => {
    bake(sh.root, { exclude: [...Object.values(sh.walls), sh.ceiling, rooms[k].placed] })
    bake(rooms[k].placed)
    Object.values(sh.walls).forEach(w => bake(w, { clone: true }))
    bake(sh.ceiling, { clone: true })
  })
  bake(roof, { clone: true })
  bake(garden)
  bake(defaultFence)
  bake(gardenPlaced, { clone: true })
  bake(street, { clone: true })
  bake(playground.group)
  // the low moon throws the house's shadow 20 m back; the playground stays out of it, so it never sits in the dark
  playground.group.traverse(o => { if (o.isMesh) o.receiveShadow = false })

  // the room with the front door; and the staircase (only the two-storey house has one)
  const entry = rooms.find(r => r.door) || rooms[0]
  const living = rooms.find(r => r.id === 'living')
  const stairs = living ? {
    x: living.ox + STAIR.x,
    footZ: STAIR.zFoot,
    topZ: STAIR.zTop,
    startZ: STAIR.zStart,
    landingZ: -1.9,
    hole: { x0: living.ox + STAIR_HOLE.x0, z0: STAIR_HOLE.z0, z1: STAIR_HOLE.z1 },
  } : null

  return {
    group, lights, rooms, colliders, frames, roof, roofBase, stairs, setName, streetProps: street,
    /** the outdoor light for a time of day: moonlit night, or a warm evening */
    setDaylight(time) {
      const ev = time === 'evening'
      hemi.color.set(ev ? '#c890c0' : '#5a6cb8'); hemi.groundColor.set(ev ? '#3a2656' : '#22203e'); hemi.intensity = ev ? 0.8 : 0.75
      moon.color.set(ev ? '#ffa66e' : '#9fb4ff'); moon.intensity = ev ? 1.7 : 1.3
      moon.position.set(4.5, 5.5 + (ev ? 7.5 : 9), 22)
    },
    furnish, setStyle, setFence, setSign, roomById, gardenPlaced,
    setSwitches(next) { switches = next },
    /** show only one room (for editing it) or, with null, the whole house again */
    isolate(areaId) {
      const all = !areaId
      rooms.forEach(r => { r.sh.root.visible = all || areaId === 'garden' || r.id === areaId })
      const outside = areaId === 'garden' || all
      roof.visible = outside
      ;[garden, defaultFence, itemFence, gardenPlaced, gateGroup, playground.group].forEach(o => { o.visible = outside })
      defaultFence.visible = outside && !itemFence.children.length
      itemFence.visible = outside
      defaultSign.visible = outside && !itemSign
      if (itemSign) itemSign.group.visible = outside
    },
    door: { pivot: entry.door, x: entry.ox + entry.doorX, z: HZ + 0.15 },
    gates: [{ leaves: gateLeaves, z: PLOT.zFront }, { leaves: backGateLeaves, z: PLOT.zBack }],
    playground,
    bounds: { halfW: PLOT.x + 0.6, yMin: -1.25, yMax: roofBase + rh },
  }
}

import { areaOf } from '../game/areas.js'
const areaSpec = id => areaOf(id)
