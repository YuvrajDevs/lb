import * as THREE from 'three'

// The cube's face: soft white features drawn on a see-through square that sits on the front of the cube, so
// the cube's own colour (and skin) shows around them. One canvas per expression, drawn once and shared.
//   neutral (with a blink), shocked, angry, sleepy, sad, blush, please, excited (it spins too), cry, happy, lovely

export const EXPRESSIONS = ['happy', 'excited', 'lovely', 'blush', 'shocked', 'please', 'sleepy', 'sad', 'cry', 'angry']
export const EXPRESSION_LABEL = {
  happy: 'Happy', excited: 'Excited', lovely: 'Lovely', blush: 'Blush', shocked: 'Shocked',
  please: 'Please', sleepy: 'Sleepy', sad: 'Sad', cry: 'Cry', angry: 'Angry',
}

const S = 256
const L = [88, 104], R = [168, 104] // the two eyes

/** a soft-edged white blob (the eyes in the drawings have a fuzzy rim) */
function soft(g, draw) {
  g.save()
  g.shadowColor = 'rgba(255,255,255,0.9)'
  g.shadowBlur = 7
  g.fillStyle = '#fff'
  draw()
  g.restore()
}
const circle = (g, [x, y], r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill() }
const line = (g, w = 9) => { g.lineWidth = w; g.lineCap = 'round'; g.strokeStyle = '#fff' }

const DRAW = {
  neutral: g => soft(g, () => { circle(g, L, 24); circle(g, R, 24) }),
  blink: g => { line(g); [L, R].forEach(([x, y]) => { g.beginPath(); g.moveTo(x - 20, y + 4); g.lineTo(x + 20, y + 4); g.stroke() }) },
  shocked: g => soft(g, () => {
    circle(g, L, 29); circle(g, R, 29)
    g.beginPath(); g.ellipse(128, 186, 10, 16, 0, 0, Math.PI * 2); g.fill()
  }),
  angry: g => {
    // eyes cut flat across the top, slanting down to the middle, under sharp brows
    soft(g, () => [[L, 1], [R, -1]].forEach(([[x, y], s]) => {
      g.beginPath(); g.moveTo(x - 26, y - 8 * s); g.lineTo(x + 26, y + 8 * s); g.arc(x, y + 6, 26, 0, Math.PI); g.closePath(); g.fill()
    }))
    line(g, 7)
    ;[[L, 1], [R, -1]].forEach(([[x, y], s]) => { g.beginPath(); g.moveTo(x - 34 * s, y - 40); g.quadraticCurveTo(x - 4 * s, y - 34, x + 26 * s, y - 16); g.stroke() })
  },
  sleepy: g => {
    line(g, 9)
    ;[L, R].forEach(([x, y]) => { g.beginPath(); g.arc(x, y - 6, 22, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke() })
    g.fillStyle = '#fff'; g.font = '700 34px sans-serif'; g.fillText('z', 196, 64); g.font = '700 24px sans-serif'; g.fillText('z', 222, 42); g.font = '700 16px sans-serif'; g.fillText('z', 238, 26)
  },
  sad: g => soft(g, () => [[L, -1], [R, 1]].forEach(([[x, y], s]) => {
    // droopy: cut by a line falling towards the outside
    g.beginPath(); g.moveTo(x - 26, y - 6 * s); g.lineTo(x + 26, y + 6 * s); g.arc(x, y + 4, 24, 0, Math.PI); g.closePath(); g.fill()
  })),
  blush: g => {
    soft(g, () => { circle(g, L, 24); circle(g, R, 24) })
    g.fillStyle = 'rgba(255, 90, 120, 0.55)'
    ;[L, R].forEach(([x, y]) => { g.beginPath(); g.ellipse(x, y + 44, 30, 13, 0, 0, Math.PI * 2); g.fill() })
    g.strokeStyle = '#e8283c'; g.lineWidth = 3.5; g.lineCap = 'round'
    ;[L, R].forEach(([x, y]) => [-12, 0, 12].forEach(d => { g.beginPath(); g.moveTo(x + d - 3, y + 37); g.lineTo(x + d + 3, y + 51); g.stroke() }))
  },
  please: g => [L, R].forEach(([x, y]) => {
    soft(g, () => circle(g, [x, y], 30))
    g.fillStyle = '#111'; circle(g, [x + 1, y + 2], 24)
    g.fillStyle = '#fff'; circle(g, [x + 7, y - 6], 8); circle(g, [x - 8, y + 9], 3.5)
  }),
  excited: g => {
    line(g, 14)
    g.beginPath(); g.moveTo(L[0] - 22, L[1] - 20); g.lineTo(L[0] + 14, L[1]); g.lineTo(L[0] - 22, L[1] + 20); g.stroke()
    g.beginPath(); g.moveTo(R[0] + 22, R[1] - 20); g.lineTo(R[0] - 14, R[1]); g.lineTo(R[0] + 22, R[1] + 20); g.stroke()
  },
  cry: g => {
    soft(g, () => [L, R].forEach(([x, y]) => { g.beginPath(); g.arc(x, y + 6, 26, Math.PI, 0); g.closePath(); g.fill() }))
    line(g, 5); g.setLineDash([12, 10])
    ;[[L, -1], [R, 1]].forEach(([[x, y], s]) => { g.beginPath(); g.moveTo(x + 26 * s, y + 10); g.quadraticCurveTo(x + 34 * s, y + 60, x + 30 * s, y + 104); g.stroke() })
    g.setLineDash([])
  },
  happy: g => { line(g, 12); [L, R].forEach(([x, y]) => { g.beginPath(); g.arc(x, y + 10, 22, 1.1 * Math.PI, 1.9 * Math.PI); g.stroke() }) },
  lovely: g => soft(g, () => [L, R].forEach(([x, y]) => {
    g.beginPath()
    g.moveTo(x, y + 26)
    g.bezierCurveTo(x - 40, y - 4, x - 22, y - 34, x, y - 12)
    g.bezierCurveTo(x + 22, y - 34, x + 40, y - 4, x, y + 26)
    g.fill()
  })),
}

const textures = {}
/** the face for an expression (drawn once) */
export function faceTexture(kind) {
  if (!textures[kind]) {
    const c = document.createElement('canvas')
    c.width = c.height = S
    DRAW[kind in DRAW ? kind : 'neutral'](c.getContext('2d'))
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    textures[kind] = t
  }
  return textures[kind]
}

/** a little picture of an expression on a pink cube, for the expression buttons (a data URL) */
export function faceIcon(kind, color = '#ff8fb8') {
  const c = document.createElement('canvas')
  c.width = c.height = 96
  const g = c.getContext('2d')
  g.fillStyle = color
  g.beginPath(); g.roundRect(4, 4, 88, 88, 16); g.fill()
  g.drawImage(faceTexture(kind).image, 4, 4, 88, 88)
  return c.toDataURL()
}
