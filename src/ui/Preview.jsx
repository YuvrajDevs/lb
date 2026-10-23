import { useEffect, useState } from 'react'
import { cachedPreview, previewOf } from '../world/preview'

/** a shop item's picture; renders it on demand and shows a soft shimmer until it is ready */
export default function Preview({ id, size = 150, className = '' }) {
  const [src, setSrc] = useState(() => cachedPreview(id))
  useEffect(() => {
    let alive = true
    setSrc(cachedPreview(id))
    if (!cachedPreview(id)) previewOf(id).then(u => { if (alive) setSrc(u) })
    return () => { alive = false }
  }, [id])
  return (
    <div className={`pv ${src ? '' : 'loading'} ${className}`} style={{ width: size, height: size }}>
      {src && <img src={src} alt="" width={size} height={size} draggable="false" />}
    </div>
  )
}
