import { useEffect, useRef, useState } from 'react'
import { store } from '../game/store'
import { useStore } from './useStore'
import { Icon } from './icons'
import Modal from './Modal'

const QUALITY = [
  ['low', 'Low', 'Battery saver: 1× sharpness, no glow, 30 fps.'],
  ['medium', 'Medium', 'Balanced (recommended): up to 1.5×, 60 fps, slows down when nothing moves.'],
  ['high', 'High', 'Crispest: up to 2×, extra smoothing. Runs warm on laptops.'],
]
const KEYS = [
  ['W A S D / arrows', 'Move your cube'],
  ['Click the floor', 'Walk there'],
  ['Q / E', 'Spin the view'],
  ['Scroll', 'Zoom: eyes · close-up · room · house · street'],
  ['Click a lamp or curtain', 'Switch it off and on · open and shut'],
  ['Hold Shift or Space', 'Run (Shift is twice as fast)'],
  ['Drag (my eyes)', 'Look around · scroll out to leave'],
  ['Esc', 'Close any window'],
]

function Toggle({ label, hint, value, onChange, disabled }) {
  return (
    <label className={`row toggle ${disabled ? 'dim' : ''}`}>
      <span><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" role="switch" checked={value} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <i className="knob" />
    </label>
  )
}

export default function Settings({ onClose, debug, onAccount }) {
  const s = useStore()
  const [name, setName] = useState(s.profile.name)
  // your name saves when you leave the field, and also when the window closes with the field still focused (Esc)
  const latest = useRef(name)
  latest.current = name
  useEffect(() => () => { if (latest.current.trim()) store.setName(latest.current) }, [])
  const set = (k, v) => store.setSetting(k, v)

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="settings">
        <section>
          <h3><Icon name="user" size={16} /> You</h3>
          <label className="field">
            <span>Your name</span>
            <input value={name} maxLength={16} onChange={e => setName(e.target.value)} onBlur={() => name.trim() && store.setName(name)} />
            <small>The name everyone sees. Your home's name, on its sign, is in Edit home.</small>
          </label>
        </section>

        <section>
          <h3><Icon name="sliders" size={16} /> Graphics</h3>
          <div className="seg" role="radiogroup" aria-label="Quality">
            {QUALITY.map(([id, label, hint]) => (
              <button key={id} role="radio" aria-checked={s.settings.quality === id} className={s.settings.quality === id ? 'on' : ''} onClick={() => set('quality', id)} title={hint}>{label}</button>
            ))}
          </div>
          <p className="soft">{QUALITY.find(q => q[0] === s.settings.quality)[2]} The game also lowers sharpness by itself if it starts to stutter.</p>
          <div className="row">
            <span><b>Time of day</b><small>A pink-and-orange sunset, night under the moon, or follow your own clock</small></span>
          </div>
          <div className="seg" role="radiogroup" aria-label="Time of day">
            {[['evening', 'Sunset'], ['night', 'Night'], ['auto', 'My clock']].map(([id, label]) => (
              <button key={id} role="radio" aria-checked={(s.settings.time || 'evening') === id} className={(s.settings.time || 'evening') === id ? 'on' : ''} onClick={() => set('time', id)}>{label}</button>
            ))}
          </div>
          <Toggle label="Reduce motion" hint="The camera cuts instead of swooping; the scenery drifts slower" value={s.settings.reduceMotion} onChange={v => set('reduceMotion', v)} />
          <Toggle label="Show control hints" value={s.settings.hints} onChange={v => set('hints', v)} />
          <div className="row"><span><b>The welcome guide</b><small>The short tour from your first visit</small></span><button className="btn ghost" onClick={() => { set('onboarded', false); onClose() }}>Show again</button></div>
        </section>

        <section>
          <h3><Icon name="music" size={16} /> Sound</h3>
          <Toggle label="Music" hint="A slow, quiet tune that plays itself" value={s.settings.music} onChange={v => set('music', v)} />
          <Toggle label="Sound effects" hint="Clicks, buying, placing furniture" value={s.settings.sfx} onChange={v => set('sfx', v)} />
        </section>

        <section>
          <h3><Icon name="chat" size={16} /> Chat and privacy</h3>
          <Toggle label="Show chat" hint="Arrives with online play. Only people in your world will be able to write to you." value={s.settings.chat} onChange={v => set('chat', v)} disabled />
          <p className="soft">You will be able to report or block anyone from their message.</p>
        </section>

        <section>
          <h3><Icon name="keyboard" size={16} /> Controls</h3>
          <dl className="keys">{KEYS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </section>

        <section>
          <h3><Icon name="info" size={16} /> Account</h3>
          {s.net?.status === 'online'
            ? <div className="row"><span><b>{s.profile.name} <span className="tag">{s.profile.tag}</span></b><small>Signed in as {s.net.email}</small></span><button className="btn ghost" onClick={onAccount}>Account</button></div>
            : <div className="row"><span><b>Playing as a guest</b><small>Saved on this device only. Sign in to keep it safe and play with friends.</small></span><button className="btn primary" onClick={onAccount}>Sign in</button></div>}
        </section>

        {debug && !store.online() && (
          <section className="dev">
            <h3><Icon name="bolt" size={16} /> Developer</h3>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => store.dev.addBoxets(500)}>+500 Boxets</button>
              <button className="btn ghost" onClick={() => store.dev.nextDay()}>Next day</button>
              <button className="btn ghost" onClick={() => store.dev.skipDays(2)}>Skip 2 days</button>
              <button className="btn ghost" onClick={() => store.dev.reset()}>Reset all</button>
              <button className="btn ghost" onClick={() => store.dev.toggleCouple()}>{s.couple.state === 'active' ? 'Go solo (starter home)' : 'Become a couple (big house)'}</button>
            </div>
          </section>
        )}
      </div>
    </Modal>
  )
}
