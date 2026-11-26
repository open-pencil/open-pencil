import { VitePWA } from 'vite-plugin-pwa'

/** Shiki emits every grammar and theme it has; they are cached on first use, not precached. */
export function chunkFileNames({ moduleIds }: { moduleIds: string[] }) {
  // A facade chunk has no modules of its own, and it belongs with the app.
  const shikiData =
    moduleIds.length > 0 && moduleIds.every((id) => /\/@shikijs\/(langs|themes)\//.test(id))
  return shikiData ? 'assets/shiki/[name]-[hash].js' : 'assets/[name]-[hash].js'
}

export function openPencilPwaPlugin() {
  return VitePWA({
    // A new version waits until the person reloads (`src/app/shell/updater/web.ts`): the page
    // keeps its own version's files meanwhile, which a deploy may have removed from the server.
    registerType: 'prompt',
    devOptions: { enabled: false },
    // Our own worker (`src/service-worker`), so which pages the editor serves follows the server's
    // own routes instead of a copied list. Its file stays `sw.js`, which installed workers update from.
    strategies: 'injectManifest',
    srcDir: 'src/service-worker',
    filename: 'sw.ts',
    injectManifest: {
      // Registered as a classic script, as the generated worker was.
      rollupFormat: 'iife',
      maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      // A map the release then removes would be linked; the worker's errors never reach error
      // reports anyway.
      sourcemap: false,
      globPatterns: ['**/*.{js,css,html,wasm,png,svg,ico,ttf,webmanifest}'],
      globIgnores: ['assets/shiki/**']
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
