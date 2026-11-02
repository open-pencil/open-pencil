import type { AIUsagePage, AIWallet } from '#cloud/contract'
import { fromDate, startOfMonth, toCalendarDate } from '@internationalized/date'
import type { Kysely } from 'kysely'
import * as v from 'valibot'

import type { AIRelayDatabase, NewAIRelayUsage } from './db'

const USAGE_PAGE_SIZE = 50

/** The UTC calendar month a moment falls in, as its first instant and the next month's. */
export function usagePeriod(now: Date): { start: Date; end: Date } {
  const month = startOfMonth(toCalendarDate(fromDate(now, 'UTC')))
  return { start: month.toDate('UTC'), end: month.add({ months: 1 }).toDate('UTC') }
}

/** A page boundary: the last entry's creation time in milliseconds and its ID. */
const cursorSchema = v.pipe(
  v.string(),
  v.regex(/^\d+\.[0-9a-f-]{36}$/),
  v.transform((value) => {
    const [milliseconds = '', id = ''] = value.split('.')
    return { createdAt: new Date(Number(milliseconds)), id }
  }),
  v.check(
    ({ createdAt, id }) =>
      !Number.isNaN(createdAt.getTime()) && v.is(v.pipe(v.string(), v.uuid()), id)
  )
)

function encodeCursor(createdAt: Date, id: string): string {
  return `${createdAt.getTime()}.${id}`
}

export class AIUsageCursorError extends Error {
  constructor() {
    super('Invalid usage cursor')
    this.name = 'AIUsageCursorError'
  }
}

export function createAIUsageStore(database: Kysely<AIRelayDatabase>) {
  async function spent(workspaceId: string, now: Date): Promise<number> {
    const { start, end } = usagePeriod(now)
    const row = await database
      .selectFrom('aiRelayUsage')
      .select((query) => query.fn.sum<string | number | null>('credits').as('credits'))
      .where('workspaceId', '=', workspaceId)
      .where('createdAt', '>=', start)
      .where('createdAt', '<', end)
      .executeTakeFirst()
    return Number(row?.credits ?? 0)
  }

  return {
    async record(usage: NewAIRelayUsage): Promise<void> {
      await database.insertInto('aiRelayUsage').values(usage).execute()
    },

    /**
     * The workspace's single allowance bucket for the current month. A `null` allowance means
     * Cloud set none, and the relay does not limit spend.
     */
    async wallet(workspaceId: string, allowance: number | null, now: Date): Promise<AIWallet> {
      if (allowance === null) return { balance: null, buckets: [] }
      const remaining = Math.max(0, allowance - (await spent(workspaceId, now)))
      return {
        balance: remaining,
        buckets: [{ kind: 'allowance', remaining, expiresAt: usagePeriod(now).end.toISOString() }]
      }
    },

    /** Newest first, across every member of the workspace. */
    async page(workspaceId: string, cursor: string | undefined): Promise<AIUsagePage> {
      let after: { createdAt: Date; id: string } | undefined
      if (cursor !== undefined) {
        const parsed = v.safeParse(cursorSchema, cursor)
        if (!parsed.success) throw new AIUsageCursorError()
        after = parsed.output
      }
      let query = database
        .selectFrom('aiRelayUsage')
        .select(['id', 'createdAt', 'modelId', 'userId', 'credits'])
        .where('workspaceId', '=', workspaceId)
      if (after) {
        const { createdAt, id } = after
        query = query.where((row) =>
          row.or([
            row('createdAt', '<', createdAt),
            row.and([row('createdAt', '=', createdAt), row('id', '<', id)])
          ])
        )
      }
      const rows = await query
        .orderBy('createdAt', 'desc')
        .orderBy('id', 'desc')
        .limit(USAGE_PAGE_SIZE + 1)
        .execute()
      const entries = rows.slice(0, USAGE_PAGE_SIZE)
      const last = entries.at(-1)
      return {
        entries: entries.map((row) => ({
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          kind: 'model',
          modelID: row.modelId,
          userId: row.userId,
          credits: row.credits
        })),
        next: rows.length > USAGE_PAGE_SIZE && last ? encodeCursor(last.createdAt, last.id) : null
      }
    }
  }
}

export type AIUsageStore = ReturnType<typeof createAIUsageStore>
