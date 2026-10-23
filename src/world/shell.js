import * as THREE from 'three'
import {
  W, D, H, T, HX, HZ, std, box, wall, plankTexture, eveningSky,
  labelTexture, makeFrame, rectFloor, rectsAround,
} from './kit.js'
import { wash } from './fx.js'
import { addExterior } from './exterior.js'

const TRIM = '#f3eee4'
const EDGE = '#efe7d6'

/**
 * The empty room, kept deliberately plain so the lighting does the talking:
 * slab, plank floor, four walls (doorways optional), skirting, a window onto the night sky,
 * a flat ceiling, and three picture frames on the inside of the open front wall.
 * Everything is in room-local coordinates (origin = centre of the floor).
 */
export function makeShell(spec) {
  const {
    name, wall: wallColor = '#ece6dc', floorColor = '#b98a5a', doorL = null, doorR = null,
    win = [-2.2, 0.6], holeFloor = null, holeCeil = null, frameKinds = [0, 3, 2], skyKind = 0,
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
  const floorMat = new THREE.MeshStandardMaterial({ map: plankTexture(floorColor), roughness: 0.7 })
  rectsAround(holeFloor).forEach(([x0, x1, z0, z1]) => {
    const sx0 = x0 <= -HX + 1e-6 ? -HX - T : x0
    const sx1 = x1 >= HX - 1e-6 ? HX + T : x1
    const sz0 = z0 <= -HZ + 1e-6 ? -HZ - T : z0
    const sz1 = z1 >= HZ - 1e-6 ? HZ + T : z1
    box(root, [sx1 - sx0, 0.5, sz1 - sz0], [(sx0 + sx1) / 2, -0.5, (sz0 + sz1) / 2], slabMat)
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

  const WX0 = win[0], WX1 = win[1], WY0 = 2.1, WY1 = 4.1
  const back = wall(W + 2 * T, H, T, [[WX0 + HX + T, WY0, WX1 + HX + T, WY1]], wallColor, EDGE)
  back.position.set(-HX - T, 0, -HZ - T)
  walls.back.add(back)

  const doorHole = d => (d ? [[d[0] + HZ, 0.02, d[1] + HZ, 3.4]] : [])
  const left = wall(D + T, H, T, doorHole(doorL), wallColor, EDGE)
  left.rotation.y = -Math.PI / 2
  left.position.set(-HX, 0, -HZ)
  walls.left.add(left)

  const right = wall(D + T, H, T, doorHole(doorR), wallColor, EDGE)
  right.rotation.y = -Math.PI / 2
  right.position.set(HX + T, 0, -HZ)
  walls.right.add(right)

  const front = wall(W, H, T, doorFront != null ? [[doorFront - 0.8 + HX, 0.02, doorFront + 0.8 + HX, 3.2]] : [], wallColor, EDGE)
  front.position.set(-HX, 0, HZ)
  walls.front.add(front)

  // wall colliders (with doorway gaps)
  solid(-HX - T, HX + T, -HZ - T, -HZ)
  if (doorFront != null) {
    solid(-HX - T, doorFront - 0.8, HZ, HZ + T)
    solid(doorFront + 0.8, HX + T, HZ, HZ + T)
  } else solid(-HX - T, HX + T, HZ, HZ + T)
  const sideWall = (x0, x1, door) => {
    if (!door) return solid(x0, x1, -HZ, HZ)
    solid(x0, x1, -HZ, door[0])
    solid(x0, x1, door[1], HZ)
  }
  sideWall(-HX - T, -HX, doorL)
  sideWall(HX, HX + T, doorR)

  // ---------- skirting + door frames (the only trim) ----------
  box(walls.back, [W, 0.28, 0.08], [0, 0, -HZ + 0.04], TRIM)
  box(walls.front, [W, 0.28, 0.08], [0, 0, HZ - 0.04], TRIM)
  const sideTrim = (g, x, door) => {
    if (!door) return box(g, [0.08, 0.28, D], [x, 0, 0], TRIM)
    const a = door[0] + HZ, b = HZ - door[1]
    if (a > 0.01) box(g, [0.08, 0.28, a], [x, 0, -HZ + a / 2], TRIM)
    if (b > 0.01) box(g, [0.08, 0.28, b], [x, 0, HZ - b / 2], TRIM)
    const sgn = x < 0 ? 1 : -1
    ;[door[0], door[1]].forEach(z => box(g, [0.16, 3.5, 0.14], [x + sgn * 0.04, 0, z], TRIM))
    box(g, [0.16, 0.16, door[1] - door[0] + 0.14], [x + sgn * 0.04, 3.38, (door[0] + door[1]) / 2], TRIM)
  }
  sideTrim(walls.left, -HX + 0.04, doorL)
  sideTrim(walls.right, HX - 0.04, doorR)

  // ---------- window onto the night ----------
  const wz = -HZ - T / 2
  const wxm = (WX0 + WX1) / 2
  box(walls.back, [WX1 - WX0 + 0.36, 0.14, 0.4], [wxm, WY0 - 0.14, wz], TRIM)
  box(walls.back, [WX1 - WX0 + 0.28, 0.12, 0.34], [wxm, WY1, wz], TRIM)
  box(walls.back, [0.12, WY1 - WY0, 0.34], [WX0 - 0.06, WY0, wz], TRIM)
  box(walls.back, [0.12, WY1 - WY0, 0.34], [WX1 + 0.06, WY0, wz], TRIM)
  box(walls.back, [0.08, WY1 - WY0, 0.18], [wxm, WY0, wz], TRIM)
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(WX1 - WX0 + 1.6, 3.0),
    new THREE.MeshBasicMaterial({ map: eveningSky(skyKind), toneMapped: false })
  )
  sky.position.set(wxm, 2.95, -HZ - T - 0.3)
  walls.back.add(sky)

  // ---------- decoration that makes the plain box feel designed ----------
  // wainscot panelling + a chair rail, on every wall except across doorways
  const wain = (g, axis, fixed, len, off = 0) => {
    if (axis === 'x') {
      box(g, [len, 1.1, 0.05], [off, 0, fixed], wainscot)
      box(g, [len, 0.08, 0.09], [off, 1.1, fixed + (fixed < 0 ? 0.02 : -0.02)], TRIM)
    } else {
      box(g, [0.05, 1.1, len], [fixed, 0, off], wainscot)
      box(g, [0.09, 0.08, len], [fixed + (fixed < 0 ? 0.02 : -0.02), 1.1, off], TRIM)
    }
  }
  wain(walls.back, 'x', -HZ + 0.025, W)
  wain(walls.front, 'x', HZ - 0.025, W)
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
  const strip = std('#fff3d8', { emissive: cove, emissiveIntensity: 2.2 })
  box(walls.back, [W - 0.4, 0.05, 0.05], [0, H - 0.2, -HZ + 0.15], strip)
  box(walls.left, [0.05, 0.05, D - 0.4], [-HX + 0.15, H - 0.2, 0], strip)
  box(walls.right, [0.05, 0.05, D - 0.4], [HX - 0.15, H - 0.2, 0], strip)
  wash(walls.back, [0, H - 0.95, -HZ + 0.06], W - 0.6, 1.5, cove, 0.3)
  wash(walls.left, [-HX + 0.06, H - 0.95, 0], D - 0.6, 1.5, cove, 0.24, Math.PI / 2)
  wash(walls.right, [HX - 0.06, H - 0.95, 0], D - 0.6, 1.5, cove, 0.24, Math.PI / 2)

  // outside: cladding, windows, shutters, door/porch or balcony (see exterior.js)
  const { door } = addExterior(walls, {
    ...ext, extLeft: !!ext.extLeft, extRight: !!ext.extRight, backHole: [WX0, WX1, WY0, WY1],
  })

  // frames on the inside of the open front wall (visible from inside / eyes view)
  frames.push(
    makeFrame(walls.front, 1.7, 2.1, [-3.4, 3.5, HZ - 0.03], Math.PI, frameKinds[0]),
    makeFrame(walls.front, 2.5, 1.7, [0.1, 3.4, HZ - 0.03], Math.PI, frameKinds[1]),
    makeFrame(walls.front, 1.7, 2.1, [3.6, 3.5, HZ - 0.03], Math.PI, frameKinds[2])
  )

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
