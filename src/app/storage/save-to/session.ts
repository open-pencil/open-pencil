import { useLocalStorage, useOnline } from '@vueuse/core'
import { markRaw, reactive, ref, shallowRef, type Raw } from 'vue'

import { CLOUD_INCLUDED, cloudUploadFailure, signInToSaveTo } from '@/app/cloud/integration'
import type { EditorStore } from '@/app/editor/session'
import { openSettingsDialog } from '@/app/settings/dialog'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { followUpload } from '@/app/storage/sync'
import { IS_BROWSER } from '@/constants'

import { listSaveDestinations } from './destinations'
import { canSaveTo, type SaveDestination, type SaveFailure, type SaveToState } from './model'
import { writeDocumentTo } from './write'

/** One Save to, from choosing where the document goes until it is there. */
export type SaveToSession = {
  /** Kept raw: the session is reactive, and the store has refs of its own. */
  store: Raw<EditorStore>
  destinations: SaveDestination[]
  name: string
  /** The chosen destination's key. */
  chosen: string
  state: SaveToState
  /** The dialog shows when there is a choice to make, the save is slow, or it failed. */
  open: boolean
  /** Stops following the upload once the person closes the dialog; the upload goes on. */
  following: AbortController
}

/** How long a save with nothing to choose runs before the dialog shows its progress. */
const QUIET_SAVE_MS = 1000

/** The Save to the dialog shows, if any. */
export const saveToSession = shallowRef<SaveToSession | null>(null)

/** The destination saved to last, chosen first next time. */
const lastDestination = IS_BROWSER ? useLocalStorage('open-pencil:save-destination', '') : ref('')
const online = useOnline()

function fail(session: SaveToSession, failure: SaveFailure): void {
  session.state = { kind: 'error', ...failure }
  session.open = true
}

/**
 * Save to: straight to the only place the document can go, or a choice when there are several.
 * With nowhere to save yet, it signs in to the Cloud server this app knows, or opens the settings
 * where a place to save is set up. While a save is on its way, it shows that one instead.
 */
export async function openSaveTo(store: EditorStore): Promise<void> {
  const current = saveToSession.value
  if (current?.state.kind === 'saving' && !current.following.signal.aborted) {
    current.open = true
    return
  }
  const destinations = await listSaveDestinations()
  const writable = destinations.filter(canSaveTo)
  const first = writable.at(0)
  if (!first) {
    if (!signInToSaveTo()) openSettingsDialog(CLOUD_INCLUDED ? 'cloud' : 'storage')
    return
  }
  const last = writable.find((destination) => destination.key === lastDestination.value)
  saveToSession.value = reactive<SaveToSession>({
    store: markRaw(store),
    destinations,
    name: store.state.documentName || 'Untitled',
    chosen: (last ?? first).key,
    state: { kind: 'ready' },
    open: writable.length > 1,
    following: markRaw(new AbortController())
  })
  if (writable.length === 1) await confirmSaveTo()
}

/**
 * Saves the document to the chosen destination and follows its upload until it is there. The tab
 * moves to the saved copy at once; the file it came from is left as it was.
 */
export async function confirmSaveTo(): Promise<void> {
  const session = saveToSession.value
  const destination = session?.destinations.find(({ key }) => key === session.chosen)
  const name = session?.name.trim()
  if (!session || !destination || !canSaveTo(destination) || !name) return
  if (session.state.kind === 'saving') return
  if (!online.value) return fail(session, { reason: 'offline' })

  session.state = { kind: 'saving', sentBytes: 0, totalBytes: 0 }
  const slow = setTimeout(() => {
    session.open = true
  }, QUIET_SAVE_MS)
  try {
    const binding = await writeDocumentTo(session.store, destination.location, name)
    if (!binding) return fail(session, { reason: 'unavailable' })
    lastDestination.value = destination.key
    const meta = await getLocalCanvasStore().getMeta(binding.documentId)
    const totalBytes = meta?.figSize ?? 0
    const outcome = await followUpload(binding.documentId, {
      signal: session.following.signal,
      onProgress: (sent) => {
        session.state = { kind: 'saving', sentBytes: sent * totalBytes, totalBytes }
      }
    })
    if (outcome === 'failed') {
      const failure = await cloudUploadFailure(destination.location, totalBytes)
      return fail(session, failure ?? { reason: 'unavailable' })
    }
    session.state = { kind: 'ready' }
    session.open = false
  } finally {
    clearTimeout(slow)
  }
}

/** Closes the dialog; a save on its way goes on in the background. */
export function closeSaveTo(): void {
  const session = saveToSession.value
  if (!session) return
  session.following.abort()
  session.open = false
}
