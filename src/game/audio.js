// Tiny synthesised sound: soft UI sounds, a slow and quiet pad of low chords, and the sea. No audio files.

let ctx = null
let sfxBus = null
let musicBus = null
let delay = null
let timer = null
let on = { music: true, sfx: true }
let started = false

// the music: four warm chords, voiced low and close, each one swelling in and fading out over ~10 seconds
// (Fmaj7, Am7, Cmaj7, G6; Hz)
const CHORDS = [
  [87.31, 174.61, 220.0, 261.63, 329.63],
  [110.0, 164.81, 196.0, 261.63, 329.63],
  [65.41, 130.81, 196.0, 246.94, 329.63],
  [98.0, 146.83, 196.0, 246.94, 329.63],
]

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    const master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(ctx.destination)
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.35; sfxBus.connect(master)
    // the music goes through a gentle low-pass, so nothing in it is ever bright or sharp
    const soft = ctx.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 900; soft.Q.value = 0.3
    musicBus = ctx.createGain(); musicBus.gain.value = 0.11; musicBus.connect(soft); soft.connect(master)
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
  // the teleport to a minigame and back: an airy rising sweep with a shimmer on top
  whoosh: () => { noise(0.7, { freq: 300, to: 2400, q: 0.8, gain: 0.1, type: 'bandpass' }); [1047, 1319, 1568].forEach((f, i) => tone(f, { dur: 0.35, at: 0.25 + i * 0.06, gain: 0.08, type: 'sine' })) },
}

export function sfx(name) {
  if (!on.sfx || !started) return
  SOUNDS[name]?.()
}

let chord = 0
function music() {
  if (!on.music || !ctx) return
  const c = ctx
  const t0 = c.currentTime + 0.05
  const notes = CHORDS[chord++ % CHORDS.length]
  const dur = 11
  notes.forEach((f, i) => {
    // two sines a hair apart per note: a slow, soft shimmer instead of a hard tone
    [f, f * 1.003].forEach(freq => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      const peak = (i === 0 ? 0.22 : 0.12) / 2
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.linearRampToValueAtTime(peak, t0 + 4)
      g.gain.setValueAtTime(peak, t0 + dur - 4.5)
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur)
      o.connect(g); g.connect(musicBus)
      if (i === notes.length - 1) g.connect(delay) // just the top note echoes, softly
      o.start(t0); o.stop(t0 + dur + 0.1)
    })
  })
  timer = setTimeout(music, (dur - 3) * 1000) // chords overlap as one fades and the next swells in
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
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480
    const g = ctx.createGain(); g.gain.value = 0
    // waves: a slow swell (one every ~9 s) with a slower rise and fall on top, so it never sounds like a loop
    const swell = ctx.createGain(); swell.gain.value = 0.9
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11
    const depth = ctx.createGain(); depth.gain.value = 0.5
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.037
    const depth2 = ctx.createGain(); depth2.gain.value = 0.25
    lfo.connect(depth); depth.connect(swell.gain)
    lfo2.connect(depth2); depth2.connect(swell.gain)
    src.connect(lp); lp.connect(swell); swell.connect(g); g.connect(ctx.destination)
    src.start(); lfo.start(); lfo2.start()
    sea = { g }
  }
  // (part of the ambience: it plays with the music or the sound effects, whichever is on)
  sea.g.gain.setTargetAtTime((on.sfx || on.music) && started ? 0.05 * seaNear : 0, ctx.currentTime, 0.8)
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
