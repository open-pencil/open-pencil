import { staticEntitlementsSchema } from '#cloud/server/policy/schema'
import * as v from 'valibot'

export const setWorkspaceEntitlementsSchema = v.object({
  values: staticEntitlementsSchema,
  /** Who decided these values, such as `billing`; stored as the row's source. */
  source: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(64)),
  /** Increases with every decision the writer makes, such as a billing event's timestamp. */
  externalVersion: v.pipe(v.number(), v.safeInteger(), v.minValue(0))
})
