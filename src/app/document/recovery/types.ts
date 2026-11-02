export interface RecoverySnapshotMeta {
  id: string
  /** The app session that wrote the copy; a copy no running session holds is left to recover. */
  sessionId: string
  documentName: string
  updatedAt: string
  byteLength: number
  formatVersion: 1
}

export interface RecoverySnapshot extends RecoverySnapshotMeta {
  figBytes: Uint8Array
}

export interface RecoverySnapshotInput {
  id: string
  sessionId: string
  documentName: string
  figBytes: Uint8Array
  /** The PNG its Home card shows; a write without one leaves the copy without a cover. */
  cover?: Uint8Array | null
}

export interface RecoveryStore {
  list(): Promise<RecoverySnapshotMeta[]>
  read(id: string): Promise<RecoverySnapshot | null>
  /** The cover stored with the copy, or null when it has none or is gone. */
  readCover(id: string): Promise<Uint8Array | null>
  write(input: RecoverySnapshotInput): Promise<RecoverySnapshotMeta>
  remove(id: string): Promise<void>
  /** Hands a stored copy to `sessionId` without touching its bytes; nothing when it is gone. */
  claim(id: string, sessionId: string): Promise<void>
  clear(): Promise<void>
}
