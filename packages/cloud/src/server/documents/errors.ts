/** The document does not exist, or the person may not know it does. */
export class DocumentNotFoundError extends Error {
  override readonly name = 'DocumentNotFoundError'
}
/** The person may see the document but not do this to it. */
export class DocumentForbiddenError extends Error {
  override readonly name = 'DocumentForbiddenError'
}
/** A save named a base revision the document has moved on from. */
export class DocumentConflictError extends Error {
  override readonly name = 'DocumentConflictError'
}
/** An upload is not the file it declared, or no longer one that can land. */
export class UploadInvalidError extends Error {
  override readonly name = 'UploadInvalidError'
}
/**
 * Destroying a document deleted forever with no grace failed. The failure, its cause, was
 * reported where cleanup reports; the document is out of Trash, and cleanup tries again.
 */
export class DocumentPurgeFailedError extends Error {
  override readonly name = 'DocumentPurgeFailedError'
}
