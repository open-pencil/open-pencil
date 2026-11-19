import { SECOND_MS } from '@open-pencil/std/timing'

/**
 * How long each layer of a tool call waits. Each caller waits a little longer than what it calls,
 * so the innermost timeout answers first and the error says which layer gave up.
 */

/** How long the MCP server waits for an app to connect before a call that needs one fails. */
export const APP_WAIT_DEADLINE_MS = 10 * SECOND_MS
/** How long the app may take to answer one call it runs, such as a render or an export. */
export const APP_RPC_DEADLINE_MS = 20 * SECOND_MS
/** How long the server may take to answer a call over HTTP: waiting for the app, then its answer. */
export const SERVER_RPC_DEADLINE_MS = APP_WAIT_DEADLINE_MS + APP_RPC_DEADLINE_MS
/** How long a client of the server, such as the stdio bridge or the CLI, waits for a call in all. */
export const CLIENT_RPC_DEADLINE_MS = SERVER_RPC_DEADLINE_MS + 5 * SECOND_MS
