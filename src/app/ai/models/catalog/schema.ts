import * as v from 'valibot'

import { REASONING_EFFORTS } from '@open-pencil/core/constants'
import type { ModelOption } from '@open-pencil/core/constants'

/** A model list as the app caches it after normalizing a provider's own catalog. */
export const modelOptionsSchema = v.array(
  v.object({
    id: v.string(),
    name: v.string(),
    tag: v.optional(v.string()),
    capabilities: v.optional(v.array(v.picklist(['tools', 'vision']))),
    recommendedMaxOutputTokens: v.optional(v.number()),
    releaseDate: v.optional(v.string()),
    status: v.optional(v.picklist(['active', 'beta', 'deprecated'])),
    minReasoningEffort: v.optional(v.picklist(REASONING_EFFORTS))
  })
) satisfies v.GenericSchema<unknown, ModelOption[]>
