import { useEffect, useState } from 'react'
import { Icon } from './icons'

// The first-time guide: a few short cards that explain how to get around and what to do. Shown once; it can be
// opened again from Settings. On a touch screen it talks about taps and the move pad instead of keys.

const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

const STEPS = name => [
  { icon: 'heart', title: name ? `Welcome home, ${name}` : 'Welcome home', text: 'This is your home, on a cliff above the sea, at sunset. Make it yours, and share the street with friends and your partner.' },
  {
    icon: 'cube', title: 'Getting around',
    text: touch
      ? 'Tap anywhere to walk there, or use the arrow pad. You can wander the whole street, out to the cliff and the playground behind your home.'
      : 'Click anywhere to walk there, or use W A S D. Hold Shift to run. Wander the whole street, out to the cliff and the playground behind your home.',
  },
  { icon: 'eye', title: 'Looking around', text: `${touch ? 'Use' : 'Scroll, or use'} the eye button by the compass, to go from your own eyes to the room, the house and the street. Drag to turn.` },
  { icon: 'lamp', title: 'Make it yours', text: 'Tap lamps and curtains to switch them. Edit home places furniture, names your sign, and chooses who can come in without asking.' },
  { icon: 'world', title: 'Neighbours', text: "Everyone's home is on the street. At a neighbour's gate you can ask to visit; when they say yes, in you go. Sign in to invite friends." },
  { icon: 'gift', title: 'Boxets', text: 'Play and earn: every 30 minutes, three quests a day, a daily gift, and Star catch at the playground. Spend it all in the shop.' },
]

export default function Onboarding({ onDone, name }) {
  const [k, setK] = useState(0)
  const steps = STEPS(name)
  const step = steps[k]
  const last = k === steps.length - 1
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
        <div className="onboard-dots" aria-label={`Step ${k + 1} of ${steps.length}`}>
          {steps.map((_, i) => <button key={i} className={i === k ? 'on' : ''} onClick={() => setK(i)} aria-label={`Step ${i + 1}`} />)}
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
