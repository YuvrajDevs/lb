import * as THREE from 'three'
import {
  W, D, H, T, HX, HZ, std, box, wall, plankTexture,
  labelTexture, makeFrame, rectFloor, rectsAround,
} from './kit.js'
import { wash } from './fx.js'
import { addExterior } from './exterior.js'
import { FRONT_WIN, SIDE_WIN, BALCONY_DOOR } from '../game/areas.js'

const TRIM = '#f3eee4'
const EDGE = '#efe7d6'

/**
 * The empty room, kept deliberately plain so the lighting does the talking:
 * slab, plank floor, four walls (doorways optional), skirting, a real window looking out at the land behind,
 * a flat ceiling, and three picture frames on the inside of the open front wall.
 * Everything is in room-local coordinates (origin = centre of the floor).
 */
export function makeShell(spec) {
  const {
    name, wall: wallColor = '#ece6dc', floorColor = '#b98a5a', doorL = null, doorR = null,
    win = [-2.2, 0.6], winY = [1.25, 4.25], holeFloor = null, holeCeil = null, frameKinds = [0, 3, 2],
    wainscot = '#c9bfae', cove = '#ffd9a0',
    ext = { storey: 'upper', color: '#a9c4b0', batten: '#bcd4c2', windows: [-3.2, 3.2] },
  } = spec
  const doorFront = ext.doorFront ?? null

  const root = new THREE.Group()
  const colliders = []
  const solid = (minX, maxX, minZ, maxZ) => colliders.push({ minX, maxX, minZ, maxZ })
  const frames = []

  // ---------- slab + floor (pieces, so a stairwell hole can be cut) ----------
  const slabMat = std(EDGE, { emissive: '#6c5a3c', emissiveIntensity: 0.35 })
  // lacquered floor: a clear coat on top, so lamps and windows leave soft reflections and a sheen
  const floorMat = new THREE.MeshPhysicalMaterial({ map: plankTexture(floorColor), roughness: 0.34, metalness: 0.0, clearcoat: 0.7, clearcoatRoughness: 0.22, envMapIntensity: 1 })
  rectsAround(holeFloor).forEach(([x0, x1, z0, z1]) => {
    const sx0 = x0 <= -HX + 1e-6 ? -HX - T : x0
    const sx1 = x1 >= HX - 1e-6 ? HX + T : x1
    const sz0 = z0 <= -HZ + 1e-6 ? -HZ - T : z0
    const sz1 = z1 >= HZ - 1e-6 ? HZ + T : z1
    // the slab's top sits 1 cm under the floor boards (1 mm was too close: they flickered from afar)
    box(root, [sx1 - sx0, 0.49, sz1 - sz0], [(sx0 + sx1) / 2, -0.5, (sz0 + sz1) / 2], slabMat)
    root.add(rectFloor(x0, x1, z0, z1, 0.001, floorMat))
  })

  const labelTex = labelTexture(name)
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.3),
    new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.8, emissive: '#d8c9a8', emissiveMap: labelTex, emissiveIntensity: 0.35 })
  )
  label.position.set(0, -0.27, HZ + T + 0.005)
  root.add(label)

  // ---------- walls ----------
  const walls = { back: new THREE.Group(), left: new THREE.Group(), front: new THREE.Group(), right: new THREE.Group() }
  Object.values(walls).forEach(w => root.add(w))

  const WX0 = win[0], WX1 = win[1], WY0 = winY[0], WY1 = winY[1]
  const back = wall(W + 2 * T, H, T, [[WX0 + HX + T, WY0, WX1 + HX + T, WY1]], wallColor, EDGE)
  back.position.set(-HX - T, 0, -HZ - T)
  walls.back.add(back)

  // real openings: the front windows (and the bedroom's balcony door), and windows on the outer side walls.
  // `openings` keeps them in wall coordinates: front ones by x, side ones by z.
  const frontOpen = [
    ...(ext.windows || []).map(x => ({ c: x, w: FRONT_WIN.w, y: FRONT_WIN.y })),
    ...(ext.balcony != null ? [{ c: ext.balcony, w: BALCONY_DOOR.w, y: BALCONY_DOOR.y, door: true }] : []),
  ]
  const sideOpen = SIDE_WIN.z.map(z => ({ c: z, w: SIDE_WIN.w, y: SIDE_WIN.y }))
  const leftOpen = ext.extLeft ? sideOpen : []
  const rightOpen = ext.extRight ? sideOpen : []
  const sideHoles = list => list.map(o => [o.c - o.w / 2 + HZ, o.y[0], o.c + o.w / 2 + HZ, o.y[1]])
  const doorHole = d => (d ? [[d[0] + HZ, 0.02, d[1] + HZ, 3.4]] : [])
  const left = wall(D + T, H, T, [...doorHole(doorL), ...sideHoles(leftOpen)], wallColor, EDGE)
  left.rotation.y = -Math.PI / 2
  left.position.set(-HX, 0, -HZ)
  walls.left.add(left)

  const right = wall(D + T, H, T, [...doorHole(doorR), ...sideHoles(rightOpen)], wallColor, EDGE)
  right.rotation.y = -Math.PI / 2
  right.position.set(HX + T, 0, -HZ)
  walls.right.add(right)

  const front = wall(W, H, T, [
    ...(doorFront != null ? [[doorFront - 0.8 + HX, 0.02, doorFront + 0.8 + HX, 3.2]] : []),
    ...frontOpen.map(o => [o.c - o.w / 2 + HX, o.y[0], o.c + o.w / 2 + HX, o.y[1]]),
  ], wallColor, EDGE)
  front.position.set(-HX, 0, HZ)
  walls.front.add(front)

  // wall colliders (with doorway gaps)
  solid(-HX - T, HX + T, -HZ - T, -HZ)
  // the front wall, with gaps for the front door and the balcony doorway
  const frontGaps = [
    ...(doorFront != null ? [[doorFront - 0.8, doorFront + 0.8]] : []),
    ...(ext.balcony != null ? [[ext.balcony - BALCONY_DOOR.w / 2, ext.balcony + BALCONY_DOOR.w / 2]] : []),
  ].sort((a, b) => a[0] - b[0])
  const frontRuns = []
  ;[...frontGaps, [HX, HX]].reduce((from, [a, b]) => { if (a - from > 0.01) frontRuns.push([from, a]); return b }, -HX)
  frontRuns.forEach(([a, b]) => solid(a === -HX ? -HX - T : a, b === HX ? HX + T : b, HZ, HZ + T))
  if (ext.balcony != null) {
    // out on the balcony: its railing (front and both ends) keeps you on it
    const bx = ext.balcony, zr = HZ + T + 1.25
    solid(bx - 1.75, bx + 1.75, zr - 0.05, zr + 0.3)
    solid(bx - 1.75, bx - 1.6, HZ + T, zr)
    solid(bx + 1.6, bx + 1.75, HZ + T, zr)
  }
  const sideWall = (x0, x1, door) => {
    if (!door) return solid(x0, x1, -HZ, HZ)
    solid(x0, x1, -HZ, door[0])
    solid(x0, x1, door[1], HZ)
  }
  sideWall(-HX - T, -HX, doorL)
  sideWall(HX, HX + T, doorR)

  // ---------- skirting + door frames (the only trim) ----------
  // (skirting starts 4 mm below the floor so its underside never shares a plane with the panelling's)
  box(walls.back, [W, 0.28, 0.08], [0, -0.004, -HZ + 0.04], TRIM)
  // the front wall's runs (skirting, panelling) stop either side of the front door and the balcony doorway,
  // 1.5 cm short of the opening so their ends never sit in the same plane as the wall's cut edge
  // (the skirting stops a centimetre before the panelling, so their ends don't share a plane either)
  const pull = d => ([a, b]) => [a === -HX ? a : a + d, b === HX ? b : b - d]
  const trimRuns = frontRuns.map(pull(0.025))
  frontRuns.map(pull(0.035)).forEach(([a, b]) => box(walls.front, [b - a, 0.28, 0.08], [(a + b) / 2, -0.004, HZ - 0.04], TRIM))
  const sideTrim = (g, x, door) => {
    if (!door) return box(g, [0.08, 0.28, D], [x, -0.004, 0], TRIM)
    const a = door[0] + HZ, b = HZ - door[1]
    if (a > 0.01) box(g, [0.08, 0.28, a], [x, -0.004, -HZ + a / 2], TRIM)
    if (b > 0.01) box(g, [0.08, 0.28, b], [x, -0.004, HZ - b / 2], TRIM)
    const sgn = x < 0 ? 1 : -1
    ;[door[0], door[1]].forEach(z => box(g, [0.16, 3.5, 0.14], [x + sgn * 0.04, 0, z], TRIM))
    box(g, [0.16, 0.16, door[1] - door[0] + 0.14], [x + sgn * 0.04, 3.38, (door[0] + door[1]) / 2], TRIM)
  }
  sideTrim(walls.left, -HX + 0.04, doorL)
  sideTrim(walls.right, HX - 0.04, doorR)

  // ---------- the window: a real opening with a thin pane of glass, so you see the actual world outside ----------
  const wz = -HZ - T / 2
  const wxm = (WX0 + WX1) / 2
  // the frame sits just inside the opening, so none of its faces lies on the wall's own cut faces (no flicker)
  box(walls.back, [WX1 - WX0 + 0.36, 0.12, 0.44], [wxm, WY0 - 0.06, wz], TRIM) // sill: 0.44 deep, proud of both wall faces
  box(walls.back, [WX1 - WX0, 0.1, 0.34], [wxm, WY1 - 0.1, wz], TRIM)
  box(walls.back, [0.1, WY1 - WY0, 0.34], [WX0 + 0.05, WY0, wz], TRIM)
  box(walls.back, [0.1, WY1 - WY0, 0.34], [WX1 - 0.05, WY0, wz], TRIM)
  box(walls.back, [0.08, WY1 - WY0, 0.18], [wxm, WY0, wz], TRIM)
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(WX1 - WX0, WY1 - WY0),
    new THREE.MeshPhysicalMaterial({ color: '#dfe8ff', transparent: true, opacity: 0.08, roughness: 0.04, metalness: 0, depthWrite: false })
  )
  glass.position.set(wxm, (WY0 + WY1) / 2, wz)
  glass.userData.keep = true
  walls.back.add(glass)

  // the same frame and glass for the front and side openings
  const glassMat = glass.material
  const frameOpening = (g, o, along, fixed) => {
    const [y0, y1] = o.y, h = y1 - y0, a0 = o.c - o.w / 2, a1 = o.c + o.w / 2
    const put = (len, hh, dd, c, y, mat = TRIM) => box(g, along === 'x' ? [len, hh, dd] : [dd, hh, len], along === 'x' ? [c, y, fixed] : [fixed, y, c], mat)
    // inside the opening, never flush with the wall's cut faces (those would flicker against each other)
    if (y0 > 0.5) put(o.w + 0.36, 0.12, 0.44, o.c, y0 - 0.06) // sill (not under a door), proud of both wall faces
    put(o.w, 0.1, 0.34, o.c, y1 - 0.1)
    put(0.1, h, 0.34, a0 + 0.05, y0)
    put(0.1, h, 0.34, a1 - 0.05, y0)
    if (o.door) return // a doorway: no middle bar, no glass
    put(0.06, h, 0.16, o.c, y0)
    const p = new THREE.Mesh(new THREE.PlaneGeometry(o.w, h), glassMat)
    p.position.set(along === 'x' ? o.c : fixed, (y0 + y1) / 2, along === 'x' ? fixed : o.c)
    if (along === 'z') p.rotation.y = Math.PI / 2
    p.userData.keep = true
    g.add(p)
  }
  frontOpen.forEach(o => frameOpening(walls.front, o, 'x', HZ + T / 2))
  leftOpen.forEach(o => frameOpening(walls.left, o, 'z', -HX - T / 2))
  rightOpen.forEach(o => frameOpening(walls.right, o, 'z', HX + T / 2))

  // ---------- decoration that makes the plain box feel designed ----------
  // wainscot panelling + a chair rail, on every wall except across doorways
  const wain = (g, axis, fixed, len, off = 0) => {
    if (axis === 'x') {
      box(g, [len, 1.1, 0.05], [off, 0.002, fixed], wainscot)
      box(g, [len, 0.08, 0.09], [off, 1.1, fixed + (fixed < 0 ? 0.02 : -0.02)], TRIM)
    } else {
      box(g, [0.05, 1.1, len], [fixed, 0.002, off], wainscot)
      box(g, [0.09, 0.08, len], [fixed + (fixed < 0 ? 0.02 : -0.02), 1.1, off], TRIM)
    }
  }
  wain(walls.back, 'x', -HZ + 0.025, W)
  trimRuns.forEach(([a, b]) => wain(walls.front, 'x', HZ - 0.025, b - a, (a + b) / 2))
  const sidePanel = (g, x, door) => {
    if (!door) return wain(g, 'z', x, D)
    const a = door[0] + HZ, b = HZ - door[1]
    if (a > 0.05) wain(g, 'z', x, a, -HZ + a / 2)
    if (b > 0.05) wain(g, 'z', x, b, HZ - b / 2)
  }
  sidePanel(walls.left, -HX + 0.025, doorL)
  sidePanel(walls.right, HX - 0.025, doorR)

  // crown moulding
  box(walls.back, [W, 0.14, 0.12], [0, H - 0.14, -HZ + 0.06], TRIM)
  box(walls.front, [W, 0.14, 0.12], [0, H - 0.14, HZ - 0.06], TRIM)
  box(walls.left, [0.12, 0.14, D], [-HX + 0.06, H - 0.14, 0], TRIM)
  box(walls.right, [0.12, 0.14, D], [HX - 0.06, H - 0.14, 0], TRIM)

  // hidden cove light: a glowing strip under the crown that washes colour down the walls
  const strip = std('#fff3d8', { emissive: cove, emissiveIntensity: 1.2 })
  box(walls.back, [W - 0.4, 0.05, 0.05], [0, H - 0.2, -HZ + 0.15], strip)
  box(walls.left, [0.05, 0.05, D - 0.4], [-HX + 0.15, H - 0.2, 0], strip)
  box(walls.right, [0.05, 0.05, D - 0.4], [HX - 0.15, H - 0.2, 0], strip)
  // (the back wall's wash stops at the window, so no glowing film hangs across the glass)
  ;[[-HX + 0.3, WX0 - 0.2], [WX1 + 0.2, HX - 0.3]].forEach(([a, b]) => { if (b - a > 0.3) wash(walls.back, [(a + b) / 2, H - 0.95, -HZ + 0.06], b - a, 1.5, cove, 0.18) })
  // side washes stop at side windows too
  const sideWash = (g, x, list) => {
    const cuts = [-HZ + 0.3, ...list.flatMap(o => [o.c - o.w / 2 - 0.2, o.c + o.w / 2 + 0.2]), HZ - 0.3]
    for (let k = 0; k < cuts.length; k += 2) if (cuts[k + 1] - cuts[k] > 0.3) wash(g, [x, H - 0.95, (cuts[k] + cuts[k + 1]) / 2], cuts[k + 1] - cuts[k], 1.5, cove, 0.15, Math.PI / 2)
  }
  sideWash(walls.left, -HX + 0.06, leftOpen)
  sideWash(walls.right, HX - 0.06, rightOpen)

  // outside: cladding, windows, shutters, door/porch or balcony (see exterior.js)
  const { door } = addExterior(walls, {
    ...ext, extLeft: !!ext.extLeft, extRight: !!ext.extRight, backHole: [WX0, WX1, WY0, WY1],
  })

  // frames on the inside of the open front wall (visible from inside / eyes view)
  // (the room with the front door skips the frame that would hang across it)
  // (a frame is skipped where it would hang across the door or a window)
  const clear = (x, w) => !frontOpen.some(o => Math.abs(o.c - x) < (o.w + w) / 2 + 0.2) && !(doorFront != null && Math.abs(doorFront - x) < 0.8 + w / 2 + 0.2)
  // hung at eye height (centres about 2.4 m up, where a cube's eyes are)
  ;[[1.7, 2.1, -3.4, 2.45, 0], [2.5, 1.7, 0.1, 2.4, 1], [1.7, 2.1, 3.6, 2.45, 2]].forEach(([w, h, x, y, k]) => {
    if (clear(x, w)) frames.push(makeFrame(walls.front, w, h, [x, y, HZ - 0.03], Math.PI, frameKinds[k]))
  })

  // ---------- flat ceiling (pieces, so the stairwell opens through it) ----------
  const ceiling = new THREE.Group()
  const ceilMat = std('#e9e2d4')
  rectsAround(holeCeil).forEach(([x0, x1, z0, z1]) => {
    const sx0 = x0 <= -HX + 1e-6 ? -HX - T : x0
    const sx1 = x1 >= HX - 1e-6 ? HX + T : x1
    const sz0 = z0 <= -HZ + 1e-6 ? -HZ - T : z0
    const sz1 = z1 >= HZ - 1e-6 ? HZ + T : z1
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx1 - sx0, 0.22, sz1 - sz0), ceilMat)
    m.position.set((sx0 + sx1) / 2, H + 0.11, (sz0 + sz1) / 2)
    m.receiveShadow = true
    ceiling.add(m)
  })
  root.add(ceiling)

  // ---------- things the player can restyle: wall paint and floor ----------
  const wallFaces = [back, left, right, front].map(m => m.material[0])
  const defaultFloor = floorMat.map
  const setPaint = tex => {
    wallFaces.forEach(m => {
      m.map = tex || null
      m.color.set(tex ? '#ffffff' : wallColor)
      m.needsUpdate = true
    })
  }
  const setFloor = tex => {
    floorMat.map = tex || defaultFloor
    floorMat.needsUpdate = true
  }

  return { root, walls, ceiling, colliders, solid, frames, door, doorX: doorFront, win: [WX0, WX1], setPaint, setFloor }
}
