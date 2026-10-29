export class InvitationDeliveryError extends Error {
  override readonly name = 'InvitationDeliveryError'
}

export class DocumentShareInvalidError extends Error {
  override readonly name = 'DocumentShareInvalidError'
}

/** A valid link this server opens only for people signed in to it. */
export class DocumentShareSignInRequiredError extends Error {
  override readonly name = 'DocumentShareSignInRequiredError'
}
