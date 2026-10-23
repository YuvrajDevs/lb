// Tiny synthesised sound: UI blips and a slow generative background tune. No audio files, nothing to download.

let ctx = null
let sfxBus = null
let musicBus = null
let delay = null
let timer = null
let on = { music: true, sfx: true }
let started = false

const NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25] // C major pentatonic-ish

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    const master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(ctx.destination)
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.35; sfxBus.connect(master)
    musicBus = ctx.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master)
    delay = ctx.createDelay(1.5); delay.delayTime.value = 0.46
    const fb = ctx.createGain(); fb.gain.value = 0.38
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800
    delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(musicBus)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, { dur = 0.12, type = 'sine', gain = 0.5, to = null, at = 0, bus = sfxBus } = {}) {
  const c = ensure()
  if (!c) return
  const t0 = c.currentTime + at
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g); g.connect(bus || sfxBus)
  o.start(t0); o.stop(t0 + dur + 0.05)
}

const SOUNDS = {
  click: () => tone(880, { dur: 0.05, gain: 0.25 }),
  open: () => { tone(520, { dur: 0.12, to: 760, gain: 0.3 }) },
  buy: () => [660, 880, 1320].forEach((f, i) => tone(f, { dur: 0.16, at: i * 0.07, gain: 0.35, type: 'triangle' })),
  place: () => { tone(160, { dur: 0.13, to: 70, gain: 0.7 }); tone(900, { dur: 0.03, gain: 0.15, type: 'square' }) },
  pick: () => tone(520, { dur: 0.1, to: 330, gain: 0.35 }),
  error: () => { tone(190, { dur: 0.09, type: 'square', gain: 0.2 }); tone(160, { dur: 0.12, type: 'square', gain: 0.2, at: 0.1 }) },
  claim: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { dur: 0.22, at: i * 0.09, gain: 0.35, type: 'triangle' })),
}

export function sfx(name) {
  if (!on.sfx || !started) return
  SOUNDS[name]?.()
}

function music() {
  if (!on.music || !ctx) return
  const f = NOTES[Math.floor(Math.random() * NOTES.length)] * (Math.random() > 0.8 ? 0.5 : 1)
  const dur = 2.8 + Math.random() * 1.4
  const c = ctx
  const t0 = c.currentTime
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'triangle'
  o.frequency.value = f
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.5)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g); g.connect(musicBus); g.connect(delay)
  o.start(t0); o.stop(t0 + dur + 0.1)
  timer = setTimeout(music, 1500 + Math.random() * 2200)
}

function syncMusic() {
  clearTimeout(timer)
  timer = null
  if (on.music && started && ctx) music()
}

/** apply the settings; browsers only allow sound after the first tap or click, so the first one starts it */
export function setAudio(settings) {
  on = { music: !!settings.music, sfx: !!settings.sfx }
  if (started) syncMusic()
}

export function startOnFirstGesture() {
  const go = () => {
    if (started) return
    started = true
    ensure()
    syncMusic()
    window.removeEventListener('pointerdown', go)
    window.removeEventListener('keydown', go)
  }
  window.addEventListener('pointerdown', go)
  window.addEventListener('keydown', go)
}
