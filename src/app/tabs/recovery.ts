import { shallowReadonly, shallowRef } from 'vue'

import type { RecoverySnapshotMeta } from '@/app/document/recovery'
import { recoveryEnabled } from '@/app/document/recovery/preferences'
import {
  forgetCrashedSessions,
  recoverySessionStates,
  type RecoverySessionStates
} from '@/app/document/recovery/session'
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

/** The copies Home lists, as of the last `refreshRecoverableSnapshots`. */
export const recoverable = shallowReadonly(listed)

/**
 * Lists the copies left to recover. `reportCrash` reports the crashed sessions found, so later
 * lists mark their copies as kept ones and the next start does not ask about them again.
 */
export async function refreshRecoverableSnapshots({
  reportCrash = false
}: { reportCrash?: boolean } = {}): Promise<readonly RecoverableSnapshot[]> {
  if (!recoveryEnabled.value) {
    listed.value = []
    return listed.value
  }
  const [snapshots, sessions] = await Promise.all([
    listRecoverySnapshots(),
    recoverySessionStates()
  ])
  const found = recoverableSnapshots(snapshots, sessions, openRecoveryIds())
  if (reportCrash) forgetCrashedSessions(sessions.crashed)
  listed.value = found
  return found
}

function drop(id: string): void {
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
