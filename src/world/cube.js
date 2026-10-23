import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const SIZE = 0.9
export const FLOAT = 0.95 // gap between floor and the cube's underside: about seat height of the chair
const bodyGeo = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 5, 0.14)
const eyeGeo = new THREE.CircleGeometry(0.1, 28)
const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })

function blobTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62)
  gr.addColorStop(0, 'rgba(30,15,30,0.55)')
  gr.addColorStop(1, 'rgba(30,15,30,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}
const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })

/** A blocky little person that floats. Origin is on the floor under it; it faces local +z. */
export function createCube(color) {
  const group = new THREE.Group()
  const floatNode = new THREE.Group()
  const pivot = new THREE.Group() // lean + squash happen here, anchored at the cube's underside
  group.add(floatNode)
  floatNode.add(pivot)

  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.55, emissive: new THREE.Color(color).multiplyScalar(0.3) }))
  body.position.y = SIZE / 2
  body.castShadow = true
  body.receiveShadow = true
  pivot.add(body)

  const eyes = [-1, 1].map(s => {
    const e = new THREE.Mesh(eyeGeo, eyeMat)
    e.position.set(s * 0.19, 0.07, SIZE / 2 + 0.002)
    body.add(e)
    return e
  })

  // soft contact shadow on the floor under the cube
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), blobMat)
  blob.rotation.x = -Math.PI / 2
  blob.position.y = 0.025
  group.add(blob)

  let blinkAt = 2 + Math.random() * 3
  let phase = Math.random() * 6
  let lean = 0

  return {
    group,
    setVisible(v) { group.visible = v },
    update(t, dt, moving) {
      phase += dt * (moving ? 4.2 : 1.6)
      const bob = Math.sin(phase) * (moving ? 0.05 : 0.07)
      floatNode.position.y = FLOAT + bob
      lean += ((moving ? 0.14 : 0) - lean) * Math.min(1, dt * 8)
      pivot.rotation.x = lean
      const s = 1 - bob * 0.5
      blob.scale.setScalar(s)

      const k = t - blinkAt
      const closed = k > 0 && k < 0.12
      eyes.forEach(e => (e.scale.y = closed ? 0.1 : 1))
      if (k > 0.12) blinkAt = t + 2 + Math.random() * 4
    },
  }
}
