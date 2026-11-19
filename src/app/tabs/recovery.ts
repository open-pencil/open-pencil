import { shallowReadonly, shallowRef, watch } from 'vue'

import { useDocumentWorkspace } from '@open-pencil/vue/document/workspace'

import type { RecoverySnapshotMeta } from '@/app/document/recovery'
import { recoveryEnabled } from '@/app/document/recovery/preferences'
import {
  forgetCrashedSessions,
  recoverySessionStates,
  type RecoverySessionStates
} from '@/app/document/recovery/session'
import { getRecoveryStore } from '@/app/document/recovery/store'
import {
  discardRecoverySnapshot,
  listRecoverySnapshots,
  openRecoveryIds,
  restoreRecoverySnapshot
} from '@/app/tabs'

export interface RecoverableSnapshot extends RecoverySnapshotMeta {
  /** Its session crashed, rather than closing or reloading its window with the copy kept. */
  crashed: boolean
}

/**
 * The copies left to recover: none a running session writes or a tab has open. A copy written
 * before copies named their session belongs to none, so it is left to recover and not a crash.
 */
export function recoverableSnapshots(
  snapshots: readonly RecoverySnapshotMeta[],
  sessions: RecoverySessionStates,
  open: ReadonlySet<string>
): RecoverableSnapshot[] {
  return snapshots
    .filter((snapshot) => !sessions.live.has(snapshot.sessionId) && !open.has(snapshot.id))
    .map((snapshot) => ({ ...snapshot, crashed: sessions.crashed.has(snapshot.sessionId) }))
}

const listed = shallowRef<readonly RecoverableSnapshot[]>([])
/** Bumped by each refresh and each restore or discard, so an older refresh never lands last. */
let listGeneration = 0

/** The copies Home lists, as of the last `refreshRecoverableSnapshots`. */
export const recoverable = shallowReadonly(listed)

/** A crashed session is remembered while copies it wrote are left, so their cards keep saying so. */
export function crashedSessionsWithoutCopies(
  snapshots: readonly RecoverySnapshotMeta[],
  sessions: RecoverySessionStates
): Set<string> {
  const written = new Set(snapshots.map((snapshot) => snapshot.sessionId))
  return new Set([...sessions.crashed].filter((id) => !written.has(id)))
}

/** Lists the copies left to recover. */
export async function refreshRecoverableSnapshots(): Promise<readonly RecoverableSnapshot[]> {
  const generation = ++listGeneration
  if (!recoveryEnabled.value) {
    listed.value = []
    return listed.value
  }
  const [snapshots, sessions] = await Promise.all([
    listRecoverySnapshots(),
    recoverySessionStates()
  ])
  const found = recoverableSnapshots(snapshots, sessions, openRecoveryIds())
  forgetCrashedSessions(crashedSessionsWithoutCopies(snapshots, sessions))
  if (generation === listGeneration) listed.value = found
  return found
}

function drop(id: string): void {
  listGeneration++
  listed.value = listed.value.filter((snapshot) => snapshot.id !== id)
}

export async function restoreRecoverable(id: string): Promise<void> {
  await restoreRecoverySnapshot(id)
  drop(id)
}

export async function discardRecoverable(id: string): Promise<void> {
  await discardRecoverySnapshot(id)
  drop(id)
}

/** The listed copies with their covers, as Home's cards show them. */
export function useRecoverableWorkspace() {
  const workspace = useDocumentWorkspace({
    source: {
      async refresh() {
        return recoverable.value.map((snapshot) => ({ ...snapshot, name: snapshot.documentName }))
      },
      loadPreview: (id) => getRecoveryStore().readCover(id)
    },
    refreshOnFocus: false,
    refreshOnReconnect: false,
    previewConcurrency: 2,
    onPreviewError: (id, error) => console.warn(`[Recovery] No cover for ${id}:`, error)
  })
  watch(recoverable, () => void workspace.invalidate())
  return workspace
}
