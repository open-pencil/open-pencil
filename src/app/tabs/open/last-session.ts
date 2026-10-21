import { useLocalStorage } from '@vueuse/core'
import * as v from 'valibot'

import {
  storageLocationOf,
  type StorageAdapter,
  type StorageDocument,
  type StorageDocumentBinding,
  type StorageDocumentMetadata,
  type StorageLocation
} from '@/app/integrations/storage'

const LAST_SESSION_STORAGE_KEY = 'open-pencil:last-session'

const sessionDocumentSchema = v.variant('kind', [
  v.object({ kind: v.literal('local'), path: v.string() }),
  v.object({
    kind: v.literal('storage'),
    providerId: v.string(),
    documentId: v.string(),
    name: v.string(),
    /** Which account and workspace the design lives in, when the provider has them. */
    profileId: v.optional(v.string()),
    containerId: v.optional(v.string())
  }),
  v.object({ kind: v.literal('room'), roomId: v.string() })
])

const lastSessionSchema = v.object({
  documents: v.array(sessionDocumentSchema),
  /** Index into `documents` of the tab that was in front, or -1. */
  active: v.number()
})

export type LastSessionDocument = v.InferOutput<typeof sessionDocumentSchema>
export type LastSession = v.InferOutput<typeof lastSessionSchema>

/** What a tab needs to expose to be reopened on the next start. */
export type SessionTab = {
  id: string
  kind: 'home' | 'document'
  /** The room this tab joined, if any; such a tab reopens by rejoining the room. */
  roomId?: string | null
  store: {
    state: { documentName: string }
    getStorageBinding(): StorageDocumentBinding | null
    getSourceIdentity(): { path: string | null }
  }
}

function describeTab(tab: SessionTab): LastSessionDocument | null {
  if (tab.kind !== 'document') return null
  if (tab.roomId) return { kind: 'room', roomId: tab.roomId }
  const binding = tab.store.getStorageBinding()
  if (binding) return { kind: 'storage', ...binding, name: tab.store.state.documentName }
  const path = tab.store.getSourceIdentity().path
  return path ? { kind: 'local', path } : null
}

export function describeOpenTabs(tabs: readonly SessionTab[], activeTabId: string): LastSession {
  const documents: LastSessionDocument[] = []
  let active = -1
  for (const tab of tabs) {
    const document = describeTab(tab)
    if (!document) continue
    if (tab.id === activeTabId) active = documents.length
    documents.push(document)
  }
  return { documents, active }
}

const LastSessionJSON = v.pipe(v.string(), v.parseJson(), lastSessionSchema)

/** Reads the stored session; anything unreadable reads as none. */
export function parseLastSession(raw: string | null): LastSession | null {
  const parsed = v.safeParse(LastSessionJSON, raw)
  return parsed.success ? parsed.output : null
}

/** The designs open when the app was last used. */
export const lastSession = useLocalStorage<LastSession | null>(LAST_SESSION_STORAGE_KEY, null, {
  serializer: {
    read: parseLastSession,
    write: (session) => JSON.stringify(session)
  }
})

export type LastSessionOpeners = {
  activeProviderId: string
  openPath(path: string): Promise<void>
  joinRoom(roomId: string): boolean
  /**
   * The remote's current metadata, so a newer remote copy wins over a cached one. Null when
   * the design is gone from storage; undefined when the provider cannot tell.
   */
  storageMetadata(
    documentId: string,
    location: StorageLocation
  ): Promise<StorageDocumentMetadata | null | undefined>
  openStorageDocument(document: StorageDocument, location: StorageLocation): Promise<void>
  activeTabId(): string
  focus(tabId: string): void
}

/**
 * A stored design's metadata for reopening it: null only when the design itself is gone, and
 * undefined when the provider cannot tell. A design whose .meta.json is missing or unreadable
 * is still there, so it reopens without metadata rather than being skipped as deleted.
 */
export async function storedDocumentMetadata(
  adapter: Pick<StorageAdapter, 'getDocumentMetadata' | 'documentExists'>,
  documentId: string
): Promise<StorageDocumentMetadata | null | undefined> {
  if (!adapter.getDocumentMetadata) return undefined
  const metadata = await adapter.getDocumentMetadata(documentId)
  if (metadata !== null || !adapter.documentExists) return metadata
  return (await adapter.documentExists(documentId)) ? undefined : null
}

/** Reopens every document in order; false when any of them could not open. */
export async function restoreLastSession(
  session: LastSession,
  openers: LastSessionOpeners
): Promise<boolean> {
  let allOpened = true
  const openedTabs = new Map<number, string>()
  for (const [index, document] of session.documents.entries()) {
    try {
      if (document.kind === 'local') {
        await openers.openPath(document.path)
      } else if (document.kind === 'room') {
        if (!openers.joinRoom(document.roomId)) throw new Error('Not a room ID')
      } else if (document.providerId === openers.activeProviderId) {
        const location = storageLocationOf(document)
        const metadata = await openers.storageMetadata(document.documentId, location)
        // A design deleted from storage must not come back from a cached local copy.
        if (metadata === null) {
          allOpened = false
          continue
        }
        await openers.openStorageDocument(
          metadata
            ? { ...metadata, id: document.documentId, metadataAuthoritative: true }
            : { id: document.documentId, name: document.name, updatedAt: '' },
          location
        )
      } else {
        allOpened = false
        continue
      }
      openedTabs.set(index, openers.activeTabId())
    } catch (error) {
      console.warn('[Startup] Could not reopen a design', error)
      allOpened = false
    }
  }
  const activeTab = openedTabs.get(session.active)
  if (activeTab) openers.focus(activeTab)
  return allOpened && openedTabs.size > 0
}
