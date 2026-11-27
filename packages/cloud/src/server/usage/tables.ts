import type { Generated } from 'kysely'

/** Saves per UTC day, and the accounts active on each, counted as they happen; see migration 023. */
export interface UsageTables {
  dailyRevisionCount: { day: string; count: Generated<number> }
  dailyActiveAccount: { day: string; userId: string }
}
