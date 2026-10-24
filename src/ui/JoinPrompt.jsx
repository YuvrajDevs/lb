import { useEffect, useState } from 'react'
import Modal from './Modal'
import { store } from '../game/store'
import { Icon } from './icons'

// Someone sent you an invite link (?join=CODE). Signed in: who invited you to which world, and Join. As a guest:
// sign in first; the code waits on this device until you are back.

const KEY = 'nb:join'
export const pendingJoin = () => { try { return localStorage.getItem(KEY) } catch { return null } }
export const clearJoin = () => { try { localStorage.removeItem(KEY) } catch { /* private mode */ } }

/** read ?join=CODE from the address once, keep it, and tidy the address bar */
export function takeJoinFromUrl() {
  const q = new URLSearchParams(location.search)
  const code = q.get('join')
  if (!code) return
  try { localStorage.setItem(KEY, code.toUpperCase().slice(0, 6)) } catch { /* private mode */ }
  q.delete('join')
  history.replaceState(null, '', location.pathname + (q.toString() ? `?${q}` : '') + location.hash)
}

export default function JoinPrompt({ code, signedIn, onClose, onSignIn }) {
  const [peek, setPeek] = useState(undefined)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!signedIn) return
    store.server().peekInvite(code).then(setPeek, () => setPeek(null))
  }, [code, signedIn])
  const done = () => { clearJoin(); onClose() }
  return (
    <Modal title="An invite" subtitle={`Code ${code}`} onClose={done}>
      <div className="account">
        <div className="account-art" style={{ color: 'var(--gold)' }}><Icon name="world" size={30} /></div>
        {!signedIn && (
          <>
            <h3>Sign in to join</h3>
            <p className="soft">Someone invited you to live next door to them. Sign in with Google and we'll take you straight there.</p>
            <button className="btn primary big" onClick={onSignIn}>Sign in</button>
          </>
        )}
        {signedIn && peek === undefined && <p className="soft">Looking it up…</p>}
        {signedIn && peek === null && (
          <>
            <h3>This invite has expired</h3>
            <p className="soft">Invites last 7 days. Ask your friend for a new link.</p>
            <button className="btn ghost" onClick={done}>Close</button>
          </>
        )}
        {signedIn && peek && (
          <>
            <h3>{peek.name}</h3>
            <p className="soft"><b>{peek.from}</b> invited you to live next door. {peek.members} of {peek.slots} homes are taken.</p>
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button className="btn primary" disabled={busy} onClick={async () => {
                setBusy(true)
                try { await store.server().joinWorld(code); store.notify(`Welcome to ${peek.name}!`, 'good'); done() } catch (e) { store.notify(e.message, 'warn'); setBusy(false) }
              }}>{busy ? 'Moving in…' : 'Move in'}</button>
              <button className="btn ghost" onClick={done}>Not now</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
