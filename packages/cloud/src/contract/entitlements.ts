import * as v from 'valibot'

export const workspaceEntitlementsSchema = v.object({
  features: v.object({
    links: v.boolean(),
    guestView: v.boolean(),
    guestEdit: v.boolean(),
    guestPresence: v.boolean(),
    collaboration: v.boolean(),
    revisionHistory: v.boolean(),
    // Optional so editors keep reading servers released before the AI service.
    cloudAI: v.optional(v.boolean(), false)
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
