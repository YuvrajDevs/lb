import { useState } from 'react'
import Modal from './Modal'
import { useStore } from './useStore'
import { store } from '../game/store'
import { signInWithGoogle, signOut, deleteAccount } from '../net/account'
import { Icon } from './icons'

// Your account. As a guest: sign in with Google (no password to make up), which keeps your home safe and lets you
// play with friends. Signed in: who you are (your tag is how friends find you), sign out, or delete
// everything for good.

export default function Account({ onClose }) {
  const s = useStore()
  const signedIn = s.net?.status === 'online'
  return (
    <Modal title="Your account" subtitle={signedIn ? `Signed in as ${s.net.email}` : 'Playing as a guest on this device'} onClose={onClose}>
      {signedIn ? <SignedIn s={s} onClose={onClose} /> : <SignIn status={s.net?.status} error={s.net?.error} />}
    </Modal>
  )
}

function SignIn({ status, error }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const go = async () => {
    setBusy(true); setErr(null)
    try { await signInWithGoogle() } catch (x) { setErr(x.message); setBusy(false) } // (on success the page goes to Google)
  }
  if (status === 'loading') return <p className="soft">Opening your account…</p>
  return (
    <div className="account">
      <ul className="account-perks">
        <li><Icon name="world" /><span><b>Play together</b>Friends and your partner in your world, live.</span></li>
        <li><Icon name="heart" /><span><b>Keep your home safe</b>On every device you sign in on. Your guest home comes with you.</span></li>
        <li><Icon name="bolt" /><span><b>Earn more</b>Up to 3× with friends, 3× more with your partner.</span></li>
      </ul>
      {(err || error) && <p className="account-err">{err || error}</p>}
      <button className="btn google big" disabled={busy} onClick={go}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>
      <p className="soft small">We only use your Google account to sign you in: your name in the game is yours to choose. By signing in you agree to play kindly, and you must be 13 or older.</p>
    </div>
  )
}

function SignedIn({ s, onClose }) {
  const [confirm, setConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const copy = () => navigator.clipboard?.writeText(s.profile.tag).then(() => store.notify('Your tag is copied: send it to a friend', 'good'))
  return (
    <div className="account">
      <div className="row">
        <span><b>{s.profile.name}</b><small>Your tag, how friends find you: <b className="tag">{s.profile.tag}</b></small></span>
        <button className="btn ghost" onClick={copy}>Copy tag</button>
      </div>
      <div className="row">
        <span><b>Sign out</b><small>Your home stays safe in your account. On this device you go back to the guest home.</small></span>
        <button className="btn ghost" onClick={() => { signOut(); onClose() }}>Sign out</button>
      </div>
      <details className="danger-zone">
        <summary>Delete my account</summary>
        <p className="soft">This deletes your home, your Boxets, everything you own and your messages, for good. You leave your worlds and any couple. It can't be undone.</p>
        <label className="field">
          <span>Type DELETE to confirm</span>
          <input value={confirm} onChange={e => setConfirm(e.target.value)} />
        </label>
        <button className="btn ghost danger" disabled={confirm !== 'DELETE' || deleting}
          onClick={async () => { setDeleting(true); try { await deleteAccount(); store.notify('Your account is deleted', 'info'); onClose() } catch (e) { store.notify(e.message, 'warn'); setDeleting(false) } }}>
          {deleting ? 'Deleting…' : 'Delete everything'}
        </button>
      </details>
    </div>
  )
}
