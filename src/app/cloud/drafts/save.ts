import { useLocalStorage } from '@vueuse/core'
import * as v from 'valibot'
import { markRaw, ref, shallowRef, type Raw } from 'vue'

import { cloudMessages } from '@open-pencil/vue/i18n'

import { recoverySessionId } from '@/app/document/recovery/session'
import { getRecoveryStore } from '@/app/document/recovery/store'
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

/** Tabs whose person chose this computer, so Save goes on there without asking again. */
const savedOnDevice = new WeakSet<EditorStore>()

/** How long a draft waits for its person to finish signing up, as a link from email may. */
const PENDING_DRAFT_MS = 24 * 60 * 60 * 1000

const pendingDraftSchema = v.object({
  serverId: v.string(),
  recoveryId: v.string(),
  leftAt: v.number()
})
export type PendingDraft = v.InferOutput<typeof pendingDraftSchema>

/**
 * What an app starting up does with a draft that left to sign up or sign in: `wait` while its
 * person may still be confirming their address in another tab, `open` the file in a tab that came
 * back without signing in, `save` it once signed in, or `drop` one that waited too long.
 */
export function pendingDraftAction(
  draft: PendingDraft,
  context: { now: number; signedIn: boolean; returnedFrom: string | null }
): 'wait' | 'open' | 'save' | 'drop' {
  if (context.now - draft.leftAt > PENDING_DRAFT_MS) return 'drop'
  if (context.signedIn) return 'save'
  return context.returnedFrom === draft.serverId ? 'open' : 'wait'
}

/**
 * A draft that left for the server's sign-up or sign-in pages, kept as a recovery copy. Kept for
 * the browser rather than the tab, since confirming an email address opens a tab of its own.
 */
const pendingDraft = IS_BROWSER
  ? useLocalStorage<string | null>('open-pencil:cloud-draft-save', null)
  : ref<string | null>(null)

/** The draft waiting for its person; a malformed one is dropped. */
function readPendingDraft(): PendingDraft | null {
  const parsed = v.safeParse(
    v.pipe(v.string(), v.parseJson(), pendingDraftSchema),
    pendingDraft.value ?? ''
  )
  if (parsed.success) return parsed.output
  pendingDraft.value = null
  return null
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
    savedOnDevice.has(store)
  ) {
    return store.saveFigFile()
  }
  cloudDraftSave.value = { store: markRaw(store), serverId }
  return Promise.resolve()
}

/** Saves the file to this computer, as Save does without Cloud, and stops asking for its tab. */
export function saveDraftOnDevice(): Promise<unknown> {
  const draft = cloudDraftSave.value
  cloudDraftSave.value = null
  if (!draft) return Promise.resolve()
  savedOnDevice.add(draft.store)
  return draft.store.saveFigFileAs()
}

/**
 * Keeps the file as a recovery copy and leaves for the server's sign-up or sign-in page; back
 * signed in, `resumeCloudDraftSave` opens the copy and saves it to Cloud. The copy is written
 * whether or not recovery is on, since the page is about to leave.
 */
export async function keepDraftInCloud(page: 'sign-up' | 'sign-in'): Promise<void> {
  const draft = cloudDraftSave.value
  if (!draft) return
  const server = cloudServers.value.find((candidate) => candidate.id === draft.serverId)
  const discovery = server ? await discoverCloudServer(server.url).catch(() => null) : null
  if (!discovery) {
    toast.error(cloudMessages.get().draftKeepFailed)
    return
  }
  cloudDraftSave.value = null
  if (cloudSignInRoute(discovery) !== 'redirect') {
    openCloudConnect({ serverId: draft.serverId })
    return
  }
  const recoveryId = createCanvasId()
  const { store } = draft
  try {
    await store.saveFigFileCopy(async (figBytes) => {
      await getRecoveryStore().write({
        id: recoveryId,
        sessionId: recoverySessionId,
        documentName: store.state.documentName,
        figBytes
      })
    })
  } catch {
    toast.error(cloudMessages.get().draftKeepFailed)
    return
  }
  pendingDraft.value = JSON.stringify({
    serverId: draft.serverId,
    recoveryId,
    leftAt: Date.now()
  } satisfies PendingDraft)
  redirectToCloudSignIn(draft.serverId, discovery, { page })
}

/**
 * Opens the draft a sign-up or sign-in left with, once the app is back. Signed in to its server,
 * the draft goes there through `saveTo`; a tab that came back without signing in still gets its
 * file. A tab that never left waits, since the person may still be confirming their address in
 * another tab.
 */
export async function resumeCloudDraftSave(options: {
  /** The server this tab left to sign in to, if it did. */
  returnedFrom: string | null
  saveTo: (store: EditorStore) => Promise<void>
}): Promise<void> {
  const draft = readPendingDraft()
  if (!draft) return
  const action = pendingDraftAction(draft, {
    now: Date.now(),
    signedIn: cloudConnection(draft.serverId).state === 'signed-in',
    returnedFrom: options.returnedFrom
  })
  if (action === 'wait') return
  pendingDraft.value = null
  if (action === 'drop') return
  try {
    await restoreRecoverySnapshot(draft.recoveryId)
  } catch {
    // The copy is gone, as when another tab opened it first.
    return
  }
  if (action === 'save') await options.saveTo(getActiveStore())
}
