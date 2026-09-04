import * as v from 'valibot'

import { cloudIdentitySchema } from '../account'

const timestampSchema = v.pipe(v.string(), v.isoTimestamp())
const nullableTimestampSchema = v.nullable(timestampSchema)

export const adminErrorCodeSchema = v.picklist([
  'bad_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'rate_limited',
  'invalid_enrollment_transition',
  'last_admin_required',
  'self_admin_action_forbidden',
  'email_regeneration_unavailable',
  'mfa_required'
])

export const adminErrorResponseSchema = v.object({
  error: v.object({ code: adminErrorCodeSchema })
})

export const enrollmentStatusSchema = v.picklist(['pending', 'approved', 'rejected', 'revoked'])
export const enrollmentSchema = v.object({
  id: v.string(),
  email: v.pipe(v.string(), v.email()),
  name: v.nullable(v.string()),
  reason: v.nullable(v.string()),
  status: enrollmentStatusSchema,
  requestedAt: timestampSchema,
  reviewedAt: nullableTimestampSchema,
  reviewedBy: v.nullable(v.string()),
  reviewNote: v.nullable(v.string()),
  approvedUserId: v.nullable(v.string()),
  requestRevision: v.pipe(v.number(), v.integer(), v.minValue(1))
})

export const enrollmentsResponseSchema = v.object({ enrollments: v.array(enrollmentSchema) })
export const enrollmentReviewResponseSchema = v.object({ enrollment: enrollmentSchema })

export const cloudAdminSessionResponseSchema = v.object({ user: cloudIdentitySchema })

export const cloudAdminUserSchema = v.object({
  id: v.string(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  role: v.optional(v.string()),
  banned: v.nullable(v.boolean()),
  banReason: v.optional(v.nullable(v.string())),
  createdAt: timestampSchema
})
export const cloudAdminUsersResponseSchema = v.object({
  users: v.array(cloudAdminUserSchema),
  total: v.pipe(v.number(), v.integer(), v.minValue(0))
})

export const adminMutationResponseSchema = v.object({ ok: v.literal(true) })

export const transactionalEmailAdminSchema = v.object({
  id: v.string(),
  kind: v.string(),
  recipientEmailNormalized: v.pipe(v.string(), v.email()),
  status: v.string(),
  attemptCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  nextAttemptAt: timestampSchema,
  transport: v.nullable(v.string()),
  transportMessageId: v.nullable(v.string()),
  lastErrorCode: v.nullable(v.string()),
  createdAt: timestampSchema,
  acceptedAt: nullableTimestampSchema,
  regeneratable: v.boolean()
})
export const adminEmailResponseSchema = v.object({
  messages: v.array(transactionalEmailAdminSchema)
})

export const adminAuditEventSchema = v.object({
  id: v.string(),
  actorUserId: v.string(),
  action: v.string(),
  subjectType: v.string(),
  subjectId: v.string(),
  metadata: v.unknown(),
  createdAt: timestampSchema
})
export const adminAuditResponseSchema = v.object({ events: v.array(adminAuditEventSchema) })

export const adminOperationsResponseSchema = v.object({
  deployment: v.picklist(['official', 'self-hosted']),
  enrollmentMode: v.picklist(['open', 'approval', 'closed']),
  emailTransport: v.picklist(['none', 'smtp', 'cloudflare']),
  pendingEnrollment: v.pipe(v.number(), v.integer(), v.minValue(0)),
  pendingEmail: v.pipe(v.number(), v.integer(), v.minValue(0)),
  failedEmail: v.pipe(v.number(), v.integer(), v.minValue(0))
})

export type AdminErrorCode = v.InferOutput<typeof adminErrorCodeSchema>
export type Enrollment = v.InferOutput<typeof enrollmentSchema>
export type CloudAdminSessionResponse = v.InferOutput<typeof cloudAdminSessionResponseSchema>
export type CloudAdminUser = v.InferOutput<typeof cloudAdminUserSchema>
export type TransactionalEmailAdmin = v.InferOutput<typeof transactionalEmailAdminSchema>
export type AdminAuditEvent = v.InferOutput<typeof adminAuditEventSchema>
export type AdminOperations = v.InferOutput<typeof adminOperationsResponseSchema>
