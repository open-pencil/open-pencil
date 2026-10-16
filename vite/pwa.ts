import process from 'node:process'

import { escapeRegExp } from 'es-toolkit/string'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Paths the server owns, such as OAuth callbacks that relay a redirect. A navigation to one must
 * reach the server instead of getting the cached editor shell, which would swallow the sign-in.
 * `/oauth/` is the editor's own relay page; `/oauth2/` is where oauth2-proxy answers.
 */
const SERVER_OWNED_PATH_PREFIXES = ['/oauth/', '/oauth2/']

/**
 * The navigations the service worker leaves to the server: the paths above plus the prefixes in
 * `extraPrefixes`, a comma-separated list such as `/auth/,/sso` that a deployment behind another
 * sign-in proxy sets in `OPENPENCIL_PWA_SERVER_PATHS` when it builds the editor.
 */
export function pwaNavigateFallbackDenylist(extraPrefixes: string | undefined): RegExp[] {
  const extra = (extraPrefixes ?? '')
    .split(',')
    .map((prefix) => prefix.trim())
    .filter((prefix) => prefix !== '')
  for (const prefix of extra) {
    if (!prefix.startsWith('/')) {
      throw new Error(`OPENPENCIL_PWA_SERVER_PATHS entries must start with "/": ${prefix}`)
    }
  }
  // An entry ending in `/` covers what is under it; any other entry also covers the path itself,
  // with or without a query, as Workbox matches the pathname plus the search string.
  return [...SERVER_OWNED_PATH_PREFIXES, ...extra].map((prefix) =>
    prefix.endsWith('/')
      ? new RegExp(`^${escapeRegExp(prefix)}`)
      : new RegExp(`^${escapeRegExp(prefix)}(?:[/?]|$)`)
  )
}

export function openPencilPwaPlugin() {
  return VitePWA({
    registerType: 'autoUpdate',
    devOptions: { enabled: false },
    workbox: {
      maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      globPatterns: ['**/*.{js,css,html,wasm,png,svg,ico,ttf,webmanifest}'],
      navigateFallback: '/index.html',
      navigateFallbackDenylist: pwaNavigateFallbackDenylist(process.env.OPENPENCIL_PWA_SERVER_PATHS)
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
