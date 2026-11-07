import { useLocalStorage } from '@vueuse/core'
import * as v from 'valibot'
import { markRaw, ref, shallowRef, watch, type Raw } from 'vue'

import { cloudMessages } from '@open-pencil/vue/i18n'

import { recoverySessionId } from '@/app/document/recovery/session'
import { getRecoveryStore, isRecoveryStoreMemoryFallback } from '@/app/document/recovery/store'
import type { EditorStore } from '@/app/editor/session'
import { toast } from '@/app/shell/ui'
import { createCanvasId } from '@/app/storage/id'
import { getActiveStore, restoreRecoverySnapshot } from '@/app/tabs'
import { IS_BROWSER, IS_CLOUD_SITE } from '@/constants'

import { openCloudConnect } from '../connect/flow'
import { cloudServers, isCloudSiteServer } from '../servers/store'
import { cloudConnection, discoverCloudServer } from '../sessions/connection'
import { cloudSignInRoute, redirectToCloudSignIn } from '../sessions/sign-in'

/** A file someone without an account asked to save, while they choose where it goes. */
export type CloudDraftSave = { store: Raw<EditorStore>; serverId: string }

/** The Keep this file dialog's file, if it shows. */
export const cloudDraftSave = shallowRef<CloudDraftSave | null>(null)

/**
 * Documents whose person saved them to this computer, by recovery copy, so Save goes on there
 * without asking again. Save's entry points may hand over a store that follows the active tab, so
 * the store itself does not name the document.
 */
const savedOnDevice = new Set<string>()

/** Saves a document to a Cloud server; the app hands it in as Save to, kept to that server. */
export type SaveToCloud = (store: EditorStore, serverId: string) => Promise<void>
let saveToCloud: SaveToCloud | null = null

/** A draft whose person signs in through the connect dialog, without leaving the page. */
const connecting = shallowRef<{ store: Raw<EditorStore>; serverId: string } | null>(null)

/** How long a draft waits for its person to finish signing up, as a link from email may. */
const PENDING_DRAFT_MS = 24 * 60 * 60 * 1000

const pendingDraftSchema = v.object({
  serverId: v.string(),
  recoveryId: v.string(),
  leftAt: v.number()
})
export type PendingDraft = v.InferOutput<typeof pendingDraftSchema>

/**
 * What the app does with a draft that left to sign up or sign in: `save` it once signed in,
 * `open` it in the tab that came back without signing in, or once it has waited a day, and `wait`
 * meanwhile, since its person may still be confirming their address in another tab.
 */
export function pendingDraftAction(
  draft: PendingDraft,
  context: { now: number; signedIn: boolean; returnedFrom: string | null }
): 'wait' | 'open' | 'save' {
  if (context.signedIn) return 'save'
  if (context.returnedFrom === draft.serverId) return 'open'
  return context.now - draft.leftAt > PENDING_DRAFT_MS ? 'open' : 'wait'
}

/**
 * A draft that left for the server's sign-up or sign-in pages, kept as a recovery copy. Kept for
 * the browser rather than the tab, since confirming an email address opens a tab of its own.
 */
const pendingDraft = IS_BROWSER
  ? useLocalStorage<string | null>('open-pencil:cloud-draft-save', null)
  : ref<string | null>(null)

function parsePendingDraft(): PendingDraft | null {
  const parsed = v.safeParse(
    v.pipe(v.string(), v.parseJson(), pendingDraftSchema),
    pendingDraft.value ?? ''
  )
  return parsed.success ? parsed.output : null
}

/** The server that serves this editor, while it is signed out: where a visitor keeps their files. */
function signedOutSiteServer(): string | null {
  if (!IS_CLOUD_SITE) return null
  const server = cloudServers.value.find((candidate) => isCloudSiteServer(candidate.id))
  if (!server) return null
  const { state } = cloudConnection(server.id)
  return state === 'signed-out' || state === 'expired' ? server.id : null
}

/**
 * Save. A file with nowhere to go yet, on the server's own editor and signed out of it, asks
 * whether to keep it in Cloud by signing up or on this computer; everything else saves as it
 * would anywhere.
 */
export function saveDocument(store: EditorStore): Promise<unknown> {
  const serverId = signedOutSiteServer()
  if (
    !serverId ||
    store.hasWritableSource() ||
    store.getStorageBinding() ||
    savedOnDevice.has(store.getRecoveryId())
  ) {
    return store.saveFigFile()
  }
  cloudDraftSave.value = { store: markRaw(store), serverId }
  return Promise.resolve()
}

/** Saves the file to this computer, as Save does without Cloud, and stops asking once it did. */
export async function saveDraftOnDevice(): Promise<void> {
  const draft = cloudDraftSave.value
  cloudDraftSave.value = null
  if (!draft) return
  const id = draft.store.getRecoveryId()
  if (await draft.store.saveFigFileAs()) savedOnDevice.add(id)
}

/**
 * Keeps the file as a recovery copy and leaves for the server's sign-up or sign-in page; back
 * signed in, `startCloudDrafts` opens the copy and saves it to Cloud. The copy is written whether
 * or not recovery is on, and only to IndexedDB, since a copy in memory leaves with the page; when
 * it cannot be kept the dialog stays, so the file can still go to this computer. An editor that
 * signs in through the connect dialog stays on the page and saves the open file once connected.
 */
export async function keepDraftInCloud(page: 'sign-up' | 'sign-in'): Promise<void> {
  const draft = cloudDraftSave.value
  if (!draft) return
  const failed = () => {
    toast.error(cloudMessages.get().draftKeepFailed)
  }
  const server = cloudServers.value.find((candidate) => candidate.id === draft.serverId)
  const discovery = server ? await discoverCloudServer(server.url).catch(() => null) : null
  if (!discovery) return failed()
  if (cloudSignInRoute(discovery) !== 'redirect') {
    cloudDraftSave.value = null
    connecting.value = draft
    openCloudConnect({ serverId: draft.serverId })
    return
  }
  const recoveryId = createCanvasId()
  const { store } = draft
  try {
    await store.saveFigFileCopy(async (figBytes) => {
      if (isRecoveryStoreMemoryFallback()) throw new Error('Recovery copies are kept in memory')
      await getRecoveryStore().write({
        id: recoveryId,
        sessionId: recoverySessionId,
        documentName: store.state.documentName,
        figBytes
      })
      // The write itself may have found IndexedDB gone and kept the copy in memory.
      if (isRecoveryStoreMemoryFallback()) throw new Error('Recovery copies are kept in memory')
    })
  } catch {
    return failed()
  }
  cloudDraftSave.value = null
  pendingDraft.value = JSON.stringify({
    serverId: draft.serverId,
    recoveryId,
    leftAt: Date.now()
  } satisfies PendingDraft)
  redirectToCloudSignIn(draft.serverId, discovery, { page })
}

/**
 * Opens the draft a sign-up or sign-in left with and, signed in, saves it to its server. The
 * hand-off is dropped once the copy opens, or once the copy is gone, as when another tab opened it
 * first; a copy that failed to open is tried again on the next start.
 */
async function resumePendingDraft(returnedFrom: string | null): Promise<void> {
  const draft = parsePendingDraft()
  if (!draft) {
    pendingDraft.value = null
    return
  }
  const signedIn = cloudConnection(draft.serverId).state === 'signed-in'
  const action = pendingDraftAction(draft, { now: Date.now(), signedIn, returnedFrom })
  if (action === 'wait') return
  pendingDraft.value = null
  try {
    await restoreRecoverySnapshot(draft.recoveryId)
  } catch {
    const kept = await getRecoveryStore()
      .read(draft.recoveryId)
      .catch(() => null)
    if (kept) pendingDraft.value = JSON.stringify(draft)
    return
  }
  if (action === 'save') await saveToCloud?.(getActiveStore(), draft.serverId)
}

/**
 * Picks up drafts on their way to Cloud: one a sign-up or sign-in left with, now and once its
 * server is signed in later, as when the address is confirmed in another tab, and one whose
 * person signs in through the connect dialog.
 */
export async function startCloudDrafts(options: {
  /** The server this tab left to sign in to, if it did. */
  returnedFrom: string | null
  saveTo: SaveToCloud
}): Promise<void> {
  saveToCloud = options.saveTo
  watch(
    () => {
      const draft = parsePendingDraft()
      return draft !== null && cloudConnection(draft.serverId).state === 'signed-in'
    },
    (signedIn) => {
      if (signedIn) void resumePendingDraft(null)
    }
  )
  watch(
    () =>
      connecting.value !== null && cloudConnection(connecting.value.serverId).state === 'signed-in',
    (signedIn) => {
      if (!signedIn || !connecting.value) return
      const { store, serverId } = connecting.value
      connecting.value = null
      void saveToCloud?.(store, serverId)
    }
  )
  await resumePendingDraft(options.returnedFrom)
}
