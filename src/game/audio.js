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

// a short burst of filtered noise: swishes, steps, knocks
let noiseBuf = null
function noise(dur, { freq = 800, q = 0.8, gain = 0.3, at = 0, type = 'bandpass', to = null } = {}) {
  const c = ensure()
  if (!c) return
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t0 = c.currentTime + at
  const src = c.createBufferSource(); src.buffer = noiseBuf
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q
  if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.03, dur / 3))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f); f.connect(g); g.connect(sfxBus)
  src.start(t0, Math.random()); src.stop(t0 + dur + 0.05)
}

const SOUNDS = {
  step: () => noise(0.07, { freq: 260 + Math.random() * 80, q: 1.2, gain: 0.08, type: 'lowpass' }),
  door: () => { noise(0.5, { freq: 420, to: 260, q: 6, gain: 0.12 }); tone(110, { dur: 0.18, gain: 0.25, at: 0.42 }) },
  gate: () => { noise(0.3, { freq: 900, to: 600, q: 8, gain: 0.08 }); tone(240, { dur: 0.06, gain: 0.2, at: 0.26, type: 'triangle' }) },
  switch: () => { tone(1600, { dur: 0.025, gain: 0.25, type: 'square' }); tone(1200, { dur: 0.025, gain: 0.18, type: 'square', at: 0.05 }) },
  curtain: () => noise(0.45, { freq: 2600, to: 1400, q: 0.6, gain: 0.09, type: 'highpass' }),
  click: () => tone(880, { dur: 0.05, gain: 0.25 }),
  open: () => { tone(520, { dur: 0.12, to: 760, gain: 0.3 }) },
  buy: () => [660, 880, 1320].forEach((f, i) => tone(f, { dur: 0.16, at: i * 0.07, gain: 0.35, type: 'triangle' })),
  place: () => { tone(160, { dur: 0.13, to: 70, gain: 0.7 }); tone(900, { dur: 0.03, gain: 0.15, type: 'square' }) },
  pick: () => tone(520, { dur: 0.1, to: 330, gain: 0.35 }),
  error: () => { tone(190, { dur: 0.09, type: 'square', gain: 0.2 }); tone(160, { dur: 0.12, type: 'square', gain: 0.2, at: 0.1 }) },
  claim: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { dur: 0.22, at: i * 0.09, gain: 0.35, type: 'triangle' })),
  // a soft chime on a pentatonic note, so a run of caught stars always sounds pretty
  star: () => { const f = [784, 880, 988, 1175, 1319, 1568][Math.floor(Math.random() * 6)]; tone(f, { dur: 0.3, gain: 0.22, type: 'sine' }); tone(f * 2, { dur: 0.12, gain: 0.06, type: 'sine', at: 0.02 }) },
  tick: () => tone(1320, { dur: 0.04, gain: 0.12, type: 'sine' }),
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
  if (started) { syncMusic(); syncSea() }
}

// the sea: slow swells of filtered noise, always quietly there (with the sound effects), louder outside
let sea = null
let seaNear = 0.5
function syncSea() {
  if (!ctx) return
  if (!sea) {
    if (!noiseBuf) noise(0.01, { gain: 0.0001 })
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520
    const g = ctx.createGain(); g.gain.value = 0
    const swell = ctx.createGain(); swell.gain.value = 1
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11
    const depth = ctx.createGain(); depth.gain.value = 0.45
    lfo.connect(depth); depth.connect(swell.gain)
    src.connect(lp); lp.connect(swell); swell.connect(g); g.connect(sfxBus)
    src.start(); lfo.start()
    sea = { g }
  }
  sea.g.gain.setTargetAtTime(on.sfx && started ? 0.06 * seaNear : 0, ctx.currentTime, 0.8)
}
/** how close the sea is (0..1): the waves get louder outside */
export function setSeaNear(v) { seaNear = Math.max(0.15, Math.min(1, v)); if (sea) syncSea() }

export function startOnFirstGesture() {
  const go = () => {
    if (started) return
    started = true
    ensure()
    syncMusic()
    syncSea()
    window.removeEventListener('pointerdown', go)
    window.removeEventListener('keydown', go)
  }
  window.addEventListener('pointerdown', go)
  window.addEventListener('keydown', go)
}
