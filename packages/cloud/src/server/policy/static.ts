import * as v from 'valibot'

import { CLOUD_FEATURE_KEYS } from './keys'

const positiveInteger = v.pipe(v.number(), v.integer(), v.minValue(1))

export const staticEntitlementsSchema = v.object({
  documents: v.optional(
    v.object({
      maximumFileBytes: v.optional(positiveInteger),
      revisionHistory: v.optional(v.boolean())
    }),
    {}
  ),
  storage: v.optional(v.object({ maximumBytes: v.optional(positiveInteger) }), {}),
  sharing: v.optional(
    v.object({
      capabilityLinks: v.optional(v.boolean()),
      anonymousView: v.optional(v.boolean()),
      anonymousEdit: v.optional(v.boolean()),
      guestPresence: v.optional(v.boolean())
    }),
    {}
  ),
  collaboration: v.optional(
    v.object({
      enabled: v.optional(v.boolean()),
      maximumParticipants: v.optional(positiveInteger)
    }),
    {}
  )
})

export type StaticEntitlements = v.InferOutput<typeof staticEntitlementsSchema>

export const staticEntitlementsTOMLSchema = v.object({
  documents: v.optional(
    v.object({
      maximum_file_bytes: v.optional(positiveInteger),
      revision_history: v.optional(v.boolean())
    })
  ),
  storage: v.optional(v.object({ maximum_bytes: v.optional(positiveInteger) })),
  sharing: v.optional(
    v.object({
      capability_links: v.optional(v.boolean()),
      anonymous_view: v.optional(v.boolean()),
      anonymous_edit: v.optional(v.boolean()),
      guest_presence: v.optional(v.boolean())
    })
  ),
  collaboration: v.optional(
    v.object({
      enabled: v.optional(v.boolean()),
      maximum_participants: v.optional(positiveInteger)
    })
  )
})

export function parseStaticEntitlementsTOML(input: unknown): StaticEntitlements {
  const value = v.parse(staticEntitlementsTOMLSchema, input)
  return v.parse(staticEntitlementsSchema, {
    documents: {
      maximumFileBytes: value.documents?.maximum_file_bytes,
      revisionHistory: value.documents?.revision_history
    },
    storage: { maximumBytes: value.storage?.maximum_bytes },
    sharing: {
      capabilityLinks: value.sharing?.capability_links,
      anonymousView: value.sharing?.anonymous_view,
      anonymousEdit: value.sharing?.anonymous_edit,
      guestPresence: value.sharing?.guest_presence
    },
    collaboration: {
      enabled: value.collaboration?.enabled,
      maximumParticipants: value.collaboration?.maximum_participants
    }
  })
}

export function staticEntitlementValues(input: unknown): Record<string, boolean | number> {
  const entitlements = v.parse(staticEntitlementsSchema, input)
  const values: Record<string, boolean | number | undefined> = {
    [CLOUD_FEATURE_KEYS.maximumFileBytes]: entitlements.documents.maximumFileBytes,
    [CLOUD_FEATURE_KEYS.revisionHistory]: entitlements.documents.revisionHistory,
    [CLOUD_FEATURE_KEYS.maximumStorageBytes]: entitlements.storage.maximumBytes,
    [CLOUD_FEATURE_KEYS.capabilityLinks]: entitlements.sharing.capabilityLinks,
    [CLOUD_FEATURE_KEYS.anonymousView]: entitlements.sharing.anonymousView,
    [CLOUD_FEATURE_KEYS.anonymousEdit]: entitlements.sharing.anonymousEdit,
    [CLOUD_FEATURE_KEYS.guestPresence]: entitlements.sharing.guestPresence,
    [CLOUD_FEATURE_KEYS.collaboration]: entitlements.collaboration.enabled,
    [CLOUD_FEATURE_KEYS.maximumParticipants]: entitlements.collaboration.maximumParticipants
  }
  return Object.fromEntries(
    Object.entries(values).filter(
      (entry): entry is [string, boolean | number] => entry[1] !== undefined
    )
  )
}
