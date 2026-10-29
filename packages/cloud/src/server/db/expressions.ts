import { sql, type Expression } from 'kysely'

export const CURRENT_TIMESTAMP = sql<Date>`current_timestamp`
export const EMPTY_JSON_OBJECT = sql`'{}'::jsonb`

const CHECK_VALUE_PATTERN = /^[a-z][a-z0-9-]*$/

export function checkColumnIn(column: string, values: readonly string[]): Expression<boolean> {
  if (values.length === 0 || values.some((value) => !CHECK_VALUE_PATTERN.test(value))) {
    throw new Error('Check constraint values must be non-empty lowercase identifiers')
  }
  return sql<boolean>`${sql.ref(column)} in (${sql.join(values.map((value) => sql.lit(value)))})`
}
