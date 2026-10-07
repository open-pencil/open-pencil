export interface RecoverySnapshotMeta {
  id: string
  documentName: string
  updatedAt: string
  /** The content revision the snapshot was taken at, within its session. */
  version: number
  byteLength: number
  formatVersion: 1
}

export interface RecoverySnapshot extends RecoverySnapshotMeta {
  figBytes: Uint8Array
}

export interface RecoverySnapshotInput {
  id: string
  documentName: string
  version: number
  figBytes: Uint8Array
}

export interface RecoveryStore {
  list(): Promise<RecoverySnapshotMeta[]>
  read(id: string): Promise<RecoverySnapshot | null>
  write(input: RecoverySnapshotInput): Promise<RecoverySnapshotMeta>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}
