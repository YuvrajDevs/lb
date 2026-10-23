import * as THREE from 'three'
import { WARM_YELLOW } from './furniture.js'
import { std, box, cyl, sphere, canvas, finish, gingham, artTexture } from '../kit.js'
import { glow, pool } from '../fx.js'

const em = (c, i = 1.8) => ({ emissive: c, emissiveIntensity: i })
const at = (arr, t) => arr[t - 1]
const GOLD = '#d4a838'
const METAL = { metalness: 0.6, roughness: 0.3 }

function flat(g, w, d, tex, y = 0.015, round = false) {
  const geo = round ? new THREE.CylinderGeometry(w / 2, w / 2, 0.04, 48) : new THREE.BoxGeometry(w, 0.04, d)
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }))
  m.position.y = y
  g.add(m)
  return m
}

function rugTexture(t) {
  const [c, x] = canvas(256, 256)
  const base = at(['#c9b79c', '#e8a0a0', '#3a3f5c', '#9ab8d8', '#f2e8d0', '#b8a0d8', '#232a5a', '#f0b040', '#7a1f3a', '#15203a'], t)
  const alt = at(['#b0a088', '#fff0e0', '#f2e8d0', '#f2e8d0', '#c0524a', '#8fc8a0', '#f4e8a8', '#d8402a', '#d4a838', '#1a3a4a'], t)
  x.fillStyle = base; x.fillRect(0, 0, 256, 256)
  x.fillStyle = alt
  if (t === 2) for (let i = 0; i < 256; i += 48) x.fillRect(i, 0, 24, 256)
  if (t === 3) for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) x.fillRect(i * 32, j * 32, 32, 32)
  if (t === 4) { x.beginPath(); x.arc(128, 128, 90, 0, 7); x.fill(); x.fillStyle = base; x.beginPath(); x.arc(128, 128, 60, 0, 7); x.fill() }
  if (t === 5 || t === 9) { x.strokeStyle = alt; x.lineWidth = 16; x.strokeRect(14, 14, 228, 228); x.lineWidth = 5; x.strokeRect(40, 40, 176, 176) }
  if (t === 6) { const cols = ['#e8566e', '#f2d14a', '#5aa7e8', '#7bb26a', '#b896f0']; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = cols[(i * 2 + j) % 5]; x.fillRect(i * 64 + 3, j * 64 + 3, 58, 58) } }
  if (t === 7) { x.fillStyle = alt; x.beginPath(); x.arc(128, 128, 56, 0, 7); x.fill(); x.fillStyle = base; x.beginPath(); x.arc(150, 118, 48, 0, 7); x.fill(); for (let i = 0; i < 24; i++) { x.fillStyle = '#fff'; x.fillRect((i * 97) % 256, (i * 53) % 256, 3, 3) } }
  if (t === 8) { for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? alt : '#f8d070'; x.beginPath(); x.moveTo(128, 128); x.arc(128, 128, 150, (i / 16) * Math.PI * 2, ((i + 1) / 16) * Math.PI * 2); x.fill() } x.fillStyle = base; x.beginPath(); x.arc(128, 128, 36, 0, 7); x.fill() }
  if (t === 9) { x.fillStyle = alt; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(128, 70 + i * 6); x.lineTo(160 + i * 6, 128); x.lineTo(128, 186 - i * 6); x.lineTo(96 - i * 6, 128); x.closePath(); x.lineWidth = 3; x.strokeStyle = alt; x.stroke() } }
  if (t === 10) { for (let i = 0; i < 5; i++) { const gr = x.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, ['#5fffd0', '#b08cff', '#5fb0ff'][i % 3]); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.globalAlpha = 0.55; x.fillRect(0, i * 52, 256, 40) } x.globalAlpha = 1 }
  return finish(c)
}

export function rug(t, g) {
  const round = t === 4 || t === 7 || t === 8
  const w = 2.2 + t * 0.12
  flat(g, w, round ? w : w * 0.7, rugTexture(t), 0.02, round)
  if (t === 10) glow(g, [0, 0.1, 0], '#8bffd0', w * 1.5, 0.35)
  if (t >= 9) box(g, [w, 0.05, 0.08], [0, 0.02, -w * 0.35 - 0.04], GOLD, METAL)
}

export function plant(t, g) {
  const pot = at(['#d9d2c4', '#c8683a', '#e8a06a', '#7bb26a', '#2f3138', '#f2efe6', '#9a6a4a', '#ffd9e4', '#bff0ff', GOLD], t)
  const leaf = ['#4f9a6a', '#5fae7a', '#3f8a5c', '#4a9a52']
  const potH = 0.25 + t * 0.04
  cyl(g, 0.25 + t * 0.012, potH, [0, 0, 0], pot, t >= 10 ? METAL : {}, 14)
  if (t === 1) { cyl(g, 0.02, 0.35, [0, potH, 0], leaf[0], {}, 5); sphere(g, 0.1, [0.06, potH + 0.4, 0], leaf[1]); sphere(g, 0.1, [-0.06, potH + 0.3, 0], leaf[0]) }
  else if (t === 2) { [0, 1, 2, 3, 4].forEach(i => { const a = (i / 5) * Math.PI * 2; sphere(g, 0.13, [Math.sin(a) * 0.12, potH + 0.12, Math.cos(a) * 0.12], leaf[i % 4]).scale.y = 1.5 }); sphere(g, 0.1, [0, potH + 0.25, 0], '#ff8ab0') }
  else if (t === 3) { for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const l = box(g, [0.08, 0.7, 0.08], [Math.sin(a) * 0.14, potH, Math.cos(a) * 0.14], leaf[i % 4]); l.rotation.z = Math.cos(a) * 0.5; l.rotation.x = -Math.sin(a) * 0.5 } }
  else if (t === 4) { cyl(g, 0.05, 0.6, [0, potH, 0], '#6a4a3a', {}, 6); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; box(g, [0.5, 0.05, 0.38], [Math.sin(a) * 0.25, potH + 0.5 + (i % 2) * 0.15, Math.cos(a) * 0.25], leaf[i % 4]).rotation.y = a } }
  else if (t === 5) { cyl(g, 0.05, 0.35, [0, potH, 0], '#6a4a3a', {}, 6).rotation.z = 0.2; [[0.1, 0.62, 0], [-0.12, 0.7, 0.05], [0, 0.78, -0.08]].forEach(([x, y, z], i) => box(g, [0.36, 0.1, 0.3], [x, potH + y - 0.15, z], leaf[i % 4])) }
  else if (t === 6) { cyl(g, 0.07, 1.0, [0, potH, 0], '#7a5a3a', {}, 6); [0.7, 1.0, 1.3].forEach((y, i) => sphere(g, 0.42 - i * 0.09, [0, potH + y, 0], leaf[i])) }
  else if (t === 7) { cyl(g, 0.05, 0.8, [0, potH, 0], '#7a5a3a', {}, 6); for (let i = 0; i < 5; i++) sphere(g, 0.38 - i * 0.05, [Math.sin(i * 1.2) * 0.1, potH + 0.35 + i * 0.36, Math.cos(i * 1.2) * 0.1], leaf[i % 4]) }
  else if (t === 8) { cyl(g, 0.07, 1.4, [0, potH, 0], '#6a4a3a', {}, 6); for (let i = 0; i < 9; i++) sphere(g, 0.22, [Math.sin(i * 2.4) * 0.42, potH + 1.4 + Math.cos(i * 1.7) * 0.25, Math.cos(i * 2.4) * 0.42], i % 2 ? '#ffb8d0' : '#ffd8e6'); sphere(g, 0.3, [0, potH + 1.5, 0], '#ffc8dc') }
  else if (t === 9) { for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), std(i % 2 ? '#8fe0ff' : '#b8a0ff', { ...em(i % 2 ? '#8fe0ff' : '#b8a0ff', 1.8), transparent: true, opacity: 0.9 })); c.position.set(Math.sin(i * 1.9) * 0.2, potH + 0.3 + i * 0.12, Math.cos(i * 1.9) * 0.2); c.scale.y = 2; g.add(c) } glow(g, [0, potH + 0.6, 0], '#9fd0ff', 2.8, 0.6) }
  else { cyl(g, 0.08, 1.3, [0, potH, 0], '#c8963a', METAL, 6); for (let i = 0; i < 11; i++) sphere(g, 0.2, [Math.sin(i * 2.4) * 0.45, potH + 1.3 + Math.cos(i * 1.7) * 0.28, Math.cos(i * 2.4) * 0.45], '#ffd25a', { ...em('#ffb830', 1.2), ...METAL }); glow(g, [0, potH + 1.5, 0], '#ffd25a', 3.6, 0.6) }
}

export function art(t, g) {
  const frameC = at(['#f5ecd8', '#d9a763', '#ffffff', '#2f3138', '#ffffff', '#9a6a4a', '#f4f0e8', '#1d1f2a', GOLD, '#2a3050'], t)
  const frameOne = (w, h, x, kind, col = frameC, glowCol = null) => {
    box(g, [w + 0.2, h + 0.2, 0.08], [x, 0.8 - 0.1, 0], col, col === GOLD ? METAL : {})
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: artTexture(kind, w / h), color: '#d8d0c0', roughness: 0.8 }))
    pic.position.set(x, 0.8 + h / 2 - 0.1 + 0.0, 0.05)
    pic.position.y = 0.8 - 0.1 + (h + 0.2) / 2
    g.add(pic)
    if (glowCol) { box(g, [w + 0.3, h + 0.3, 0.04], [x, 0.8 - 0.15, -0.03], '#ffffff', em(glowCol, 2)); glow(g, [x, 0.8 + h / 2, 0], glowCol, w * 3, 0.45) }
  }
  if (t === 1) frameOne(0.9, 1.2, 0, 4, '#fbf6ea')
  else if (t === 2) frameOne(0.9, 1.2, 0, 1)
  else if (t === 3) frameOne(1.0, 1.3, 0, 2)
  else if (t === 4) { frameOne(0.7, 0.9, -0.5, 1); frameOne(0.7, 0.9, 0.5, 4) }
  else if (t === 5) frameOne(1.1, 1.4, 0, 0, frameC, '#ff9cc4')
  else if (t === 6) { frameOne(0.6, 1.2, -0.75, 2); frameOne(0.6, 1.2, 0, 0); frameOne(0.6, 1.2, 0.75, 4) }
  else if (t === 7) frameOne(1.8, 1.2, 0, 3)
  else if (t === 8) frameOne(1.8, 1.2, 0, 0, frameC, '#9fd0ff')
  else if (t === 9) { frameOne(1.5, 1.9, 0, 1); box(g, [0.5, 0.12, 0.1], [0, 2.55, 0], GOLD, METAL) }
  else { frameOne(1.6, 1.6, 0, 0, frameC, '#8bffd0'); glow(g, [0, 1.6, 0], '#b08cff', 4, 0.4); for (let i = 0; i < 6; i++) sphere(g, 0.04, [Math.sin(i * 1.3) * 0.5, 1.0 + (i % 3) * 0.4, 0.1], '#ffffff', em('#ffffff', 2)) }
}

export function curtain(t, g) {
  const col = at(['#d9d2c4', '#7bb26a', '#5aa7e8', '#f4f6ff', '#c98a9a', '#6a2f5a', '#f2e8d0', '#232a5a', '#9a1f3a', '#2a3050'], t)
  box(g, [0.1, 0.1, 0.1], [-1.2, 2.55, 0], '#3a3c46'); box(g, [2.9, 0.07, 0.07], [0, 2.55, 0], t >= 9 ? GOLD : '#3a3c46', t >= 9 ? METAL : {})
  if (t === 2) { [-0.75, 0.75].forEach(x => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 0.12), new THREE.MeshStandardMaterial({ map: gingham('#2f9a52', '#bfe3b8'), roughness: 1 })); m.position.set(x * 1.4, 1.3, 0); g.add(m) }); return }
  const panel = (x, w = 0.8, c = col, o = {}) => box(g, [w, 2.45, 0.14], [x, 0.1, 0], c, o)
  if (t === 1 || t === 5 || t === 6 || t === 9) { panel(-1.0); panel(1.0) }
  if (t === 3) { [-1.0, -0.5, 0.5, 1.0].forEach((x, i) => panel(x, 0.45, i % 2 ? '#5aa7e8' : '#f4f6ff')) }
  if (t === 4) { box(g, [2.6, 2.4, 0.06], [0, 0.1, 0], '#ffffff', { transparent: true, opacity: 0.35 }) }
  if (t === 5 || t === 9) { [-1.0, 1.0].forEach(x => box(g, [0.8, 0.12, 0.2], [x, 0.9, 0.0], t === 9 ? GOLD : '#d9a763', t === 9 ? METAL : {})) }
  if (t === 7) { box(g, [2.6, 2.4, 0.05], [0, 0.1, 0], '#fff6dc', { transparent: true, opacity: 0.3 }); for (let i = 0; i < 9; i++) { const x = -1.2 + i * 0.3; cyl(g, 0.008, 2.2, [x, 0.2, 0.06], '#fff6dc', em('#ffd27a', 2), 4); for (let j = 0; j < 5; j++) sphere(g, 0.035, [x, 0.4 + j * 0.45, 0.07], '#fff6dc', em('#ffd27a', 2.4)) } glow(g, [0, 1.3, 0.2], '#ffd27a', 3.6, 0.4) }
  if (t === 8) { box(g, [2.6, 2.4, 0.08], [0, 0.1, 0], col); for (let i = 0; i < 28; i++) box(g, [0.05, 0.05, 0.03], [-1.2 + ((i * 53) % 24) * 0.1, 0.2 + ((i * 37) % 21) * 0.1, 0.06], '#fff4c0', em('#fff4c0', 2)) }
  if (t === 9) { [-1.0, 1.0].forEach(x => box(g, [0.82, 0.08, 0.16], [x, 2.4, 0], GOLD, METAL)) }
  if (t === 10) { for (let i = 0; i < 12; i++) box(g, [0.22, 2.45, 0.1], [-1.2 + i * 0.22, 0.1, 0], ['#5fffd0', '#b08cff', '#5fb0ff'][i % 3], { ...em(['#5fffd0', '#b08cff', '#5fb0ff'][i % 3], 1.2), transparent: true, opacity: 0.85 }); glow(g, [0, 1.3, 0.3], '#8bffd0', 4.4, 0.5) }
}

// ---------- style swatches (apply to the room when you own them) ----------
function wallTexture(t) {
  const [c, x] = canvas(256, 256)
  const base = at(['#f2efe6', '#c9d6c0', '#f2e2a8', '#f2c8cc', '#bcd8ee', '#ecd8c0', '#d9e8f2', '#f2d8e0', '#1c2250', '#2a2418'], t)
  x.fillStyle = base; x.fillRect(0, 0, 256, 256)
  if (t === 6) { x.fillStyle = '#d9a78a'; for (let i = 0; i < 256; i += 40) x.fillRect(i, 0, 20, 256) }
  if (t === 7) { x.fillStyle = '#7fb0e0'; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { x.beginPath(); x.arc(21 + i * 43 + (j % 2) * 20, 21 + j * 43, 7, 0, 7); x.fill() } }
  if (t === 8) { for (let k = 0; k < 7; k++) for (let j = 0; j < 7; j++) { const cx = 20 + k * 38 + (j % 2) * 19, cy = 20 + j * 38; [['#e8566e', 0], ['#f2d14a', 1.25], ['#e8566e', 2.5], ['#f2d14a', 3.75], ['#e8566e', 5]].forEach(([col, a]) => { x.fillStyle = col; x.beginPath(); x.arc(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 5, 0, 7); x.fill() }); x.fillStyle = '#7bb26a'; x.beginPath(); x.arc(cx, cy, 3, 0, 7); x.fill() } }
  if (t === 9) { for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,248,220,${0.4 + ((i * 7) % 6) / 10})`; const s = i % 9 === 0 ? 3 : 1.6; x.fillRect((i * 83) % 256, (i * 47) % 256, s, s) } }
  if (t === 10) { x.strokeStyle = '#d4a838'; x.lineWidth = 3; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.moveTo(i * 64 + 32, j * 64 + 8); x.lineTo(i * 64 + 56, j * 64 + 32); x.lineTo(i * 64 + 32, j * 64 + 56); x.lineTo(i * 64 + 8, j * 64 + 32); x.closePath(); x.stroke() } }
  return finish(c)
}

export function paint(t, g) {
  const w = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 0.14), new THREE.MeshStandardMaterial({ map: wallTexture(t), roughness: 0.95 }))
  w.position.y = 1.3
  g.add(w)
  box(g, [2.2, 0.35, 0.18], [0, 0, 0.02], '#f3eee4')
  box(g, [2.2, 0.12, 0.2], [0, 2.5, 0.02], '#f3eee4')
  if (t >= 9) glow(g, [0, 1.3, 0.3], t === 9 ? '#9fb0ff' : '#ffd27a', 3.2, 0.3)
}

function floorTexture(t) {
  const [c, x] = canvas(256, 256)
  const tone = at(['#d2a86a', '#b98a5a', '#7a4f32', '#c0905a', '#f0ece0', '#46485a', '#e8e0d0', '#f4f4f6', '#f2efe6', '#1d2a4a'], t)
  x.fillStyle = tone; x.fillRect(0, 0, 256, 256)
  if (t <= 3) for (let r = 0; r < 6; r++) { x.fillStyle = `rgba(40,25,15,${0.05 + (r % 3) * 0.04})`; x.fillRect(0, r * 43, 256, 43); x.fillStyle = 'rgba(40,25,15,0.5)'; x.fillRect(0, r * 43, 256, 2); const o = (r * 83) % 128; x.fillRect(o + 64, r * 43, 2, 43) }
  if (t === 4) { x.strokeStyle = 'rgba(40,25,15,0.5)'; x.lineWidth = 2; for (let i = -8; i < 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 256, 256); x.stroke(); x.beginPath(); x.moveTo(i * 32 + 256, 0); x.lineTo(i * 32, 256); x.stroke() } }
  if (t === 5) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#2f3138' : '#f4f0e8'; x.fillRect(i * 64, j * 64, 64, 64) }
  if (t === 6) { x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 3; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke() } }
  if (t === 7) { const cols = ['#e8566e', '#f2d14a', '#5aa7e8', '#2f3138', '#ffffff']; for (let i = 0; i < 60; i++) { x.fillStyle = cols[i % 5]; x.beginPath(); x.arc((i * 71) % 256, (i * 113) % 256, 3 + (i % 3) * 2, 0, 7); x.fill() } }
  if (t === 8 || t === 9) { x.strokeStyle = t === 9 ? 'rgba(212,168,56,0.9)' : 'rgba(150,150,170,0.5)'; x.lineWidth = t === 9 ? 3 : 1.5; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo((i * 97) % 256, 0); x.bezierCurveTo(100, 80, 180, 140, (i * 41) % 256, 256); x.stroke() } }
  if (t === 10) { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const gr = x.createLinearGradient(i * 64, j * 64, i * 64 + 64, j * 64 + 64); gr.addColorStop(0, '#5fe0ff'); gr.addColorStop(1, '#b08cff'); x.fillStyle = gr; x.globalAlpha = 0.4; x.fillRect(i * 64 + 4, j * 64 + 4, 56, 56) } x.globalAlpha = 1 }
  return finish(c)
}

export function floors(t, g) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 2.4), new THREE.MeshStandardMaterial({ map: floorTexture(t), roughness: t >= 8 ? 0.2 : 0.7, metalness: t >= 8 ? 0.2 : 0 }))
  m.position.y = 0.09
  g.add(m)
  box(g, [2.4, 0.08, 0.1], [0, 0, 1.25], '#f3eee4')
  if (t === 10) glow(g, [0, 0.2, 0], '#8bd0ff', 4.4, 0.55)
}

// ---------- garden ----------
export function fences(t, g) {
  const col = at(['#d9d2c4', '#ffffff', '#f2eadb', '#8a5a3a', '#b0524a', '#2f3138', '#3f7a52', '#c9c2b2', '#2f3138', GOLD], t)
  const L = 2.8
  const post = (x, h = 0.9, c = col) => box(g, [0.14, h, 0.14], [x, 0, 0], c)
  if (t === 1) { [-1.4, 1.4].forEach(x => post(x, 0.8, '#8a6a4a')); const r = box(g, [L, 0.05, 0.05], [0, 0.55, 0], '#d9c9a0'); r.rotation.z = 0.05 }
  else if (t === 2 || t === 3) { post(-1.4); post(1.4); for (let i = 0; i < 6; i++) box(g, [0.14, 0.75, 0.05], [-1.05 + i * 0.42, 0, 0], col); box(g, [L, 0.07, 0.05], [0, 0.55, -0.04], col); box(g, [L, 0.07, 0.05], [0, 0.2, -0.04], col); if (t === 3) for (let i = 0; i < 6; i++) box(g, [0.18, 0.08, 0.09], [-1.05 + i * 0.42, 0.75, 0], '#ffffff') }
  else if (t === 4) { for (let i = 0; i < 6; i++) cyl(g, 0.09, 0.95, [-1.2 + i * 0.48, 0, 0], col, {}, 8); box(g, [L, 0.06, 0.06], [0, 0.4, 0], '#6a4a3a') }
  else if (t === 5) { for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) box(g, [0.44, 0.22, 0.3], [-1.2 + i * 0.48 + (r % 2) * 0.22, r * 0.23, 0], r % 2 ? '#c0624a' : col) }
  else if (t === 6) { post(-1.4, 1.3); post(1.4, 1.3); for (let i = 0; i < 9; i++) { box(g, [0.04, 1.0, 0.04], [-1.2 + i * 0.3, 0, 0], col); sphere(g, 0.06, [-1.2 + i * 0.3, 1.05, 0], GOLD, METAL) } box(g, [L, 0.05, 0.05], [0, 0.9, 0], col); box(g, [L, 0.05, 0.05], [0, 0.2, 0], col) }
  else if (t === 7) { for (let i = 0; i < 7; i++) sphere(g, 0.5, [-1.2 + i * 0.4, 0.7 + (i % 2) * 0.1, 0], i % 2 ? '#3f8a5c' : col); box(g, [L, 0.4, 0.5], [0, 0, 0], '#3f7a52') }
  else if (t === 8) { box(g, [L, 0.6, 0.3], [0, 0, 0], col); box(g, [L + 0.1, 0.1, 0.36], [0, 0.6, 0], '#a8a090'); post(-1.45, 1.3, '#a8a090'); post(1.45, 1.3, '#a8a090'); [-1.45, 1.45].forEach(x => { sphere(g, 0.14, [x, 1.45, 0], '#ffe2a8', em('#ffbe70', 2.2)); glow(g, [x, 1.45, 0], '#ffbe70', 1.8, 0.7) }) }
  else if (t === 9) { post(-1.4, 1.0); post(1.4, 1.0); [0.3, 0.6, 0.9].forEach(y => { box(g, [L, 0.06, 0.06], [0, y, 0], '#bff7ff', em('#5fe0ff', 2.4)) }); glow(g, [0, 0.6, 0], '#5fe0ff', 4.4, 0.5); [0.45, 0.75].forEach(y => box(g, [L, 0.04, 0.04], [0, y, 0], '#ff5fd0', em('#ff5fd0', 2.2))) }
  else { post(-1.4, 1.6, GOLD); post(1.4, 1.6, GOLD); for (let i = 0; i < 10; i++) box(g, [0.04, 1.3, 0.04], [-1.15 + i * 0.255, 0, 0], GOLD, METAL); box(g, [L, 0.07, 0.07], [0, 1.3, 0], GOLD, METAL); box(g, [L, 0.07, 0.07], [0, 0.2, 0], GOLD, METAL); [-1.4, 1.4].forEach(x => sphere(g, 0.18, [x, 1.75, 0], '#ffe9a0', { ...em('#ffd25a', 1.6), ...METAL })); glow(g, [0, 1.0, 0], '#ffd25a', 4.6, 0.4) }
}

function signTexture(text, t) {
  const [c, x] = canvas(512, 160)
  const bg = at(['#a9844f', '#7a5a3c', '#7a5a3c', '#9a9690', '#232630', '#0c0f1a', '#f2f2f4', '#3a2a22', '#2a2418', '#0a1626'], t)
  x.fillStyle = bg; x.fillRect(0, 0, 512, 160)
  if (t <= 3) for (let y = 0; y < 160; y += 18) { x.fillStyle = y % 36 ? 'rgba(255,230,190,0.06)' : 'rgba(0,0,0,0.08)'; x.fillRect(0, y, 512, 9) }
  if (t === 3) { x.strokeStyle = '#e9d3a8'; x.lineWidth = 8; x.strokeRect(8, 8, 496, 144) }
  x.fillStyle = at(['#fff1d0', '#fff1d0', '#fff1d0', '#2f2f36', '#e8d8b8', '#ff7ae0', '#2f3138', '#ffe29a', '#ffe9a0', '#9fffe8'], t)
  x.font = '600 84px Oswald, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'
  if (t === 6) { x.shadowColor = '#ff7ae0'; x.shadowBlur = 24 }
  if (t === 10) { x.shadowColor = '#5fffd0'; x.shadowBlur = 20 }
  x.fillText(text, 256, 84, 460)
  return finish(c)
}
export { signTexture }

export function signs(t, g, text = 'Sera & DeM') {
  const w = 2.2 + (t > 6 ? 0.3 : 0)
  const mat = new THREE.MeshStandardMaterial({ map: signTexture(text, t), roughness: t === 7 ? 0.2 : 0.8, emissive: '#ffffff', emissiveMap: null, emissiveIntensity: 0 })
  if (t === 6 || t === 10 || t === 9) { mat.emissiveMap = mat.map; mat.emissive = new THREE.Color(t === 6 ? '#ff7ae0' : t === 10 ? '#5fffd0' : '#ffd25a'); mat.emissiveIntensity = t === 9 ? 0.35 : 0.9 }
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.31, 0.12), mat)
  board.position.set(0, 0.95 + w * 0.15, 0)
  g.add(board)
  if (t <= 3) { [-w / 2 + 0.15, w / 2 - 0.15].forEach(x => box(g, [0.14, 1.0, 0.14], [x, 0, 0], '#6b4a30')) }
  if (t === 4) { box(g, [w + 0.2, 0.3, 0.4], [0, 0, 0], '#8a867e') }
  if (t === 5) { [-w / 2, w / 2].forEach(x => cyl(g, 0.05, 1.6, [x, 0, 0], '#2f3138', {}, 8)); const arch = new THREE.Mesh(new THREE.TorusGeometry(w / 2, 0.05, 8, 24, Math.PI), std('#2f3138')); arch.position.y = 1.55; g.add(arch) }
  if (t === 6) { glow(g, [0, 1.1, 0.1], '#ff7ae0', 4, 0.5); [-w / 2 + 0.15, w / 2 - 0.15].forEach(x => box(g, [0.1, 1.0, 0.1], [x, 0, 0], '#2f3138')) }
  if (t === 7) { box(g, [w + 0.3, 0.25, 0.5], [0, 0, 0], '#e8e8ec'); box(g, [w + 0.1, 0.06, 0.2], [0, 0.25, 0.1], '#c0c0c8') }
  if (t === 8) { box(g, [0.08, 1.7, 0.08], [-w / 2 + 0.1, 0, 0], '#2f3138'); box(g, [w * 0.8, 0.08, 0.08], [-w * 0.1, 1.7, 0], '#2f3138'); cyl(g, 0.008, 0.2, [-w * 0.35, 1.5, 0], '#2f3138', {}, 4); cyl(g, 0.008, 0.2, [w * 0.2, 1.5, 0], '#2f3138', {}, 4); sphere(g, 0.12, [0.0, 1.6, 0.2], '#ffe2a8', em('#ffbe70', 2.4)); glow(g, [0, 1.6, 0.2], '#ffbe70', 2.4, 0.7) }
  if (t === 9) { [-w / 2 + 0.15, w / 2 - 0.15].forEach(x => box(g, [0.12, 1.0, 0.12], [x, 0, 0], GOLD, METAL)); box(g, [w + 0.1, 0.07, 0.16], [0, 0.95 + w * 0.31 + 0.05, 0], GOLD, METAL); pool(g, [0, 0, 0.8], '#ffbe70', 1.6, 0.35) }
  if (t === 10) { box(g, [w * 0.8, 0.04, 0.5], [0, 0, 0], '#8bffd0', em('#5fffd0', 2)); glow(g, [0, 1.15, 0.1], '#5fffd0', 4.6, 0.5); glow(g, [0, 0.1, 0], '#5fffd0', 3.2, 0.5) }
  return { setText(txt) { mat.map.dispose(); mat.map = signTexture(txt, t); if (mat.emissiveMap) mat.emissiveMap = mat.map; mat.needsUpdate = true } }
}

export function gardenlights(t, g) {
  const lit = at(WARM_YELLOW, t)
  const iron = '#2f3138'
  if (t === 1) { cyl(g, 0.03, 0.4, [0, 0, 0], iron, {}, 6); sphere(g, 0.1, [0, 0.5, 0], '#d8fff0', em(lit, 2.2)); glow(g, [0, 0.5, 0], lit, 1.2, 0.7); pool(g, [0, 0, 0], lit, 1.0, 0.3) }
  else if (t === 2) { cyl(g, 0.16, 0.34, [0, 0, 0], '#eef2ee', { transparent: true, opacity: 0.8 }, 12); sphere(g, 0.1, [0, 0.16, 0], '#fff3c8', em(lit, 2.4)); glow(g, [0, 0.3, 0], lit, 1.6, 0.7); pool(g, [0, 0, 0], lit, 1.2, 0.3) }
  else if (t === 3) { box(g, [0.14, 0.9, 0.14], [0, 0, 0], '#f2eadb'); box(g, [0.3, 0.3, 0.3], [0, 0.9, 0], '#ffe2a8', em(lit, 2)); box(g, [0.36, 0.06, 0.36], [0, 1.2, 0], iron); glow(g, [0, 1.05, 0], lit, 2, 0.7); pool(g, [0, 0, 0], lit, 1.6, 0.3) }
  else if (t === 4) { cyl(g, 0.04, 1.8, [0, 0, 0], iron, {}, 6); box(g, [0.7, 0.04, 0.04], [0.3, 1.8, 0], iron); sphere(g, 0.15, [0.6, 1.55, 0], '#ffe2a8', em(lit, 2.2)); cyl(g, 0.02, 0.2, [0.6, 1.62, 0], iron, {}, 4); glow(g, [0.6, 1.55, 0], lit, 2, 0.7); pool(g, [0.6, 0, 0], lit, 1.6, 0.3) }
  else if (t === 5) { for (let i = 0; i < 3; i++) { cyl(g, 0.04, 0.5, [-0.8 + i * 0.8, 0, 0], iron, {}, 6); box(g, [0.24, 0.1, 0.24], [-0.8 + i * 0.8, 0.5, 0], '#ffe9c0', em(lit, 2)); glow(g, [-0.8 + i * 0.8, 0.55, 0], lit, 1.4, 0.7); pool(g, [-0.8 + i * 0.8, 0, 0], lit, 1.0, 0.3) } }
  else if (t === 6) { cyl(g, 0.4, 0.3, [0, 0, 0], '#6a4a3a', {}, 12); cyl(g, 0.34, 0.06, [0, 0.3, 0], '#2f3138', {}, 12); for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.12 - i * 0.015, 0.5 + (i % 2) * 0.15, 6), std(i % 2 ? '#ffb830' : '#ff6a2a', em(i % 2 ? '#ffb830' : '#ff6a2a', 2.4))); f.position.set(Math.sin(i * 1.6) * 0.1, 0.55, Math.cos(i * 1.6) * 0.1); g.add(f) } glow(g, [0, 0.6, 0], lit, 3, 0.8); pool(g, [0, 0, 0], lit, 2.2, 0.4) }
  else if (t === 7) { cyl(g, 0.06, 2.6, [0, 0, 0], iron, {}, 8); cyl(g, 0.2, 0.08, [0, 0, 0], iron, {}, 12); box(g, [0.5, 0.08, 0.5], [0, 2.6, 0], iron); box(g, [0.4, 0.5, 0.4], [0, 2.1, 0], '#fff3d0', em(lit, 2)); box(g, [0.6, 0.1, 0.6], [0, 2.6, 0], iron); glow(g, [0, 2.35, 0], lit, 3.4, 0.7); pool(g, [0, 0, 0], lit, 2.6, 0.35) }
  else if (t === 8) { [-1.0, 1.0].forEach(x => cyl(g, 0.05, 2.0, [x, 0, 0], '#8a6a4a', {}, 6)); const arch = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.04, 8, 28, Math.PI), std('#8a6a4a')); arch.position.y = 2.0; g.add(arch); for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI; sphere(g, 0.045, [Math.cos(a) * 1.0, 2.0 + Math.sin(a) * 1.0, 0.04], '#fff6dc', em(lit, 2.4)) } glow(g, [0, 2.6, 0], lit, 4.6, 0.45) }
  else if (t === 9) { cyl(g, 0.12, 0.7, [0, 0, 0], '#7a7a88', {}, 6); const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), std('#bff0ff', { ...em(lit, 2), transparent: true, opacity: 0.9 })); c.position.y = 1.15; c.scale.y = 1.6; g.add(c); glow(g, [0, 1.15, 0], lit, 3.4, 0.8); pool(g, [0, 0, 0], lit, 2.2, 0.4) }
  else { for (let i = 0; i < 9; i++) { const a = i * 2.4; sphere(g, 0.07 + (i % 3) * 0.02, [Math.sin(a) * (0.3 + (i % 4) * 0.2), 0.3 + i * 0.2, Math.cos(a) * (0.3 + (i % 4) * 0.2)], '#f4ffd0', em(lit, 2.6)); glow(g, [Math.sin(a) * (0.3 + (i % 4) * 0.2), 0.3 + i * 0.2, Math.cos(a) * (0.3 + (i % 4) * 0.2)], lit, 1.0, 0.8) } pool(g, [0, 0, 0], lit, 2.4, 0.3) }
}

export { wallTexture, floorTexture }
