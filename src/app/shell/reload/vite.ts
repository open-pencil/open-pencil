import { pageAsksBeforeLeaving } from '@/app/document/close/exit'
import { announceReload } from '@/app/shell/reload'

/**
 * Announces the development server's reloads, which wait for the page's listeners
 * (vite/dist/client/client.mjs, `notifyListeners`). Production builds have no `import.meta.hot`.
 */
export function announceViteReloads(): void {
  const hot = import.meta.hot
  if (!hot) return
  const announce = () => announceReload({ asks: pageAsksBeforeLeaving() })
  /* eslint-disable typescript-eslint/no-misused-promises -- Vite awaits custom event listeners. */
  hot.on('vite:beforeFullReload', async ({ path }) => {
    // Vite announces an edit to another HTML page, such as `updater.html`, to every page but
    // reloads only that one; the editor is always `index.html`, so it keeps running.
    if (path?.endsWith('.html') && path !== '/index.html') return
    await announce()
  })
  // Vite reloads the page whenever its server comes back.
  hot.on('vite:ws:disconnect', announce)
  /* eslint-enable typescript-eslint/no-misused-promises */
}
