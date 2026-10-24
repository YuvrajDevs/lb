import { useEffect, useRef, useState } from 'react'
import { Mark } from './Title'

// A new player's first moment: your name (the one everyone sees, everywhere) and your home's name (painted on
// its sign). Then the cloud over your plot parts and your home rises out of it, with you inside (see arrive() in
// world/game.js), and the guide begins. Your name can be changed later in Settings, the sign in Edit home.

export default function Welcome({ initialName = '', onDone }) {
  const [name, setName] = useState(initialName)
  const [house, setHouse] = useState('')
  const [houseTouched, setHouseTouched] = useState(false)
  const input = useRef(null)
  useEffect(() => { setTimeout(() => input.current?.focus(), 300) }, [])
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 16)
  const houseName = (houseTouched ? house : clean ? `${clean}'s home` : '').trim().slice(0, 24)
  const ok = clean.length >= 1 && houseName.length >= 1
  const go = e => { e.preventDefault(); if (ok) onDone({ name: clean, house: houseName }) }
  return (
    <div className="welcome">
      <form className="welcome-card" onSubmit={go}>
        <Mark size={54} />
        <p className="mg-kicker">Welcome to the neighbourhood</p>
        <h1 className="mg-title small">Who's moving in?</h1>
        <hr className="mg-rule" />
        <label className="welcome-field">
          <span>Your name</span>
          <input ref={input} value={name} maxLength={16} placeholder="What should people call you?" autoComplete="nickname" onChange={e => setName(e.target.value)} />
          <small>This is the name everyone sees. You can change it later in Settings.</small>
        </label>
        <label className="welcome-field">
          <span>Your home's name</span>
          <input value={houseTouched ? house : houseName} maxLength={24} placeholder="Name your home" onChange={e => { setHouseTouched(true); setHouse(e.target.value) }} />
          <small>Painted on the sign at your gate. You can change it in Edit home.</small>
        </label>
        <nav className="mg-menu">
          <button className={ok ? 'on' : ''} disabled={!ok}>Move in</button>
        </nav>
      </form>
    </div>
  )
}
