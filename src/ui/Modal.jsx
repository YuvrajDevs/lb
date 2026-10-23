import { useEffect, useRef } from 'react'
import { Icon } from './icons'

export default function Modal({ title, subtitle, onClose, children, wide, right }) {
  const ref = useRef(null)
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scrim" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <section className={`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <header className="sheet-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="sheet-right">
            {right}
            <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
          </div>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  )
}
