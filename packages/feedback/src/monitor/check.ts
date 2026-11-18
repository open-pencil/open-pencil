import type { Alert } from './telegram'

export type CheckStatus = 'ok' | 'warning' | 'critical'

/** What one run of a check saw. */
export interface Observation {
  /** Stable across runs: the state row it updates. */
  name: string
  status: CheckStatus
  /** Runs in a row that must see a new status before the channel hears of it. */
  confirmRuns: number
  /** The message for `warning` and `critical`; its tone comes from the status. */
  problem: Omit<Alert, 'tone'>
  /** The message once the check is back to `ok`. */
  recovered: Omit<Alert, 'tone'>
}
