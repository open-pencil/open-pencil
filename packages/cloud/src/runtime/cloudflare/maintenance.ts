/**
 * The Worker variable that takes a deployment off the air, as the Deploy Cloud workflow's
 * `maintenance` input sets it: every request answers 503 and scheduled cleanup does nothing, while
 * the deploy itself restarts the rooms' objects and closes their sockets. A database restore runs
 * under it (deploy/openpencil/README.md).
 */
export const MAINTENANCE_VARIABLE = 'OPENPENCIL_CLOUD_MAINTENANCE'

export function inMaintenance(env: Record<string, unknown>): boolean {
  return env[MAINTENANCE_VARIABLE] === 'on'
}

/** What every request gets meanwhile; clients retry, and nothing reaches the database. */
export function maintenanceResponse(): Response {
  return new Response('OpenPencil Cloud is down for maintenance.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '300' }
  })
}
