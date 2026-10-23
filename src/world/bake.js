import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * Merges every static mesh under `group` into one mesh per material (and shadow flags), so a whole
 * room costs a handful of draw calls instead of hundreds. `clone: true` gives the merged meshes their
 * own copies of the materials, which is needed for groups that fade out (walls, ceilings, roof).
 */
export function bake(group, { clone = false, exclude = [] } = {}) {
  group.updateWorldMatrix(true, true)
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert()
  const skip = new Set(exclude)
  const buckets = new Map()
  const remove = []

  const visit = o => {
    if (skip.has(o)) return
    if (o.isMesh && !o.userData.keep && !Array.isArray(o.material) && o.geometry.index) {
      const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}`
      let b = buckets.get(key)
      if (!b) buckets.set(key, (b = { material: o.material, cast: o.castShadow, receive: o.receiveShadow, geos: [] }))
      const g = o.geometry.clone()
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name)
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
      g.clearGroups()
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))
      b.geos.push(g)
      remove.push(o)
    }
    [...o.children].forEach(visit)
  }
  ;[...group.children].forEach(visit)

  remove.forEach(o => {
    o.parent.remove(o)
    o.geometry.dispose()
  })

  const mats = new Map()
  buckets.forEach(b => {
    const merged = mergeGeometries(b.geos, false)
    b.geos.forEach(g => g.dispose())
    let material = b.material
    if (clone) {
      if (!mats.has(material)) mats.set(material, material.clone())
      material = mats.get(material)
    }
    const mesh = new THREE.Mesh(merged, material)
    mesh.castShadow = b.cast
    mesh.receiveShadow = b.receive
    group.add(mesh)
  })
}
