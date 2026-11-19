import { DAY_MS } from '@open-pencil/std/timing'

/** How many random bytes an invitation link's secret has. */
export const INVITATION_SECRET_BYTES = 24
/** How long an invitation link works, for a document or a workspace alike. */
export const INVITATION_LIFETIME_MS = 7 * DAY_MS
