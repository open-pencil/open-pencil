import { useDebounceFn, useEventListener } from '@vueuse/core'
import { watch } from 'vue'

import {
  clearSessionSnapshot,
  readSessionSnapshot,
  saveSessionSnapshot
} from '@/app/document/session/store'
import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'

/** Long enough that typing does not serialise the document on every keystroke. */
const PERSIST_DEBOUNCE_MS = 2000

async function snapshotActiveDocument(): Promise<void> {
  const store = getActiveEditorStoreOrNull()
  if (!store) return
  // An untouched blank document is not worth restoring over a fresh start.
  if (store.graph.getPages().every((page) => store.graph.getChildren(page.id).length === 0)) {
    await clearSessionSnapshot()
    return
  }
  try {
    const bytes = await store.exportNativeDocument()
    const identity = store.getSourceIdentity()
    await saveSessionSnapshot({
      name: store.state.documentName || 'Untitled',
      sourceFormat: store.state.documentKind === 'deck' ? 'deck' : 'fig',
      bytes,
      handle: identity.handle ?? null,
      savedAt: Date.now()
    })
  } catch (error) {
    // Persistence is best-effort: a failure here must never interrupt editing.
    console.warn('[session] could not persist the open document', error)
  }
}

/**
 * Keep the open document across a reload.
 *
 * Reloading the tab previously dropped whatever was open and left a blank Untitled, which
 * is easy to hit by accident and loses unsaved work. The document is serialised in its own
 * native format after edits settle, and restored on the next start.
 */
export function useSessionPersistence(): void {
  const persist = useDebounceFn(() => void snapshotActiveDocument(), PERSIST_DEBOUNCE_MS)

  watch(
    () => getActiveEditorStoreOrNull()?.state.sceneVersion,
    (version) => {
      if (version === undefined) return
      void persist()
    }
  )

  // A debounce can be cut short by the tab going away; pagehide is the last reliable point.
  useEventListener(window, 'pagehide', () => void snapshotActiveDocument())
}

/**
 * The document from the previous session, as a File ready for the normal open path, so a
 * restore behaves exactly like opening the file by hand.
 */
/**
 * Whether the stored handle can still be used without prompting.
 *
 * A handle survives a reload, but the permission behind it does not: reading one without a
 * fresh user gesture throws "The request is not allowed by the user agent". Restoring the
 * bytes is what matters, so an unusable handle is simply dropped and the document reopens
 * detached — Save As relinks it.
 */
type PermissionQueryable = {
  queryPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
}

async function handleStillReadable(handle: FileSystemFileHandle | null): Promise<boolean> {
  if (!handle) return false
  const query = (handle as FileSystemFileHandle & PermissionQueryable).queryPermission
  if (typeof query !== 'function') return false
  try {
    return (await query.call(handle, { mode: 'readwrite' })) === 'granted'
  } catch (error) {
    console.warn('[session] could not check file permission', error)
    return false
  }
}

export async function takeRestorableDocument(): Promise<{
  file: File
  handle: FileSystemFileHandle | null
} | null> {
  const snapshot = await readSessionSnapshot()
  if (!snapshot || snapshot.bytes.byteLength === 0) return null
  const extension = snapshot.sourceFormat === 'deck' ? 'deck' : 'fig'
  const name = /\.(deck|fig)$/i.test(snapshot.name)
    ? snapshot.name
    : `${snapshot.name}.${extension}`
  const bytes = new Uint8Array(snapshot.bytes)
  const handle = (await handleStillReadable(snapshot.handle ?? null))
    ? (snapshot.handle ?? null)
    : null
  return {
    file: new File([bytes.buffer], name, { type: 'application/octet-stream' }),
    handle
  }
}
