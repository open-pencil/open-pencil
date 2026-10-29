import { VitePWA } from 'vite-plugin-pwa'

/**
 * Pages that are not the editor's: OAuth callbacks, which relay a redirect, and, where a Cloud
 * server serves the editor, its API and its own pages, `CLOUD_PORTAL_PAGE_ROOTS` in
 * `@open-pencil/cloud/contract`, which loads only once packages are built. Workbox matches the
 * path with its query, so a page root may be followed by `?` as well as `/`.
 */
export const NOT_EDITOR_PAGES = [
  /^\/oauth\//,
  /^\/api\//,
  /^\/\.well-known\//,
  /^\/(?:welcome|auth|account|admin)(?:[/?]|$)/
]

export function openPencilPwaPlugin() {
  return VitePWA({
    registerType: 'autoUpdate',
    devOptions: { enabled: false },
    workbox: {
      maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      globPatterns: ['**/*.{js,css,html,wasm,png,svg,ico,ttf,webmanifest}'],
      navigateFallback: '/index.html',
      navigateFallbackDenylist: NOT_EDITOR_PAGES
    },
    manifest: {
      name: 'OpenPencil',
      short_name: 'OpenPencil',
      description: 'Open-source design editor',
      display: 'standalone',
      orientation: 'any',
      start_url: '/',
      scope: '/',
      theme_color: '#1e1e1e',
      background_color: '#1e1e1e',
      categories: ['design', 'productivity'],
      icons: [
        { src: '/brand/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/brand/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        {
          src: '/brand/pwa-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    }
  })
}
