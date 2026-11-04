/** A write based on a revision the provider has since replaced, as when someone else saved. */
export class StorageRevisionConflictError extends Error {
  override readonly name = 'StorageRevisionConflictError'

  constructor(
    /** The provider's current revision, when it reports one. */
    readonly currentRevision: string | null
  ) {
    super('The stored document changed since this copy was opened')
  }
}

/**
 * The provider cannot be reached with what this device has now, such as a signed-out Cloud
 * account. Work waits until the person fixes it rather than counting as failed attempts.
 */
export class StorageUnavailableError extends Error {
  override readonly name = 'StorageUnavailableError'
}
