const CACHE_NAME = 'oraforme-v1'
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
]

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: network-first with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Skip non-GET and non-http requests
  if (request.method !== 'GET') return
  if (!request.url.startsWith('http')) return

  // API calls: network only
  if (request.url.includes('/api/') || request.url.includes('supabase.co')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful GET responses (pages, JS, CSS)
        if (response.status === 200 && !request.url.includes('_next/data')) {
          const cloned = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned))
        }
        return response
      })
      .catch(() => {
        // Offline fallback: serve from cache
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // For navigation requests, show offline page
          if (request.mode === 'navigate') {
            return caches.match('/') ?? new Response('Hors ligne — reconnectez-vous', {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
          }
          return new Response('', { status: 503 })
        })
      })
  )
})

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Oraforme', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag ?? 'oraforme',
      data: { url: data.url ?? '/dashboard' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/dashboard'
  event.waitUntil(clients.openWindow(url))
})
