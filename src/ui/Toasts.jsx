import { useStore } from './useStore'
import { Icon } from './icons'

export default function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <Icon name={t.kind === 'warn' ? 'info' : 'check'} size={16} /> {t.text}
        </div>
      ))}
    </div>
  )
}
