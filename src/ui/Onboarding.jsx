import { useEffect, useState } from 'react'
import { Icon } from './icons'

// The first-time guide: a few short cards that explain how to get around and what to do. Shown once; it can be
// opened again from Settings. On a touch screen it talks about taps and the move pad instead of keys.

const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

const STEPS = [
  { icon: 'heart', title: 'Welcome to NeighBoxed', text: 'This is your home, on a cliff above the sea. Decorate it, earn Boxets, and share it with your friends and your partner.' },
  {
    icon: 'cube', title: 'Getting around',
    text: touch
      ? 'Tap anywhere on the floor, in the garden or on the cliff walk to walk there. The arrow pad moves you too.'
      : 'Click anywhere to walk there, or use W A S D. Hold Shift to run. Doors and gates open as you come near.',
  },
  { icon: 'eye', title: 'Looking around', text: `${touch ? 'Use' : 'Scroll or use'} the eye button by the compass to change the view: from your own eyes, to the room, the whole house and the street. Drag to turn.` },
  { icon: 'lamp', title: 'Make it feel like home', text: 'Tap a lamp to switch it off or on, and curtains to open or close them. Edit home lets you place furniture, or auto-furnish a room.' },
  { icon: 'gift', title: 'Boxets', text: 'Collect your daily gift, spend Boxets in the shop, and earn more by spending time together. Out the back gate is a playground, where games are on their way.' },
]

export default function Onboarding({ onDone }) {
  const [k, setK] = useState(0)
  const step = STEPS[k]
  const last = k === STEPS.length - 1
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') (last ? onDone() : setK(k + 1))
      if (e.key === 'ArrowLeft' && k > 0) setK(k - 1)
      if (e.key === 'Escape') onDone()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [k, last, onDone])

  return (
    <div className="onboard-scrim">
      <section className="onboard" role="dialog" aria-modal="true" aria-label="Welcome">
        <div className="onboard-art" key={k}><Icon name={step.icon} size={40} /></div>
        <h2>{step.title}</h2>
        <p>{step.text}</p>
        <div className="onboard-dots" aria-label={`Step ${k + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => <button key={i} className={i === k ? 'on' : ''} onClick={() => setK(i)} aria-label={`Step ${i + 1}`} />)}
        </div>
        <div className="onboard-actions">
          <button className="btn ghost" onClick={onDone}>{last ? 'Close' : 'Skip'}</button>
          <div>
            {k > 0 && <button className="btn ghost" onClick={() => setK(k - 1)}>Back</button>}
            <button className="btn primary" onClick={() => (last ? onDone() : setK(k + 1))}>{last ? 'Start playing' : 'Next'}</button>
          </div>
        </div>
      </section>
    </div>
  )
}
