import { writeJSONLine } from '#cloud/server/logging'
import type { BetterAuthOptions } from 'better-auth'

/** What the API-key plugin logs, as an error, for a token that is wrong, expired, or revoked. */
const REFUSED_TOKEN = 'Failed to validate API key'

/**
 * Better Auth's log lines as Cloud's JSON lines. A refused personal access token is the caller's
 * mistake, which the request answers with 401, so it is not logged as the server's error; nor is
 * anything a log line's arguments carry beyond an error's name and message.
 */
export const betterAuthLogger: NonNullable<BetterAuthOptions['logger']> = {
  log(level, message, ...args) {
    if (level === 'debug' || message.startsWith(REFUSED_TOKEN)) return
    const error = args.find((arg): arg is Error => arg instanceof Error)
    writeJSONLine({
      level,
      message,
      source: 'better-auth',
      ...(error && { error: { name: error.name, message: error.message } })
    })
  }
}
