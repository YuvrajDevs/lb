import * as THREE from 'three'

/**
 * Finds places that will flicker ("z-fighting"): two faces of different materials that lie in the same plane,
 * face the same way and overlap. Run it from the console with ?debug: __cc.debug.zfight().
 * Returns a list of { at: [x, y, z], a, b } where a and b describe the two surfaces (colour, object path).
 */
export function findZFighting(root, { tolerance = 0.004, maxReports = 60 } = {}) {
  root.updateMatrixWorld(true)
  const buckets = new Map()
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3()
  const dStep = 0.01

  const describe = o => {
    const path = []
    for (let a = o; a && path.length < 4; a = a.parent) if (a.userData?.itemId || a.name) path.push(a.userData?.itemId || a.name)
    const m = o.material
    return `${m.type.replace('Material', '')} #${m.color?.getHexString?.() ?? '?'}${path.length ? ' in ' + path.join('/') : ''}`
  }
  const visibleChain = o => { for (let a = o; a; a = a.parent) if (!a.visible) return false; return true }

  root.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material) || !visibleChain(o)) return
    const m = o.material
    if (m.isShaderMaterial || m.blending === THREE.AdditiveBlending || m.transparent) return // effects, glass and water are fine
    if (m.polygonOffset && !m.userData.settled) return // water, beams: offset on purpose
    const pos = o.geometry.attributes.position
    const idx = o.geometry.index
    const count = idx ? idx.count : pos.count
    for (let t = 0; t < count; t += 3) {
      for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, idx ? idx.getX(t + k) : t + k).applyMatrix4(o.matrixWorld)
      e1.subVectors(v[1], v[0]); e2.subVectors(v[2], v[0]); n.crossVectors(e1, e2)
      const area = n.length() / 2
      if (area < 1e-4) continue
      n.normalize()
      const d = n.dot(v[0])
      const nk = `${Math.round(n.x * 100)},${Math.round(n.y * 100)},${Math.round(n.z * 100)}`
      const box = new THREE.Box3().setFromPoints(v)
      const tri = { o, mat: m.uuid, color: m.color?.getHex?.(), box, d, n: n.clone() }
      const key = `${nk}|${Math.round(d / dStep)}`
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(tri)
    }
  })

  const reports = []
  const seen = new Set()
  // a face pressed against something solid (the back of a cupboard against a wall, the underside of a box on the
  // floor) can never be seen, so its overlap cannot flicker: look a couple of centimetres out from the face
  const solids = []
  const matsOf = o => (Array.isArray(o.material) ? o.material : [o.material])
  // (faded walls count as solid too: they are only see-through while the camera is outside them)
  root.traverse(o => { if (o.isMesh && visibleChain(o) && matsOf(o).every(m => m.blending !== THREE.AdditiveBlending && !m.isShaderMaterial && (!m.transparent || m.userData.base === 1))) solids.push(o) })
  const probe = new THREE.Raycaster()
  probe.far = 30
  const fn = new THREE.Vector3()
  const buried = (p, nn) => {
    probe.set(p.clone().addScaledVector(nn, 0.002), nn)
    const hits = probe.intersectObjects(solids, false)
    if (!hits.length) return false
    if (hits[0].distance < 0.03) return true // pressed against something
    // inside a solid: a surface met first (from inside) faces the same way we are looking. Several surfaces can
    // sit at that same distance (two walls back to back), so check all of them.
    return hits.filter(h => h.distance < hits[0].distance + 0.001).some(h => fn.copy(h.face.normal).transformDirection(h.object.matrixWorld).dot(nn) > 0.2)
  }
  // look at both sides of every surface while probing (a face inside a wall only meets the wall's far faces)
  const sides = solids.flatMap(o => matsOf(o).map(m => [m, m.side]))
  sides.forEach(([m]) => { m.side = THREE.DoubleSide })
  const restore = () => sides.forEach(([m, side]) => { m.side = side })
  const overlapArea = (a, b, nn) => {
    // overlap of the two boxes measured in the plane (drop the axis the normal points along)
    const ax = Math.abs(nn.x), ay = Math.abs(nn.y), az = Math.abs(nn.z)
    const dims = ax >= ay && ax >= az ? ['y', 'z'] : ay >= az ? ['x', 'z'] : ['x', 'y']
    let s = 1
    for (const k of dims) {
      const lo = Math.max(a.box.min[k], b.box.min[k]), hi = Math.min(a.box.max[k], b.box.max[k])
      if (hi - lo < 0.01) return 0
      s *= hi - lo
    }
    return s
  }
  for (const [key, list] of buckets) {
    // also compare against the neighbouring distance bucket (planes 0-1 cm apart may round differently)
    const [nk, dk] = key.split('|')
    const near = list.concat(buckets.get(`${nk}|${+dk + 1}`) || [])
    if (near.length < 2) continue
    const cap = Math.min(near.length, 600)
    for (let i = 0; i < Math.min(list.length, cap); i++) {
      for (let j = i + 1; j < cap; j++) {
        const a = near[i], b = near[j]
        if (a.mat === b.mat || a.color === b.color) continue // same look: even if they overlap, nothing visibly flickers
        if (Math.abs(a.d - b.d) > tolerance) continue
        if (overlapArea(a, b, a.n) < 0.002) continue
        // the middle of the shared area, on the plane
        const c = new THREE.Vector3().copy(a.box.min).max(b.box.min).add(new THREE.Vector3().copy(a.box.max).min(b.box.max)).multiplyScalar(0.5)
        if (buried(c, a.n)) continue
        const spot = `${Math.round(c.x * 2)},${Math.round(c.y * 2)},${Math.round(c.z * 2)}`
        if (seen.has(spot)) continue
        seen.add(spot)
        reports.push({ at: [c.x, c.y, c.z].map(x => +x.toFixed(2)), n: [a.n.x, a.n.y, a.n.z].map(x => +x.toFixed(2)), a: describe(a.o), b: describe(b.o) })
        if (reports.length >= maxReports) { restore(); return reports }
      }
    }
  }
  restore()
  return reports
}

/**
 * The safety net: every solid material gets a small, fixed drawing priority (a polygon offset picked from its
 * colour). Where two differently coloured faces do end up in the same plane, one of them now always wins instead
 * of the two taking turns every frame. Materials that already set their own offset (water, beams) are left alone.
 * Cheap to call repeatedly: each material is settled once.
 */
export function settleCoplanar(root) {
  root.traverse(o => {
    if (!o.isMesh) return
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m.userData.settled || m.isShaderMaterial || m.blending === THREE.AdditiveBlending) continue
      m.userData.settled = true
      if (m.polygonOffset) continue
      const hex = m.color ? m.color.getHex() : 0
      const rank = ((hex * 2654435761) >>> 0) % 7
      m.polygonOffset = true
      m.polygonOffsetFactor = 0
      m.polygonOffsetUnits = -rank * 0.5
    }
  })
}
