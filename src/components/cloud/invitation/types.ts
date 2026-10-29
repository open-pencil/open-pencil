/** What an invitation link can lead to once the editor has asked the server about it. */
export type CloudInvitationState =
  | 'loading'
  | 'ready'
  | 'accepting'
  | 'sign-in'
  | 'wrong-account'
  | 'unavailable'

/** What the invitation opens: one document, or a whole workspace. */
export type CloudInvitationSummary = (
  | { kind: 'document'; documentName: string; permission: 'edit' | 'view' }
  | { kind: 'workspace'; workspaceName: string; role: 'admin' | 'editor' | 'viewer' }
) & {
  inviterName: string
  /** How long until it expires, already worded, such as `6 days`. */
  expiresIn: string
  /** The invited address with most of it hidden, such as `g•••@studio.example`. */
  recipientHint: string
  host: string
  /** A self-hosted server this editor has never connected to. */
  unknownServer?: boolean
}
