import { IS_TAURI } from '@open-pencil/core/constants'

import { sessionStore, type ReloadStorage } from './chunk-reload-storage'

/** Where the time of the last reload is kept, so a chunk that stays missing cannot loop. */
const RELOAD_KEY = 'openpencil:chunk-reload-at'
const RELOAD_WINDOW_MS = 60_000

/**
 * Whether this page may reload for a missing chunk, and if so, records that it did. A page reloads
 * once per window: when the chunk is still missing afterwards, the error is a real one.
 */
export function claimChunkReload(storage: ReloadStorage | null, now: number): boolean {
  if (!storage) return false
  try {
    const stored = storage.getItem(RELOAD_KEY)
    const last = stored === null ? Number.NaN : Number(stored)
    // A time ahead of `now` means the clock went back; it says nothing about a recent reload.
    if (Number.isFinite(last) && last <= now && now - last < RELOAD_WINDOW_MS) return false
    storage.setItem(RELOAD_KEY, String(now))
    return true
  } catch {
    return false
  }
}

export interface ChunkReloadOptions {
  target?: EventTarget
  storage?: ReloadStorage | null
  reload?: () => void
  now?: () => number
}

/**
 * Reload the page once when a lazy chunk fails to load in the web app.
 *
 * A deploy replaces the hashed chunk files, so a tab opened before it asks for files that no longer
 * exist; Chrome also keeps a failed module fetch for the life of the document. Reloading fetches
 * the current `index.html` and its chunks. Vite announces the failure as `vite:preloadError`; when
 * the page has already reloaded for it, the event is left alone and the import fails as usual.
 * Desktop builds ship their chunks inside the app and never need this.
 */
export function reloadOnceOnChunkError(options: ChunkReloadOptions = {}): void {
  if (IS_TAURI) return
  const {
    target = window,
    storage = sessionStore(),
    reload = () => window.location.reload(),
    now = Date.now
  } = options
  target.addEventListener('vite:preloadError', (event) => {
    if (!claimChunkReload(storage, now())) return
    event.preventDefault()
    reload()
  })
}
