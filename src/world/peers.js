import * as THREE from 'three'
import { createCube, FLOAT } from './cube.js'

// The other people in your world, live: their own cube (skin and hat), a name tag, a speech bubble when they
// chat and a little emote above them. Updates arrive about 8 times a second; in between, each cube glides
// smoothly towards where it was last seen, so movement looks continuous rather than jumpy.

const EMOTES = { wave: '👋', heart: '💗', hug: '🤗', laugh: '😄', dance: '💃', sleep: '💤', star: '✨' }
export const EMOTE_LIST = Object.keys(EMOTES)

function textSprite(draw, w, h, scale) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }))
  s.scale.set(scale * (w / h), scale, 1)
  s.renderOrder = 10
  return s
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

const nameTag = (name, online = true) => textSprite((g, w, h) => {
  g.font = '700 44px "Josefin Sans", sans-serif'
  g.textAlign = 'center'; g.textBaseline = 'middle'
  const tw = Math.min(w - 20, g.measureText(name.toUpperCase()).width + 60)
  g.fillStyle = 'rgba(14, 10, 32, 0.6)'
  roundRect(g, (w - tw) / 2, 14, tw, h - 28, (h - 28) / 2); g.fill()
  g.fillStyle = online ? '#ffffff' : 'rgba(255,255,255,0.6)'
  g.letterSpacing = '6px'
  g.fillText(name.toUpperCase(), w / 2, h / 2 + 3)
}, 512, 96, 0.36)

const bubble = text => textSprite((g, w, h) => {
  g.font = '400 40px "Josefin Sans", sans-serif'
  // wrap into at most three lines
  const words = text.split(' ')
  const lines = []
  let line = ''
  words.forEach(word => {
    const t = line ? `${line} ${word}` : word
    if (g.measureText(t).width > w - 80 && line) { lines.push(line); line = word } else line = t
  })
  if (line) lines.push(line)
  const shown = lines.slice(0, 3)
  if (lines.length > 3) shown[2] += '…'
  const lh = 48, bh = shown.length * lh + 36
  const bw = Math.min(w - 8, Math.max(...shown.map(l => g.measureText(l).width)) + 56)
  const top = h - bh - 22
  g.fillStyle = 'rgba(255, 252, 245, 0.96)'
  roundRect(g, (w - bw) / 2, top, bw, bh, 26); g.fill()
  g.beginPath(); g.moveTo(w / 2 - 14, top + bh); g.lineTo(w / 2, top + bh + 18); g.lineTo(w / 2 + 14, top + bh); g.fill()
  g.fillStyle = '#2a1d3a'; g.textAlign = 'center'; g.textBaseline = 'middle'
  shown.forEach((l, i) => g.fillText(l, w / 2, top + 18 + lh * i + lh / 2))
}, 640, 256, 1.45)

const emoji = e => textSprite((g, w, h) => {
  g.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(e, w / 2, h / 2 + 6)
}, 128, 128, 0.7)

/** one cube with its tag; `a` is anything with pos / yaw / moving, so your own cube can show bubbles too */
function attach(scene, cube, name) {
  const tag = nameTag(name)
  tag.position.y = FLOAT + 1.55
  cube.group.add(tag)
  scene.add(cube.group)
  return { cube, tag, bubble: null, bubbleT: 0, emote: null, emoteT: 0 }
}

export function createPeers(scene) {
  const peers = new Map()
  let mine = null // your own cube's extras (bubble and emote), set with attachMe

  function say(p, text) {
    if (p.bubble) { p.cube.group.remove(p.bubble); p.bubble.material.map.dispose(); p.bubble.material.dispose() }
    p.bubble = bubble(text)
    p.bubble.position.y = FLOAT + 2.5
    p.cube.group.add(p.bubble)
    p.bubbleT = 6 + Math.min(6, text.length / 12)
  }
  function emote(p, kind) {
    if (!EMOTES[kind]) return
    if (p.emote) { p.cube.group.remove(p.emote); p.emote.material.map.dispose(); p.emote.material.dispose() }
    p.emote = emoji(EMOTES[kind])
    p.emote.position.y = FLOAT + 1.5
    p.cube.group.add(p.emote)
    p.emoteT = 2.6
  }
  function age(p, dt) {
    if (p.bubble && (p.bubbleT -= dt) <= 0) { p.cube.group.remove(p.bubble); p.bubble = null }
    else if (p.bubble) p.bubble.material.opacity = Math.min(1, p.bubbleT * 2)
    if (p.emote) {
      p.emoteT -= dt
      p.emote.position.y = FLOAT + 1.5 + (2.6 - p.emoteT) * 0.45
      p.emote.material.opacity = Math.min(1, p.emoteT)
      if (p.emoteT <= 0) { p.cube.group.remove(p.emote); p.emote = null }
    }
  }

  return {
    /** add someone, or update their look */
    set(id, { name, skin = null, hat = null }) {
      let p = peers.get(id)
      if (!p) {
        p = attach(scene, createCube('#9ad0ff'), name || '?')
        p.name = name
        p.pos = new THREE.Vector3(0, 0, 9e3)
        p.goal = null
        p.yaw = 0
        p.goalYaw = 0
        p.moving = false
        p.seen = false
        p.cube.group.visible = false // until their first position arrives
        peers.set(id, p)
      }
      if (name && name !== p.name) {
        p.cube.group.remove(p.tag); p.tag.material.map.dispose()
        p.tag = nameTag(name); p.tag.position.y = FLOAT + 1.55; p.cube.group.add(p.tag); p.name = name
      }
      if (skin !== p.skin) { p.cube.setSkin(skin); p.skin = skin }
      if (hat !== p.hat) { p.cube.setHat(hat); p.hat = hat }
    },
    /** where they are now (in this world's coordinates), and whether they are walking */
    move(id, x, y, z, yaw, moving) {
      const p = peers.get(id)
      if (!p) return
      if (!p.seen || p.pos.distanceTo(new THREE.Vector3(x, y, z)) > 9) { p.pos.set(x, y, z); p.yaw = yaw } // first sight, or a jump: no slide
      p.goal = new THREE.Vector3(x, y, z)
      p.goalYaw = yaw
      p.moving = moving
      p.seen = true
      p.cube.group.visible = true
    },
    hide(id) { const p = peers.get(id); if (p) { p.cube.group.visible = false; p.seen = false } },
    remove(id) {
      const p = peers.get(id)
      if (!p) return
      scene.remove(p.cube.group)
      peers.delete(id)
    },
    say(id, text) { const p = id === 'me' ? mine : peers.get(id); if (p) say(p, text) },
    emote(id, kind) { const p = id === 'me' ? mine : peers.get(id); if (p) emote(p, kind) },
    /** your own cube gets bubbles and emotes too (no name tag: you know who you are) */
    attachMe(cube) { mine = { cube, bubble: null, bubbleT: 0, emote: null, emoteT: 0 } },
    ids: () => [...peers.keys()],
    /** is anyone walking (the world draws at full speed while they do) */
    moving: () => [...peers.values()].some(p => p.moving && p.seen),
    update(t, dt) {
      const k = 1 - Math.exp(-dt * 10)
      peers.forEach(p => {
        if (p.goal) {
          p.pos.lerp(p.goal, k)
          let d = p.goalYaw - p.yaw
          d = Math.atan2(Math.sin(d), Math.cos(d))
          p.yaw += d * k
        }
        p.cube.group.position.copy(p.pos)
        p.cube.group.rotation.y = p.yaw
        p.cube.update(t, dt, p.moving && p.goal && p.pos.distanceToSquared(p.goal) > 0.0004)
        age(p, dt)
      })
      if (mine) age(mine, dt)
    },
    dispose() { peers.forEach(p => scene.remove(p.cube.group)); peers.clear() },
  }
}
