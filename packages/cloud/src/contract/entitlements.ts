import * as v from 'valibot'

export const workspaceEntitlementsSchema = v.object({
  features: v.object({
    links: v.boolean(),
    guestView: v.boolean(),
    guestEdit: v.boolean(),
    guestPresence: v.boolean(),
    collaboration: v.boolean(),
    revisionHistory: v.boolean(),
    // Optional so editors keep reading servers released before services.
    cloudServices: v.optional(v.boolean(), false)
  }),
  limits: v.object({
    maximumFileBytes: v.pipe(v.number(), v.integer(), v.minValue(1)),
    maximumStorageBytes: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
    maximumParticipants: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1))),
    monthlyCreditAllowance: v.optional(
      v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
      null
    )
  }),
  usage: v.object({
    committedStorageBytes: v.pipe(v.number(), v.integer(), v.minValue(0)),
    reservedStorageBytes: v.pipe(v.number(), v.integer(), v.minValue(0))
  })
})
export type WorkspaceEntitlements = v.InferOutput<typeof workspaceEntitlementsSchema>

/**
 * An account's own plan and the storage its workspaces hold together. A workspace reports the
 * same for its owner, so the two read alike.
 */
export const accountEntitlementsSchema = workspaceEntitlementsSchema
export type AccountEntitlements = WorkspaceEntitlements
export const accountEntitlementsResponseSchema = v.object({
  entitlements: accountEntitlementsSchema
})

/** A plan's values as a deployment or a billing service sets them; anything left out is the default. */
const planPositiveIntegerSchema = v.pipe(v.number(), v.integer(), v.minValue(1))
const planNonNegativeIntegerSchema = v.pipe(v.number(), v.integer(), v.minValue(0))

export const staticEntitlementsSchema = v.object({
  documents: v.optional(
    v.object({
      maximumFileBytes: v.optional(planPositiveIntegerSchema),
      revisionHistory: v.optional(v.boolean())
    }),
    {}
  ),
  storage: v.optional(v.object({ maximumBytes: v.optional(planPositiveIntegerSchema) }), {}),
  sharing: v.optional(
    v.object({
      links: v.optional(v.boolean()),
      guestView: v.optional(v.boolean()),
      guestEdit: v.optional(v.boolean()),
      guestPresence: v.optional(v.boolean())
    }),
    {}
  ),
  collaboration: v.optional(
    v.object({
      enabled: v.optional(v.boolean()),
      maximumParticipants: v.optional(planPositiveIntegerSchema)
    }),
    {}
  ),
  services: v.optional(
    v.object({
      enabled: v.optional(v.boolean()),
      monthlyCreditAllowance: v.optional(planNonNegativeIntegerSchema)
    }),
    {}
  )
})
export type StaticEntitlements = v.InferOutput<typeof staticEntitlementsSchema>
