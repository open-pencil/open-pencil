/// <reference lib="webworker" />
/**
 * The web editor's service worker, which vite-plugin-pwa builds with the precache manifest
 * (`vite/pwa.ts`). It keeps the editor's files for offline use and serves the editor's page for
 * every navigation the server does not own (`servedByServer`).
 */
import { ExpirationPlugin } from 'workbox-expiration'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute
} from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'

import { servedByServer } from './routes'

declare let self: ServiceWorkerGlobalScope

// A new version waits until the person takes it (`src/app/shell/updater/web.ts`), which
// vite-plugin-pwa's client asks for with this message.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data: unknown = event.data
  if (typeof data === 'object' && data !== null && 'type' in data && data.type === 'SKIP_WAITING')
    void self.skipWaiting()
})

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(
  ({ request, url }) => request.mode === 'navigate' && !servedByServer(url.pathname),
  createHandlerBoundToURL('/index.html')
)

// Shiki's grammars and themes are cached on first use, not precached (`chunkFileNames`).
registerRoute(
  ({ url }) => url.pathname.startsWith('/assets/shiki/'),
  new CacheFirst({ cacheName: 'shiki', plugins: [new ExpirationPlugin({ maxEntries: 100 })] })
)
