import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const SIZE = 0.9
const bodyGeo = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 5, 0.14)
const eyeGeo = new THREE.CircleGeometry(0.1, 28)
const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffffff' })

/** A blocky little person. Origin is at its feet; it faces local +z. */
export function createCube(color) {
  const group = new THREE.Group()
  const pivot = new THREE.Group() // squash & stretch happens here, anchored at the feet
  group.add(pivot)

  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
  const glow = 0.12 // keeps the cube readable in the dark room
  mat.emissive = new THREE.Color(color).multiplyScalar(glow)
  const body = new THREE.Mesh(bodyGeo, mat)
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

  let blinkAt = 2 + Math.random() * 3
  let phase = Math.random() * 6

  return {
    group,
    setVisible(v) { group.visible = v },
    setColor(c) { mat.color.set(c); mat.emissive.set(c).multiplyScalar(glow) },
    update(t, dt, moving) {
      phase += dt * (moving ? 11 : 2.2)
      if (moving) {
        const hop = Math.abs(Math.sin(phase))
        group.position.y = hop * 0.18
        pivot.scale.set(1 + (1 - hop) * 0.06, 1 - (1 - hop) * 0.08, 1 + (1 - hop) * 0.06)
      } else {
        group.position.y = 0
        const b = Math.sin(phase) * 0.012
        pivot.scale.set(1 - b, 1 + b * 1.5, 1 - b)
      }
      // blink
      const k = t - blinkAt
      const closed = k > 0 && k < 0.12
      eyes.forEach(e => (e.scale.y = closed ? 0.1 : 1))
      if (k > 0.12) blinkAt = t + 2 + Math.random() * 4
    },
  }
}
