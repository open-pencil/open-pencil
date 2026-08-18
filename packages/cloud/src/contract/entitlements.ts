import * as v from 'valibot'

export const workspaceEntitlementsSchema = v.object({
  features: v.object({
    capabilityLinks: v.boolean(),
    anonymousView: v.boolean(),
    anonymousEdit: v.boolean(),
    guestPresence: v.boolean(),
    collaboration: v.boolean(),
    revisionHistory: v.boolean()
  }),
  limits: v.object({
    maximumFileBytes: v.pipe(v.number(), v.integer(), v.minValue(1)),
    maximumStorageBytes: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1)))
  }),
  usage: v.object({
    committedStorageBytes: v.pipe(v.number(), v.integer(), v.minValue(0)),
    reservedStorageBytes: v.pipe(v.number(), v.integer(), v.minValue(0))
  })
})
export type WorkspaceEntitlements = v.InferOutput<typeof workspaceEntitlementsSchema>
