import { ADMIN_LIST_MAXIMUM } from '#cloud/admin/schema'
import type { CloudDatabase } from '#cloud/server/db'
import { clamp, zipObject } from 'es-toolkit'
import type { Expression, ExpressionBuilder, SelectQueryBuilder, SqlBool } from 'kysely'

/** The rows an admin list returns when the request does not say. */
export const ADMIN_PAGE_SIZE = 50

/** What every admin list takes: words to search for, one of its filters, and a page. */
export type AdminListQuery<Filter extends string> = {
  search?: string
  filter?: Filter
  limit?: number
  offset?: number
}

/** A `like` pattern that finds `search` anywhere, matching `%`, `_`, and `\` literally. */
export function containsPattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
}

/** The search words, or undefined when there are none. */
export function listSearch(query: AdminListQuery<string>): string | undefined {
  return query.search?.trim() || undefined
}

/** The page a query asks for, kept within what one request may return. */
export function listWindow(query: AdminListQuery<string>) {
  return {
    limit: clamp(query.limit ?? ADMIN_PAGE_SIZE, 1, ADMIN_LIST_MAXIMUM),
    offset: Math.max(0, query.offset ?? 0)
  }
}

/** A list's filters, each the condition its rows meet; the same one counts them and pages them. */
export type ListFilters<Filter extends string, Table extends keyof CloudDatabase> = Record<
  Filter,
  (expression: ExpressionBuilder<CloudDatabase, Table>) => Expression<SqlBool>
>

/**
 * How many of `searched`'s rows meet each filter, in one query: each count is an aggregate with a
 * `filter (where …)` clause rather than a query of its own.
 */
export async function countEachFilter<Filter extends string, Table extends keyof CloudDatabase>(
  searched: SelectQueryBuilder<CloudDatabase, Table, object>,
  names: readonly Filter[],
  filters: ListFilters<Filter, Table>
): Promise<Record<Filter, number>> {
  // Kysely names each column after its filter but cannot type a generic name, so the row is read
  // as counts by name.
  const row: Record<string, unknown> = await searched
    .select((expression) =>
      names.map((name) => expression.fn.countAll<number>().filterWhere(filters[name]).as(name))
    )
    .executeTakeFirstOrThrow()
  return zipObject(
    names,
    names.map((name) => Number(row[name]))
  )
}
