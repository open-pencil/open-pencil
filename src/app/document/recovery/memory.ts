import type {
  RecoverySnapshot,
  RecoverySnapshotInput,
  RecoverySnapshotMeta,
  RecoveryStore
} from '@/app/document/recovery/types'

export function createMemoryRecoveryStore(): RecoveryStore {
  const snapshots = new Map<string, RecoverySnapshot>()
  const covers = new Map<string, Uint8Array>()

  return {
    async list() {
      return [...snapshots.values()]
        .map(({ figBytes: _figBytes, ...metadata }) => structuredClone(metadata))
        .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    },
    async read(id: string) {
      const snapshot = snapshots.get(id)
      return snapshot ? structuredClone(snapshot) : null
    },
    async readCover(id: string) {
      const cover = covers.get(id)
      return cover ? new Uint8Array(cover) : null
    },
    async write(input: RecoverySnapshotInput) {
      const metadata: RecoverySnapshotMeta = {
        id: input.id,
        sessionId: input.sessionId,
        documentName: input.documentName || 'Untitled',
        updatedAt: new Date().toISOString(),
        byteLength: input.figBytes.byteLength,
        formatVersion: 1
      }
      snapshots.set(input.id, {
        ...metadata,
        figBytes: new Uint8Array(input.figBytes)
      })
      if (input.cover) covers.set(input.id, new Uint8Array(input.cover))
      else covers.delete(input.id)
      return structuredClone(metadata)
    },
    async remove(id: string) {
      snapshots.delete(id)
      covers.delete(id)
    },
    async claim(id: string, sessionId: string) {
      const snapshot = snapshots.get(id)
      if (snapshot) snapshots.set(id, { ...snapshot, sessionId })
    },
    async clear() {
      snapshots.clear()
      covers.clear()
    }
  }
}
