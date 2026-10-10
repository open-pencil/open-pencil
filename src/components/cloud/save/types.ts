/** A workspace a document can be saved to, on the server it belongs to. */
export type CloudSaveDestination = {
  serverId: string
  host: string
  workspaces: { id: string; name: string; role: 'viewer' | 'editor' | 'admin' }[]
}

export type CloudSaveState =
  | { kind: 'ready' }
  | { kind: 'saving'; sentBytes: number; totalBytes: number }
  | { kind: 'error'; reason: 'too-large'; limitBytes: number }
  | { kind: 'error'; reason: 'quota' | 'offline' | 'unavailable' }
