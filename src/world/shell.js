import * as THREE from 'three'
import {
  W, D, H, T, HX, HZ, std, box, cyl, wall, woodMat, tatamiTexture, plankTexture, gingham, eveningSky,
  labelTexture, makeFrame, rectFloor, rectsAround,
} from './kit.js'

const DARK = '#6a4630'
const EDGE = '#efe3bf'

/**
 * The empty room: slab, floor, four walls (doorways optional), trim, window with curtains,
 * ceiling, and three picture frames on the inner face of the open front wall.
 * Everything is in room-local coordinates (origin = centre of the floor).
 */
export function makeShell(spec) {
  const {
    name, wall: wallColor = '#e9d9a4', floor = 'tatami', doorL = null, doorR = null,
    win = [-2.2, 0.6], curtain = ['#2f9a52', '#bfe3b8'], holeFloor = null, holeCeil = null,
    ceilWood = '#b98a50', frameKinds = [0, 3, 2], skyKind = 0,
  } = spec

  const root = new THREE.Group()
  const colliders = []
  const solid = (minX, maxX, minZ, maxZ) => colliders.push({ minX, maxX, minZ, maxZ })
  const frames = []

  // ---------- slab + floor (pieces, so a stairwell hole can be cut) ----------
  const slabMat = std(EDGE, { emissive: '#8a6a3c', emissiveIntensity: 0.55 })
  const floorTex = floor === 'wood' ? plankTexture('#c89a5e') : tatamiTexture()
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: floor === 'wood' ? 0.6 : 0.95 })
  rectsAround(holeFloor).forEach(([x0, x1, z0, z1]) => {
    // widen the slab to cover the wall footprint where the piece touches an outer edge
    const sx0 = x0 <= -HX + 1e-6 ? -HX - T : x0
    const sx1 = x1 >= HX - 1e-6 ? HX + T : x1
    const sz0 = z0 <= -HZ + 1e-6 ? -HZ - T : z0
    const sz1 = z1 >= HZ - 1e-6 ? HZ + T : z1
    box(root, [sx1 - sx0, 0.5, sz1 - sz0], [(sx0 + sx1) / 2, -0.5, (sz0 + sz1) / 2], slabMat)
    root.add(rectFloor(x0, x1, z0, z1, 0.001, floorMat))
  })

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 0.34),
    new THREE.MeshStandardMaterial({
      map: labelTexture(name), roughness: 0.8, emissive: '#c9a46a', emissiveMap: labelTexture(name), emissiveIntensity: 0.5,
    })
  )
  label.position.set(0, -0.27, HZ + T + 0.005)
  root.add(label)

  // ---------- walls ----------
  const walls = { back: new THREE.Group(), left: new THREE.Group(), front: new THREE.Group(), right: new THREE.Group() }
  Object.values(walls).forEach(w => root.add(w))

  const WX0 = win[0], WX1 = win[1], WY0 = 2.0, WY1 = 4.2
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

  const front = wall(W, H, T, [], wallColor, EDGE)
  front.position.set(-HX, 0, HZ)
  walls.front.add(front)

  // wall colliders (with doorway gaps)
  solid(-HX - T, HX + T, -HZ - T, -HZ)
  solid(-HX - T, HX + T, HZ, HZ + T)
  const sideWall = (x0, x1, door) => {
    if (!door) return solid(x0, x1, -HZ, HZ)
    solid(x0, x1, -HZ, door[0])
    solid(x0, x1, door[1], HZ)
  }
  sideWall(-HX - T, -HX, doorL)
  sideWall(HX, HX + T, doorR)

  // ---------- trim ----------
  const rail = (parent, len, axis, fixed, y, h, d, off = 0) => {
    if (axis === 'x') box(parent, [len, h, d], [off, y, fixed], DARK)
    else box(parent, [d, h, len], [fixed, y, off], DARK)
  }
  rail(walls.back, W, 'x', -HZ + 0.07, 3.95, 0.2, 0.14)
  rail(walls.back, W, 'x', -HZ + 0.07, 0, 0.3, 0.14)
  rail(walls.front, W, 'x', HZ - 0.07, 3.95, 0.2, 0.14)
  rail(walls.front, W, 'x', HZ - 0.07, 0, 0.3, 0.14)
  const sideTrim = (g, x, door) => {
    rail(g, D, 'z', x, 3.95, 0.2, 0.14)
    if (!door) return rail(g, D, 'z', x, 0, 0.3, 0.14)
    const a = door[0] + HZ, b = HZ - door[1]
    if (a > 0.01) rail(g, a, 'z', x, 0, 0.3, 0.14, -HZ + a / 2)
    if (b > 0.01) rail(g, b, 'z', x, 0, 0.3, 0.14, HZ - b / 2)
    // door frame
    const sgn = x < 0 ? 1 : -1
    ;[door[0], door[1]].forEach(z => box(g, [0.18, 3.5, 0.16], [x + sgn * 0.02, 0.0, z], DARK))
    box(g, [0.18, 0.2, door[1] - door[0] + 0.16], [x + sgn * 0.02, 3.4, (door[0] + door[1]) / 2], DARK)
  }
  sideTrim(walls.left, -HX + 0.07, doorL)
  sideTrim(walls.right, HX - 0.07, doorR)

  ;[-HX + 0.1, -3.4, 2.4, HX - 0.1].forEach(x => {
    if (x > WX0 - 0.3 && x < WX1 + 0.3) return
    box(walls.back, [0.2, H - 0.3, 0.14], [x, 0.3, -HZ + 0.07], DARK)
  })
  ;[-HX + 0.1, -2.2, 2.2, HX - 0.1].forEach(x => box(walls.front, [0.2, H - 0.3, 0.14], [x, 0.3, HZ - 0.07], DARK))
  ;[-HZ + 0.1, HZ - 0.1].forEach(z => {
    box(walls.left, [0.14, H - 0.3, 0.2], [-HX + 0.07, 0.3, z], DARK)
    box(walls.right, [0.14, H - 0.3, 0.2], [HX - 0.07, 0.3, z], DARK)
  })

  // ---------- window ----------
  const wz = -HZ - T / 2
  const wxm = (WX0 + WX1) / 2
  const frameC = '#f6f0e2'
  box(walls.back, [WX1 - WX0 + 0.4, 0.14, 0.4], [wxm, WY0 - 0.14, wz], frameC)
  box(walls.back, [WX1 - WX0 + 0.3, 0.14, 0.34], [wxm, WY1, wz], frameC)
  box(walls.back, [0.14, WY1 - WY0, 0.34], [WX0 - 0.07, WY0, wz], frameC)
  box(walls.back, [0.14, WY1 - WY0, 0.34], [WX1 + 0.07, WY0, wz], frameC)
  box(walls.back, [0.1, WY1 - WY0, 0.2], [wxm, WY0, wz], frameC)
  box(walls.back, [WX1 - WX0, 0.08, 0.2], [wxm, (WY0 + WY1) / 2 - 0.04, wz], frameC)
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(WX1 - WX0, WY1 - WY0),
    new THREE.MeshStandardMaterial({ color: '#ffe6c4', transparent: true, opacity: 0.1, roughness: 0.1 })
  )
  glass.position.set(wxm, (WY0 + WY1) / 2, wz + 0.02)
  walls.back.add(glass)

  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(WX1 - WX0 + 1.8, 3.3),
    new THREE.MeshBasicMaterial({ map: eveningSky(skyKind), toneMapped: false })
  )
  sky.position.set(wxm, 2.85, -HZ - T - 0.3)
  walls.back.add(sky)

  const curtainTex = gingham(curtain[0], curtain[1])
  const makeCurtain = (cx, w) => {
    const geo = new THREE.PlaneGeometry(w, 2.6, 24, 1)
    const p = geo.attributes.position
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / w) * Math.PI * 6) * 0.05)
    geo.computeVertexNormals()
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: curtainTex, roughness: 0.95, side: THREE.DoubleSide }))
    m.position.set(cx, 4.3 - 1.3, -HZ + 0.22)
    m.castShadow = true
    m.receiveShadow = true
    walls.back.add(m)
  }
  makeCurtain(WX0 - 0.15, 1.0)
  makeCurtain(WX1 + 0.15, 1.0)
  cyl(walls.back, 0.04, WX1 - WX0 + 2.0, [wxm, 4.4, -HZ + 0.2], '#8a6a4a', {}, 8).rotation.z = Math.PI / 2

  // fairy lights along the back wall
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#ffe3a0', emissive: '#ffc864', emissiveIntensity: 2.2 })
  for (let i = 0; i <= 18; i++) {
    const x = -5.0 + i * (10 / 18)
    const sag = Math.sin((i / 18) * Math.PI * 3) * 0.12
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), bulbMat)
    b.position.set(x, 4.5 - Math.abs(sag), -HZ + 0.2)
    walls.back.add(b)
  }

  // frames on the inside of the open front wall (shown from inside / eyes view)
  frames.push(
    makeFrame(walls.front, 1.8, 2.2, [-3.4, 3.7, HZ - 0.03], Math.PI, frameKinds[0]),
    makeFrame(walls.front, 2.6, 1.8, [0.1, 3.6, HZ - 0.03], Math.PI, frameKinds[1]),
    makeFrame(walls.front, 1.8, 2.2, [3.6, 3.7, HZ - 0.03], Math.PI, frameKinds[2])
  )

  // ---------- ceiling (pieces, so the stairwell opens through it) ----------
  const ceiling = new THREE.Group()
  const planks = woodMat(ceilWood, W / 3, D / 3, { dark: 0.07, vertical: true })
  rectsAround(holeCeil).forEach(([x0, x1, z0, z1]) => {
    const sx0 = x0 <= -HX + 1e-6 ? -HX - T : x0
    const sx1 = x1 >= HX - 1e-6 ? HX + T : x1
    const sz0 = z0 <= -HZ + 1e-6 ? -HZ - T : z0
    const sz1 = z1 >= HZ - 1e-6 ? HZ + T : z1
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx1 - sx0, 0.22, sz1 - sz0), planks)
    m.position.set((sx0 + sx1) / 2, H + 0.11, (sz0 + sz1) / 2)
    m.receiveShadow = true
    ceiling.add(m)
  })
  ;[-HX + 0.15, -3.5, 0, 3.5, HX - 0.15].forEach(x => {
    if (holeCeil && x + 0.11 > holeCeil.x0) return
    box(ceiling, [0.22, 0.2, D], [x, H - 0.2, 0], DARK)
  })
  ;[-HZ + 0.15, HZ - 0.15].forEach(z => box(ceiling, [holeCeil ? holeCeil.x0 + HX : W, 0.2, 0.22], [holeCeil ? (-HX + holeCeil.x0) / 2 : 0, H - 0.2, z], DARK))
  root.add(ceiling)

  return { root, walls, ceiling, colliders, solid, frames, win: [WX0, WX1] }
}
