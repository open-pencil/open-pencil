import * as v from 'valibot'

export const cloudAccountStateSchema = v.picklist(['active', 'pending', 'rejected', 'revoked'])
export const cloudIdentitySchema = v.object({
  userId: v.string(),
  email: v.pipe(v.string(), v.email()),
  name: v.string(),
  deploymentRole: v.optional(v.picklist(['user', 'admin']))
})

export const cloudAccountStatusResponseSchema = v.object({
  user: cloudIdentitySchema,
  state: cloudAccountStateSchema
})

export type CloudAccountState = v.InferOutput<typeof cloudAccountStateSchema>
export type CloudAccountStatus = v.InferOutput<typeof cloudAccountStatusResponseSchema>
