import * as THREE from 'three'
import { buildItem } from './items/index.js'
import { createCube } from './cube.js'
import { ITEMS, ITEM_BY_ID } from '../game/catalog.js'

// Renders each shop item once into a small transparent picture, on a single shared offscreen renderer.
// Pictures are cached, and requests are queued so opening a shop tab never blocks the UI.

const SIZE = 320
let renderer, scene, camera
const cache = new Map()
const waiting = new Map() // id -> [resolve]
const queue = []
let busy = false

function init() {
  if (renderer) return
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setSize(SIZE, SIZE)
  renderer.setPixelRatio(1)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.setClearColor(0x000000, 0)
  scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight('#dfe6ff', '#6a5a78', 1.5))
  const key = new THREE.DirectionalLight('#fff0d8', 2.6)
  key.position.set(-4, 7, 6)
  scene.add(key)
  const rim = new THREE.DirectionalLight('#8fb0ff', 1.2)
  rim.position.set(5, 3, -5)
  scene.add(rim)
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
}

function modelFor(item) {
  if (item.cat === 'skins') {
    const c = createCube('#ff8fb8')
    c.setSkin(item.tier)
    c.group.userData.cube = true
    return c.group
  }
  const g = buildItem(item, { text: 'Our Home' })
  if (item.cat === 'hats') {
    const c = createCube('#ff8fb8')
    c.setHat(item.tier)
    c.group.userData.cube = true
    return c.group
  }
  return g
}

function draw(item) {
  init()
  const model = modelFor(item)
  scene.add(model)
  model.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(model)
  // sprite glows are huge and would shrink the object: measure meshes only
  const meshBox = new THREE.Box3()
  model.traverse(o => { if (o.isMesh && !o.isSprite) meshBox.union(new THREE.Box3().setFromObject(o)) })
  const b = meshBox.isEmpty() ? box : meshBox
  const size = b.getSize(new THREE.Vector3())
  const center = b.getCenter(new THREE.Vector3())
  const cube = model.userData.cube
  if (cube) { center.y += 0.0; size.set(1.5, 1.7, 1.5) }
  const r = Math.max(size.x, size.y * 1.1, size.z) * 0.5 + 0.28
  const dist = r / Math.tan((camera.fov * Math.PI) / 360) * 1.15
  const dir = new THREE.Vector3(0.62, 0.52, 0.9).normalize()
  camera.position.copy(center).addScaledVector(dir, dist)
  camera.lookAt(center)
  camera.updateProjectionMatrix()
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(model)
  model.traverse(o => { o.geometry?.dispose?.() })
  return url
}

function pump() {
  if (busy) return
  busy = true
  const step = () => {
    const t0 = performance.now()
    while (queue.length && performance.now() - t0 < 14) {
      const id = queue.shift()
      try {
        const url = draw(ITEM_BY_ID[id])
        cache.set(id, url)
        waiting.get(id)?.forEach(r => r(url))
      } catch (e) {
        console.warn('preview failed', id, e)
        waiting.get(id)?.forEach(r => r(null))
      }
      waiting.delete(id)
    }
    if (queue.length) setTimeout(step, 0)
    else busy = false
  }
  setTimeout(step, 0)
}

/** resolves with a PNG data URL for the item */
export function previewOf(id, urgent = true) {
  if (cache.has(id)) return Promise.resolve(cache.get(id))
  return new Promise(resolve => {
    if (waiting.has(id)) {
      waiting.get(id).push(resolve)
      if (urgent) { const i = queue.indexOf(id); if (i > 0) { queue.splice(i, 1); queue.unshift(id) } }
    } else {
      waiting.set(id, [resolve])
      if (urgent) queue.unshift(id)
      else queue.push(id)
      pump()
    }
  })
}

export function cachedPreview(id) { return cache.get(id) || null }
export function prefetchPreviews(ids = ITEMS.map(i => i.id)) { ids.forEach(id => previewOf(id, false)) }

// ---- the cube with a chosen skin + hat (wardrobe preview), cached by combination ----
const comboCache = new Map()
export function previewCube(skinTier, hatTier) {
  const key = `${skinTier || 0}-${hatTier || 0}`
  if (comboCache.has(key)) return comboCache.get(key)
  init()
  const c = createCube('#ff8fb8')
  c.setSkin(skinTier || null)
  c.setHat(hatTier || null)
  scene.add(c.group)
  c.group.updateMatrixWorld(true)
  camera.position.set(2.7, 2.5, 3.9)
  camera.lookAt(0, 0.5, 0)
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(c.group)
  comboCache.set(key, url)
  return url
}
