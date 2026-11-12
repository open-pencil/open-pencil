import { getRecoveryStore, type RecoverySnapshotMeta } from '@/app/document/recovery'
import { recoverySessionId } from '@/app/document/recovery/session'
import { figFile, readFigForTab } from '@/app/tabs/open/fig'
import {
  failPreparation,
  releaseOpeningTab,
  reusableTabStore,
  showImportedGraph
} from '@/app/tabs/open/show'

export async function listRecoverySnapshots(): Promise<RecoverySnapshotMeta[]> {
  return getRecoveryStore().list()
}

export async function discardRecoverySnapshot(id: string): Promise<void> {
  await getRecoveryStore().remove(id)
}

/**
 * Opens a recovery copy in a tab, which takes it over: it becomes that tab's recovery copy, and
 * this window's, so no other window offers it while it is open here.
 */
export async function restoreRecoverySnapshot(id: string): Promise<void> {
  const snapshot = await getRecoveryStore().read(id)
  if (!snapshot) throw new Error('Recovery snapshot is no longer available')

  const opening = reusableTabStore()
  const { store } = opening
  const load = store.preparationController.begin({
    kind: 'recovery-restore',
    subject: snapshot.documentName
  })
  let succeeded = false
  try {
    load.update({ phase: 'reading', detail: snapshot.documentName })
    const file = figFile(new Uint8Array(snapshot.figBytes), snapshot.documentName)
    load.update({ phase: 'decoding', detail: snapshot.documentName })
    const imported = await readFigForTab(file, load.signal)

    await showImportedGraph(
      store,
      imported,
      async () => {
        store.state.documentName = snapshot.documentName
        await store.adoptRecoverySnapshot(id)
        // The copy is this window's now, so no other window lists it while it is open here.
        await getRecoveryStore().claim(id, recoverySessionId)
      },
      load
    )
    succeeded = true
  } catch (error) {
    failPreparation(load, 'decode-failed', error)
    await releaseOpeningTab(opening, { keepRecovery: true })
    throw error
  } finally {
    if (succeeded) load.complete()
  }
}
