/**
 * The remote moved since the local edits' base — another device wrote, and
 * writing now would silently overwrite that work. Thrown by the engine's
 * preflight (detection) and by adapters whose conditional head update lost a
 * race (prevention); the engine maps both to the `conflict` status without
 * capability polling.
 */
export class StorageConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageConflictError'
  }
}
