/**
 * How long a query serving a request may run before PostgreSQL cancels it. Rate limits and
 * sessions live in PostgreSQL, so one stuck query would otherwise hold its connection, and every
 * request waiting for one, indefinitely.
 */
export const POSTGRES_STATEMENT_TIMEOUT_MS = 30_000

/**
 * How long opening a connection may take before it fails. Without it `pg` waits forever, so a
 * database the network silently drops packets to stalls startup with nothing logged.
 */
export const POSTGRES_CONNECTION_TIMEOUT_MS = 10_000
