import * as v from 'valibot'

export const enrollmentStatusSchema = v.picklist(['pending', 'approved', 'rejected', 'revoked'])
export const enrollmentReviewSchema = v.object({
  note: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(1000)))
})
export const userRoleMutationSchema = v.object({
  userId: v.pipe(v.string(), v.trim(), v.minLength(1)),
  enabled: v.boolean()
})

export const userMutationSchema = v.object({
  userId: v.pipe(v.string(), v.trim(), v.minLength(1)),
  reason: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500)))
})

export type EnrollmentReview = v.InferOutput<typeof enrollmentReviewSchema>

export const parseEnrollmentReview = (input: unknown) => v.parse(enrollmentReviewSchema, input)
export const parseUserMutation = (input: unknown) => v.parse(userMutationSchema, input)
export const parseUserRoleMutation = (input: unknown) => v.parse(userRoleMutationSchema, input)
