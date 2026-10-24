// Keeps the game's files so it opens quickly (and without a connection) once installed.
// Network first for the page itself, so a new version is picked up as soon as you are online.
const CACHE = 'lovebloxed-v1'
self.addEventListener('install', e => { self.skipWaiting() })
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())))
self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  const isPage = req.mode === 'navigate'
  e.respondWith(
    (isPage ? fetch(req).then(res => { caches.open(CACHE).then(c => c.put(req, res.clone())); return res }).catch(() => caches.match(req))
      : caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) } return res })))
  )
})
