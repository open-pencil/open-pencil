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
}

export interface RecoveryStore {
  list(): Promise<RecoverySnapshotMeta[]>
  read(id: string): Promise<RecoverySnapshot | null>
  write(input: RecoverySnapshotInput): Promise<RecoverySnapshotMeta>
  remove(id: string): Promise<void>
  /** Hands a stored copy to `sessionId` without touching its bytes; nothing when it is gone. */
  claim(id: string, sessionId: string): Promise<void>
  clear(): Promise<void>
}
