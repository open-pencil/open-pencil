import { VitePWA } from 'vite-plugin-pwa'

export function inklyPwaPlugin() {
  return VitePWA({
    registerType: 'autoUpdate',
    devOptions: { enabled: false },
    workbox: {
      maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      globPatterns: ['**/*.{js,css,html,wasm,png,ico,ttf,webmanifest}'],
      navigateFallback: '/index.html',
      // 新 SW を install したら待機させず即 activate、 古い SW (= 古い bundle を
      // 配信中) を強制終了して新 bundle に差し替える。 これにより deploy 後の初回
      // ロードで古いキャッシュが残らず、 ハードリロードや SW 手動 unregister が不要。
      skipWaiting: true,
      // 起動済 client (= 開いてるタブ) を新 SW の制御下に取り込む、 新 SW activate
      // 直後から全タブで新 bundle が serve される。 skipWaiting と組合せで「新 deploy
      // が次回ナビゲーションで自動反映」が成立する。
      clientsClaim: true,
      // 古いキャッシュエントリ (前 deploy の残骸) を新 SW activate 時に削除、
      // ディスク容量肥大化防止 + 古い chunk が誤って返るリスク排除。
      cleanupOutdatedCaches: true
    },
    manifest: {
      name: 'Inkly',
      short_name: 'Inkly',
      description: 'Open-source design editor',
      display: 'standalone',
      orientation: 'any',
      start_url: '/',
      scope: '/',
      theme_color: '#1e1e1e',
      background_color: '#1e1e1e',
      categories: ['design', 'productivity'],
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    }
  })
}
