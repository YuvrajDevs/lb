// Minimal line icons (24px grid, stroke = currentColor). One place so the whole UI stays consistent.
const P = {
  shop: 'M5 8h14l-1 11H6L5 8zM9 8V6a3 3 0 016 0v2',
  wardrobe: 'M4 3h16v18H4zM12 3v18M9 11v2M15 11v2',
  gift: 'M4 9h16v4H4zM6 13h12v8H6zM12 9v12M12 9C9 9 8 5 10 4s2 5 2 5zm0 0c3 0 4-4 2-5s-2 5-2 5z',
  world: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-1-3-2 .5-1.5-1.5L17 5l-3-1-1 2h-2L10 4 7 5l.5 2L6 8.5 4 8 3 11l2 1v2l-2 1 1 3 2-.5L7.5 19 7 21l3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1v-2z',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.500-7 10-7 10z',
  plus: 'M12 5v14M5 12h14',
  chevron: 'M9 6l6 6-6 6',
  bed: 'M3 18V7M3 14h18v4M21 14v-3a3 3 0 00-3-3h-8v6M6.500 11.500a1.500 1.500 0 100-.01',
  table: 'M4 9h16M6 9v10M18 9v10M5 9l1-3h12l1 3',
  shelf: 'M5 3v18M19 3v18M5 9h14M5 15h14M8 9V6M11 9V5M15 15v-3M12 15v-4',
  sofa: 'M4 12V9a2 2 0 012-2h12a2 2 0 012 2v3M3 12h18v5H3zM5 17v2M19 17v2',
  lamp: 'M8 4h8l2 8H6zM12 12v7M8 20h8',
  pendant: 'M12 3v6M7 9h10l2 6H5zM10 18h4',
  rug: 'M3 8h18v8H3zM6 11h12M6 13h12',
  plant: 'M12 21v-8M12 13c-4 0-6-3-6-7 4 0 6 3 6 7zm0 0c4 0 6-3 6-7-4 0-6 3-6 7zM8 21h8',
  frame: 'M4 4h16v16H4zM8 8h8v8H8zM9 14l2-2 2 2 2-3',
  curtain: 'M3 4h18M5 4v16h5V4M14 4v16h5V4',
  paint: 'M5 4h12a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM18 7h2v5h-8v3M11 15h2v6h-2z',
  floor: 'M3 15l9-5 9 5-9 5zM3 15v2l9 5 9-5v-2',
  fence: 'M4 20V8l2-2 2 2v12M10 20V8l2-2 2 2v12M16 20V8l2-2 2 2v12M3 12h18M3 17h18',
  sign: 'M5 5h14v8H5zM8 13v8M16 13v8',
  lantern: 'M10 3h4M9 5h6l1 3v8l-1 3H9l-1-3V8zM12 8v8',
  cube: 'M12 3l8 4.500v9L12 21l-8-4.500v-9zM12 12l8-4.500M12 12v9M12 12L4 7.500',
  hat: 'M6 16h12M8 16V9a4 4 0 018 0v7M4 19h16',
  music: 'M9 18V6l10-2v12M9 18a2.500 2.500 0 11-5 0 2.500 2.500 0 015 0zm10-2a2.500 2.500 0 11-5 0 2.500 2.500 0 015 0z',
  chat: 'M4 5h16v11H9l-5 4zM8 10h8',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  keyboard: 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  couple: 'M8 11a3 3 0 100-6 3 3 0 000 6zM2 20a6 6 0 0112 0M17 10a2.500 2.500 0 100-5M16 14a5 5 0 016 6',
  cloud: 'M7 18a4 4 0 010-8 5 5 0 019.500-1A4.500 4.500 0 0117 18z',
  star: 'M12 3l2.600 5.600 6.100.8-4.500 4.200 1.200 6L12 16.800 6.600 19.600l1.200-6L3.300 9.400l6.100-.8z',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4',
  info: 'M12 8v.01M12 11v6M3 12a9 9 0 1018 0 9 9 0 00-18 0z',
}

export function Icon({ name, size = 20, className = '', title }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={P[name] || P.info} />
    </svg>
  )
}

/** the Boxet currency mark: a tiny amber cube */
export function Boxet({ size = 16 }) {
  return (
    <svg className="boxet" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l9 5v10l-9 5-9-5V7z" fill="#ffc15a" />
      <path d="M12 2l9 5-9 5-9-5z" fill="#ffe29a" />
      <path d="M12 12v10l9-5V7z" fill="#e8a02f" />
    </svg>
  )
}
