/** Typed errors of the library domain: callers turn them into syncing/failed states, not message matches. */

abstract class LibraryRevisionError extends Error {
  readonly libraryId: string
  /** The revision asked for, or `undefined` when the request named the library's latest. */
  readonly revisionId: string | undefined

  constructor(what: string, libraryId: string, revisionId?: string) {
    super(`${what}: ${libraryId}/${revisionId ?? 'latest'}`)
    this.name = 'LibraryRevisionError'
    this.libraryId = libraryId
    this.revisionId = revisionId
  }
}

/** The revision is not in the local mirror yet; a background pull is in flight. */
export class LibraryContentSyncingError extends LibraryRevisionError {
  constructor(libraryId: string, revisionId?: string) {
    super('Library revision is still syncing', libraryId, revisionId)
    this.name = 'LibraryContentSyncingError'
  }
}

/** The revision failed to sync: parked, retries exhausted, or an integrity failure. */
export class LibraryContentFailedError extends LibraryRevisionError {
  constructor(libraryId: string, revisionId?: string) {
    super('Library revision failed to sync', libraryId, revisionId)
    this.name = 'LibraryContentFailedError'
  }
}

/** A catalog's revision row is absent; the mirror turns this into a syncing signal. */
export class LibraryRevisionMissingError extends LibraryRevisionError {
  constructor(libraryId: string, revisionId?: string) {
    super('Library revision not found', libraryId, revisionId)
    this.name = 'LibraryRevisionMissingError'
  }
}

/** Stored library content that cannot be read: malformed, oversize, or naming another identity. */
export class LibraryContentInvalidError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LibraryContentInvalidError'
  }
}
