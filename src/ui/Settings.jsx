import { useState } from 'react'
import { store } from '../game/store'
import { useStore } from './useStore'
import { Icon } from './icons'
import Modal from './Modal'

const QUALITY = [
  ['low', 'Low', 'Battery saver. Sharpness 1×.'],
  ['medium', 'Medium', 'Balanced. Up to 1.5×.'],
  ['high', 'High', 'Crispest. Up to 2×.'],
]
const KEYS = [
  ['W A S D / arrows', 'Move your cube'],
  ['Click the floor', 'Walk there'],
  ['Q / E', 'Spin the view'],
  ['Scroll', 'Zoom in and out'],
  ['Space', 'Take the stairs'],
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

export default function Settings({ onClose, debug }) {
  const s = useStore()
  const [name, setName] = useState(s.profile.name)
  const [house, setHouse] = useState(s.profile.house)
  const set = (k, v) => store.setSetting(k, v)

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="settings">
        <section>
          <h3><Icon name="user" size={16} /> You</h3>
          <label className="field">
            <span>Your name</span>
            <input value={name} maxLength={16} onChange={e => setName(e.target.value)} onBlur={() => store.setName(name)} />
          </label>
          <label className="field">
            <span>House name on the sign</span>
            <input value={house} maxLength={24} onChange={e => setHouse(e.target.value)} onBlur={() => store.setHouseName(house)} />
            <small>Shown on the garden sign. A couple chooses one shared name.</small>
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
          <Toggle label="Reduce motion" hint="Calmer camera moves" value={s.settings.reduceMotion} onChange={v => set('reduceMotion', v)} />
          <Toggle label="Show control hints" value={s.settings.hints} onChange={v => set('hints', v)} />
        </section>

        <section>
          <h3><Icon name="music" size={16} /> Sound</h3>
          <Toggle label="Music" hint="Coming soon" value={s.settings.music} onChange={v => set('music', v)} disabled />
          <Toggle label="Sound effects" hint="Coming soon" value={s.settings.sfx} onChange={v => set('sfx', v)} disabled />
        </section>

        <section>
          <h3><Icon name="chat" size={16} /> Chat and privacy</h3>
          <Toggle label="Show chat" hint="Hide it any time. Only people in your world can write to you." value={s.settings.chat} onChange={v => set('chat', v)} />
          <p className="soft">You can report or block anyone from their message.</p>
        </section>

        <section>
          <h3><Icon name="keyboard" size={16} /> Controls</h3>
          <dl className="keys">{KEYS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </section>

        <section>
          <h3><Icon name="info" size={16} /> Account</h3>
          <div className="row"><span><b>Signed in as</b><small>{s.profile.name} (guest, saved on this device)</small></span><button className="btn ghost" disabled>Sign in soon</button></div>
          <p className="soft">Accounts arrive with online play. Until then your progress lives in this browser.</p>
        </section>

        {debug && (
          <section className="dev">
            <h3><Icon name="bolt" size={16} /> Developer</h3>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => store.dev.addBoxets(500)}>+500 Boxets</button>
              <button className="btn ghost" onClick={() => store.dev.nextDay()}>Next day</button>
              <button className="btn ghost" onClick={() => store.dev.skipDays(2)}>Skip 2 days</button>
              <button className="btn ghost" onClick={() => store.dev.reset()}>Reset all</button>
            </div>
          </section>
        )}
      </div>
    </Modal>
  )
}
