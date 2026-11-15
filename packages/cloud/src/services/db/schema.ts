import type { TimestampColumn } from '#cloud/server/db/tables'
import type { Insertable, Selectable } from 'kysely'

export interface ServicesUsageTable {
  id: string
  workspaceId: string
  /** The account whose credits the request spent; null on rows from before accounts did. */
  accountId: string | null
  userId: string
  modelId: string
  inputTokens: number
  outputTokens: number
  credits: number
  createdAt: TimestampColumn
}

export interface ServicesDatabase {
  servicesUsage: ServicesUsageTable
}

export type ServicesUsage = Selectable<ServicesUsageTable>
export type NewServicesUsage = Insertable<ServicesUsageTable>
