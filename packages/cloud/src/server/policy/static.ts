import { pickBy } from 'es-toolkit/object'
import { isNotNil } from 'es-toolkit/predicate'
import * as v from 'valibot'

import { CLOUD_FEATURE_KEYS } from './keys'
import {
  staticEntitlementsSchema,
  staticEntitlementsTOMLSchema,
  type StaticEntitlements
} from './schema'

/** Entitlements as a writer sends them, with any group left out. */
export type StaticEntitlementsInput = v.InferInput<typeof staticEntitlementsSchema>

/** Entitlements as the deployment TOML spells them, renamed to their structured form. */
export function staticEntitlementsFromTOML(
  value: v.InferOutput<typeof staticEntitlementsTOMLSchema>
): StaticEntitlements {
  return v.parse(staticEntitlementsSchema, {
    documents: {
      maximumFileBytes: value.documents?.maximum_file_bytes,
      revisionHistory: value.documents?.revision_history
    },
    storage: { maximumBytes: value.storage?.maximum_bytes },
    sharing: {
      links: value.sharing?.links,
      guestView: value.sharing?.guest_view,
      guestEdit: value.sharing?.guest_edit,
      guestPresence: value.sharing?.guest_presence
    },
    collaboration: {
      enabled: value.collaboration?.enabled,
      maximumParticipants: value.collaboration?.maximum_participants
    },
    ai: {
      enabled: value.ai?.enabled,
      monthlyCreditAllowance: value.ai?.monthly_credit_allowance
    }
  })
}

export function parseStaticEntitlementsTOML(input: unknown): StaticEntitlements {
  return staticEntitlementsFromTOML(v.parse(staticEntitlementsTOMLSchema, input))
}

export function staticEntitlementValues(input: unknown): Record<string, boolean | number> {
  const entitlements = v.parse(staticEntitlementsSchema, input)
  const values: Record<string, boolean | number | undefined> = {
    [CLOUD_FEATURE_KEYS.maximumFileBytes]: entitlements.documents.maximumFileBytes,
    [CLOUD_FEATURE_KEYS.revisionHistory]: entitlements.documents.revisionHistory,
    [CLOUD_FEATURE_KEYS.maximumStorageBytes]: entitlements.storage.maximumBytes,
    [CLOUD_FEATURE_KEYS.links]: entitlements.sharing.links,
    [CLOUD_FEATURE_KEYS.guestView]: entitlements.sharing.guestView,
    [CLOUD_FEATURE_KEYS.guestEdit]: entitlements.sharing.guestEdit,
    [CLOUD_FEATURE_KEYS.guestPresence]: entitlements.sharing.guestPresence,
    [CLOUD_FEATURE_KEYS.collaboration]: entitlements.collaboration.enabled,
    [CLOUD_FEATURE_KEYS.maximumParticipants]: entitlements.collaboration.maximumParticipants,
    [CLOUD_FEATURE_KEYS.cloudAI]: entitlements.ai.enabled,
    [CLOUD_FEATURE_KEYS.monthlyCreditAllowance]: entitlements.ai.monthlyCreditAllowance
  }
  return pickBy(values, isNotNil) as Record<string, boolean | number>
}
