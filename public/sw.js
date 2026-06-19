const CACHE_VERSION  = 'oraforme-v3'
const STATIC_ASSETS  = [
  '/',
  '/dashboard',
  '/pricing',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.png',
  '/logo-icon.png',
]

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {})
    )
  )
  self.skipWaiting()
})

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return
  if (!request.url.startsWith('http')) return

  // Supabase & API — toujours réseau, jamais mis en cache
  if (
    request.url.includes('supabase.co') ||
    request.url.includes('/api/') ||
    request.url.includes('sentry.io')
  ) return

  // Assets Next.js (_next/static) — cache-first (immuables par hash)
  if (request.url.includes('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const cloned = response.clone()
            caches.open(CACHE_VERSION).then((c) => c.put(request, cloned))
          }
          return response
        })
      })
    )
    return
  }

  // Images — cache-first avec revalidation
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const cloned = response.clone()
            caches.open(CACHE_VERSION).then((c) => c.put(request, cloned))
          }
          return response
        }).catch(() => cached ?? new Response('', { status: 404 }))
      })
    )
    return
  }

  // Pages HTML — network-first, fallback cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const cloned = response.clone()
          caches.open(CACHE_VERSION).then((c) => c.put(request, cloned))
        }
        return response
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached
          if (request.mode === 'navigate') {
            return caches.match('/dashboard') ??
              caches.match('/') ??
              new Response(
                `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <title>Oraforme — Hors ligne</title>
                <style>
                  body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F5F7FB}
                  .box{text-align:center;padding:2rem;background:#fff;border-radius:1rem;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:380px}
                  h1{font-size:1.5rem;font-weight:800;color:#0F172A;margin-bottom:.5rem}
                  p{color:#64748B;font-size:.9rem;line-height:1.6}
                  a{display:inline-block;margin-top:1.5rem;padding:.75rem 2rem;background:#DC2626;color:#fff;border-radius:.75rem;text-decoration:none;font-weight:700;font-size:.9rem}
                </style></head><body>
                <div class="box">
                  <div style="font-size:3rem;margin-bottom:1rem">📡</div>
                  <h1>Hors ligne</h1>
                  <p>Oraforme fonctionne même sans internet.<br>Reconnectez-vous pour synchroniser vos données.</p>
                  <a href="/dashboard">Réessayer</a>
                </div></body></html>`,
                { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
              )
          }
          return new Response('', { status: 503 })
        })
      )
  )
})

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Oraforme', {
      body:  data.body  ?? '',
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      tag:   data.tag   ?? 'oraforme',
      data:  { url: data.url ?? '/dashboard' },
      actions: data.actions ?? [],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/dashboard'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})

// ─── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'oraforme-sync') {
    event.waitUntil(syncOfflineQueue())
  }
})

async function syncOfflineQueue() {
  try {
    const db = await openIDB()
    const tx = db.transaction('queue', 'readonly')
    const store = tx.objectStore('queue')
    const items = await getAllFromStore(store)

    for (const item of items) {
      try {
        await fetch(item.url, {
          method:  item.method,
          headers: { 'Content-Type': 'application/json', ...item.headers },
          body:    item.body,
        })
        // Supprimer de la queue si succès
        const delTx = db.transaction('queue', 'readwrite')
        delTx.objectStore('queue').delete(item.id)
      } catch {
        // Garder en queue pour le prochain sync
      }
    }
  } catch {
    // IDB non disponible
  }
}

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('oraforme-offline', 1)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess  = (e) => resolve(e.target.result)
    req.onerror    = () => reject(req.error)
  })
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}
