import * as v from 'valibot'

import { toolNumber } from '#core/tools/schema'

export const analysisLimitInputSchema = v.optional(
  toolNumber(v.pipe(v.number(), v.description('Maximum results to return (default: 30)'))),
  30
)
