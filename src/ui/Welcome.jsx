import { useEffect, useRef, useState } from 'react'
import { Mark } from './Title'
import { rpc } from '../net/client'

// A new player's first moment: your name (the one everyone sees, everywhere), your username (how friends find
// you, unique) and your home's name (painted on its sign). Then the guide begins. Your name can be changed later in
// Settings, the sign in Edit home.

export default function Welcome({ initialName = '', onDone, online = false }) {
  const [name, setName] = useState(initialName)
  const [user, setUser] = useState('')
  const [userOk, setUserOk] = useState(null) // null: not checked yet, true / false: free or taken
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const handle = user.trim().toLowerCase()
  const handleValid = /^[a-z0-9_]{3,16}$/.test(handle)
  // is the username free? (asked a moment after you stop typing)
  useEffect(() => {
    setUserOk(null)
    if (!online || !handleValid) return
    const t = setTimeout(() => rpc('tag_available', { p_tag: handle }).then(setUserOk, () => setUserOk(null)), 350)
    return () => clearTimeout(t)
  }, [handle, handleValid, online])
  const [house, setHouse] = useState('')
  const [houseTouched, setHouseTouched] = useState(false)
  const input = useRef(null)
  useEffect(() => { setTimeout(() => input.current?.focus(), 300) }, [])
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 16)
  const houseName = (houseTouched ? house : clean ? `${clean}'s home` : '').trim().slice(0, 24)
  const ok = clean.length >= 1 && houseName.length >= 1 && (!online || (handleValid && userOk === true)) && !busy
  const go = async e => {
    e.preventDefault()
    if (!ok) return
    setBusy(true); setErr(null)
    try {
      if (online) await rpc('set_tag', { p_tag: handle })
      onDone({ name: clean, house: houseName, tag: online ? handle : undefined })
    } catch (x) { setErr(x.message); setBusy(false) }
  }
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
        {online && (
          <label className="welcome-field">
            <span>Your username</span>
            <input value={user} maxLength={16} placeholder="how friends find you" autoComplete="username" onChange={e => setUser(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
            <small className={userOk === false ? 'bad' : userOk ? 'good' : ''}>
              {!user ? '3 to 16 letters, numbers or _. Friends add you by it.'
                : !handleValid ? 'At least 3 characters: letters, numbers or _'
                  : userOk === false ? 'That one is taken. Try another.' : userOk ? 'It\'s yours!' : 'Checking…'}
            </small>
          </label>
        )}
        <label className="welcome-field">
          <span>Your home's name</span>
          <input value={houseTouched ? house : houseName} maxLength={24} placeholder="Name your home" onChange={e => { setHouseTouched(true); setHouse(e.target.value) }} />
          <small>Painted on the sign at your gate. You can change it in Edit home.</small>
        </label>
        {err && <p className="account-err">{err}</p>}
        <nav className="mg-menu">
          <button className={ok ? 'on' : ''} disabled={!ok}>Move in</button>
        </nav>
      </form>
    </div>
  )
}
