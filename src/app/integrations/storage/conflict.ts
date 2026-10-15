/**
 * The remote moved since the base the local edits started from: another device wrote, and
 * writing now would silently overwrite that work. Thrown by the versioned commit's head check
 * (detection) and by a conditional head update that lost a race (prevention).
 */
export class StorageConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageConflictError'
  }
}
