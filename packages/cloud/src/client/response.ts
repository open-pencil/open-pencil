export class CloudAPIError extends Error {
  override readonly name = 'CloudAPIError'

  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    /** Whether the refusal came without a JSON body, as from a proxy in front of the server. */
    readonly unreadable = false
  ) {
    super(message)
  }
}
