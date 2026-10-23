import * as THREE from 'three'
import { canvas, finish, box, cyl, sphere } from './kit.js'
import { glow } from './fx.js'

const em = (c, i = 1.8) => ({ emissive: c, emissiveIntensity: i })
const GOLD = '#d4a838'

export const DEFAULT_SKIN = { color: '#ff8fb8', tex: null, glow: 0.3 }

function heart(x, cx, cy, s) {
  x.beginPath()
  x.moveTo(cx, cy + s * 0.9)
  x.bezierCurveTo(cx - s * 1.6, cy - s * 0.2, cx - s * 0.8, cy - s * 1.3, cx, cy - s * 0.4)
  x.bezierCurveTo(cx + s * 0.8, cy - s * 1.3, cx + s * 1.6, cy - s * 0.2, cx, cy + s * 0.9)
  x.fill()
}

/** appearance for each skin tier: base colour, optional pattern texture, emissive glow */
export function skinSpec(tier) {
  const colors = ['#ffb59a', '#8fe3c0', '#9ad0ff', '#ffe08a', '#c3a6ff', '#e0527a', '#ff9a6a', '#1c2250', '#ffb0d0', '#ffffff']
  const color = colors[tier - 1]
  if (tier <= 3) return { color, tex: null, glow: 0.3 }
  const [c, x] = canvas(128, 128)
  x.fillStyle = color
  x.fillRect(0, 0, 128, 128)
  if (tier === 4) { x.fillStyle = '#fff6d0'; for (let i = 0; i < 128; i += 32) x.fillRect(0, i, 128, 16) }
  if (tier === 5) { x.fillStyle = '#ede6ff'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(16 + i * 32 + (j % 2) * 16, 16 + j * 32, 7, 0, 7); x.fill() } }
  if (tier === 6) { x.fillStyle = '#fff0f4'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) x.fillRect(i * 32, j * 32, 32, 32) }
  if (tier === 7) { const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#ffcf6a'); gr.addColorStop(0.5, '#ff8a6a'); gr.addColorStop(1, '#c0408a'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128) }
  if (tier === 8) { for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(255,248,220,${0.4 + ((i * 7) % 6) / 10})`; const s = i % 7 === 0 ? 4 : 2; x.fillRect((i * 53) % 128, (i * 37) % 128, s, s) } x.fillStyle = '#f4f1e4'; x.beginPath(); x.arc(94, 34, 10, 0, 7); x.fill(); x.fillStyle = '#1c2250'; x.beginPath(); x.arc(99, 30, 9, 0, 7); x.fill() }
  if (tier === 9) { x.fillStyle = '#fff0f6'; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) heart(x, 21 + i * 43 + (j % 2) * 10, 24 + j * 40, 8) }
  if (tier === 10) { const gr = x.createLinearGradient(0, 0, 128, 128); ['#ff6a8a', '#ffd25a', '#7bffb0', '#5ac8ff', '#b08cff'].forEach((col, i) => gr.addColorStop(i / 4, col)); x.fillStyle = gr; x.fillRect(0, 0, 128, 128) }
  return { color: tier === 10 ? '#ffffff' : '#ffffff', tex: finish(c), glow: tier === 10 ? 0.55 : tier === 8 ? 0.25 : 0.3, emissiveColor: tier === 10 ? '#ffffff' : null }
}

/** hats sit on top of the cube: origin at the centre of its top face, y = 0 is the top surface */
export function buildHat(tier, g) {
  const pink = '#ff6fa3'
  if (tier === 1) {
    cyl(g, 0.42, 0.24, [0, 0, 0], '#e8566e', {}, 20).scale.set(1, 1, 1)
    cyl(g, 0.45, 0.08, [0, 0, 0], '#fff0e0', {}, 20)
    sphere(g, 0.12, [0, 0.34, 0], '#fff0e0')
  } else if (tier === 2) {
    box(g, [0.2, 0.2, 0.12], [0, 0, 0], pink)
    const l = box(g, [0.3, 0.26, 0.1], [-0.22, 0, 0], pink); l.rotation.z = 0.35
    const r = box(g, [0.3, 0.26, 0.1], [0.22, 0, 0], pink); r.rotation.z = -0.35
    g.position.set(0.18, 0.02, 0.05)
  } else if (tier === 3) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3f78b8', roughness: 0.8 }))
    g.add(dome)
    box(g, [0.5, 0.05, 0.3], [0, 0.0, 0.5], '#2f5a90')
  } else if (tier === 4) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 14), new THREE.MeshStandardMaterial({ color: '#ff7ac8', roughness: 0.7 }))
    cone.position.y = 0.35
    g.add(cone)
    ;[0.12, 0.28, 0.44].forEach((y, i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.26 - i * 0.07, 0.025, 6, 16), new THREE.MeshStandardMaterial({ color: '#ffe08a' })); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r) })
    sphere(g, 0.08, [0, 0.72, 0], '#ffe08a')
  } else if (tier === 5) {
    [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), new THREE.MeshStandardMaterial({ color: '#2f3138' })); e.position.set(s * 0.26, 0.17, 0); e.rotation.z = -s * 0.15; e.rotation.y = Math.PI / 4; g.add(e); const inner = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 4), new THREE.MeshStandardMaterial({ color: '#ff9ec8' })); inner.position.set(s * 0.26, 0.15, 0.06); inner.rotation.z = -s * 0.15; inner.rotation.y = Math.PI / 4; g.add(inner) })
  } else if (tier === 6) {
    const cols = ['#ff8ab0', '#ffe08a', '#ffffff', '#b896f0', '#ff8ab0', '#ffe08a', '#ffffff', '#b896f0']
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; sphere(g, 0.085, [Math.sin(a) * 0.4, 0.06 + (i % 2) * 0.05, Math.cos(a) * 0.4], cols[i % 8]); if (i % 3 === 0) sphere(g, 0.1, [Math.sin(a) * 0.4, 0.11, Math.cos(a) * 0.4], '#5fae7a') }
  } else if (tier === 7) {
    cyl(g, 0.5, 0.05, [0, 0, 0], '#1d1f2a', {}, 24)
    cyl(g, 0.3, 0.45, [0, 0.03, 0], '#1d1f2a', {}, 20)
    cyl(g, 0.31, 0.08, [0, 0.07, 0], '#e8566e', {}, 20)
  } else if (tier === 8) {
    cyl(g, 0.52, 0.04, [0, 0, 0], '#4a3a9a', {}, 24)
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.95, 16), new THREE.MeshStandardMaterial({ color: '#5a46c0', roughness: 0.7 }))
    cone.position.set(0.05, 0.5, 0); cone.rotation.z = -0.12
    g.add(cone)
    ;[[-0.1, 0.25, 0.3], [0.15, 0.5, 0.25], [0.05, 0.7, 0.18]].forEach(([x, y, z]) => { sphere(g, 0.04, [x, y, z], '#fff4c0', em('#ffe08a', 2.4)); glow(g, [x, y, z], '#ffe08a', 0.4, 0.8) })
    cyl(g, 0.36, 0.06, [0, 0.04, 0], '#ffd25a', {}, 20)
  } else if (tier === 9) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 28), new THREE.MeshStandardMaterial({ color: '#fff4c0', ...em('#ffe29a', 2.4) }))
    r.rotation.x = Math.PI / 2; r.position.y = 0.35
    g.add(r)
    glow(g, [0, 0.35, 0], '#ffe29a', 1.8, 0.8)
  } else {
    cyl(g, 0.4, 0.2, [0, 0, 0], GOLD, { metalness: 0.7, roughness: 0.25 }, 20)
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 4), new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.7, roughness: 0.25 })); sp.position.set(Math.sin(a) * 0.36, 0.33, Math.cos(a) * 0.36); g.add(sp); sphere(g, 0.045, [Math.sin(a) * 0.36, 0.5, Math.cos(a) * 0.36], i % 2 ? '#e8566e' : '#5aa7e8', em(i % 2 ? '#e8566e' : '#5aa7e8', 1.6)) }
    sphere(g, 0.07, [0, 0.12, 0.4], '#e8566e', em('#e8566e', 1.8))
    glow(g, [0, 0.3, 0], '#ffd25a', 2.0, 0.5)
  }
}
