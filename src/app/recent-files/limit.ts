import * as v from 'valibot'

import { recentFilesLimitSchema } from './schema'

export const DEFAULT_RECENT_FILES_LIMIT = 10

export function resolveRecentFilesLimit(value: unknown): number {
  const result = v.safeParse(recentFilesLimitSchema, value)
  return result.success ? result.output : DEFAULT_RECENT_FILES_LIMIT
}
