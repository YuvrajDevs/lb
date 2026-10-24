import { useEffect, useRef, useState } from 'react'
import { store } from '../game/store'
import { EARN_CAPS } from '../game/economy'
import { useStore } from './useStore'
import { Icon, Boxet } from './icons'
import Modal from './Modal'

// Ways to earn Boxets besides the daily gift. Each one is capped per day (economy.js), so playing is a
// pleasant extra, never a grind.

const GAME_SECONDS = 25

/** Star catch: stars drift down the night sky; tap them before they fall. 2 Boxets a star. */
function StarCatch() {
  const [phase, setPhase] = useState('ready') // ready | playing | done
  const [stars, setStars] = useState([])
  const [caught, setCaught] = useState(0)
  const [left, setLeft] = useState(GAME_SECONDS)
  const [paid, setPaid] = useState(0)
  const raf = useRef(0)
  const caughtRef = useRef(0)

  useEffect(() => {
    if (phase !== 'playing') return
    let last = performance.now(), spawn = 0, time = GAME_SECONDS, id = 0
    const tick = now => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      time -= dt
      spawn -= dt
      setStars(list => {
        let next = list.map(s => ({ ...s, y: s.y + s.v * dt })).filter(s => s.y < 105)
        if (spawn <= 0) { spawn = 0.45 + Math.random() * 0.4; next = [...next, { id: id++, x: 6 + Math.random() * 88, y: -6, v: 16 + Math.random() * 18, big: Math.random() < 0.15 }] }
        return next
      })
      setLeft(Math.max(0, Math.ceil(time)))
      if (time <= 0) {
        setPhase('done')
        setPaid(store.earn('stars', caughtRef.current * 2))
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [phase])

  const start = () => { caughtRef.current = 0; setCaught(0); setStars([]); setLeft(GAME_SECONDS); setPhase('playing') }
  const catchStar = s => {
    setStars(list => list.filter(x => x.id !== s.id))
    const n = s.big ? 3 : 1
    caughtRef.current += n
    setCaught(c => c + n)
  }
  const capLeft = store.leftToday('stars')

  return (
    <div className="game">
      <div className="game-head">
        <span><Icon name="star" size={15} /> {caught} caught</span>
        <span>{phase === 'playing' ? `${left}s` : `up to ${capLeft} Boxets left today`}</span>
      </div>
      <div className="sky-field" role="application" aria-label="Star catch">
        {stars.map(s => (
          <button key={s.id} className={`falling-star ${s.big ? 'big' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%` }} onPointerDown={() => catchStar(s)} aria-label="Catch the star">★</button>
        ))}
        {phase !== 'playing' && (
          <div className="game-cover">
            {phase === 'done' && <p><b>{caught}</b> stars · <Boxet size={14} /> {paid} earned</p>}
            <p className="soft">Tap the stars as they drift down. Big ones count three. {GAME_SECONDS} seconds.</p>
            <button className="btn primary" onClick={start}>{phase === 'done' ? 'Play again' : 'Start'}</button>
          </div>
        )}
      </div>
    </div>
  )
}

const QUESTIONS = [
  ['A perfect evening together is…', ['A film and blankets', 'A walk by the sea', 'Cooking something new', 'Games all night']],
  ['The snack you would fight for', ['Chocolate', 'Crisps', 'Fruit', 'Ice cream']],
  ['Where would you go on a trip?', ['Mountains', 'A big city', 'A quiet beach', 'Somewhere we have never been']],
  ['Your partner’s superpower', ['Making me laugh', 'Staying calm', 'Remembering everything', 'Great hugs']],
  ['Pick a song mood for tonight', ['Soft and slow', 'Happy and loud', 'Dreamy', 'Old favourites']],
]

/** The couple quiz: five little questions a day. Comparing answers with your partner comes with online play. */
function CoupleQuiz() {
  const s = useStore()
  const [answers, setAnswers] = useState([])
  const done = (store.earnedToday().by.quiz || 0) >= EARN_CAPS.quiz
  if (s.couple.state !== 'active') return <p className="soft"><Icon name="heart" size={14} /> The couple quiz opens once you are a couple (World → Couple).</p>
  if (done) return <p className="soft"><Icon name="check" size={14} /> You have answered today’s quiz. New questions tomorrow!</p>
  const q = QUESTIONS[answers.length]
  if (!q) return null
  const pick = i => {
    const next = [...answers, i]
    setAnswers(next)
    if (next.length === QUESTIONS.length) store.earn('quiz', EARN_CAPS.quiz)
  }
  return (
    <div className="quiz">
      <small className="soft">Question {answers.length + 1} of {QUESTIONS.length} · about you and {s.couple.partner}</small>
      <h3>{q[0]}</h3>
      <div className="quiz-options">{q[1].map((o, i) => <button key={o} className="btn ghost" onClick={() => pick(i)}>{o}</button>)}</div>
      <p className="soft">When online play arrives, you will see how many answers you and {s.couple.partner} share.</p>
    </div>
  )
}

/** Visit a neighbour: the camera goes to their home; 10 Boxets for each different home visited today. */
function Visits({ onVisit }) {
  const s = useStore()
  const visited = store.earnedToday().visited || []
  const others = s.world.members.filter(m => !m.you)
  if (!others.length) return <p className="soft">No neighbours yet. Invite friends from World.</p>
  return (
    <ul className="visits">
      {others.map((m, k) => (
        <li key={m.id}>
          <span className={`presence ${m.online ? 'on' : ''}`} />
          <span><b>{m.house}</b><small>{m.name}{m.online ? ' · home now' : ''}</small></span>
          <button className="btn ghost" onClick={() => { onVisit(k); if (!visited.includes(m.id)) store.earn('visit', 10, m.id) }}>
            {visited.includes(m.id) ? 'Visit again' : 'Visit · +10'}
          </button>
        </li>
      ))}
    </ul>
  )
}

export default function Play({ onClose, onVisit }) {
  const [tab, setTab] = useState('stars')
  return (
    <Modal title="Play" subtitle="Little ways to earn Boxets. Each has a daily limit, so there is no need to grind." onClose={onClose}>
      <div className="chips">
        <button className={`chip ${tab === 'stars' ? 'on' : ''}`} onClick={() => setTab('stars')}><Icon name="star" size={15} /> Star catch</button>
        <button className={`chip ${tab === 'quiz' ? 'on' : ''}`} onClick={() => setTab('quiz')}><Icon name="heart" size={15} /> Couple quiz</button>
        <button className={`chip ${tab === 'visit' ? 'on' : ''}`} onClick={() => setTab('visit')}><Icon name="world" size={15} /> Visit</button>
      </div>
      {tab === 'stars' && <StarCatch />}
      {tab === 'quiz' && <CoupleQuiz />}
      {tab === 'visit' && <Visits onVisit={k => { onVisit(k); onClose() }} />}
    </Modal>
  )
}
