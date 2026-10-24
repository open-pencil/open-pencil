import * as v from 'valibot'

import { cloudIdentitySchema, cloudAccountSessionSchema, cloudSignInSchema } from '../account'
import { workspaceRoleSchema } from '../workspaces'

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

const countSchema = v.pipe(v.number(), v.integer(), v.minValue(0))

export const cloudAdminUserSchema = v.object({
  id: v.string(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  image: v.nullable(v.string()),
  role: v.optional(v.string()),
  banned: v.nullable(v.boolean()),
  banReason: v.optional(v.nullable(v.string())),
  createdAt: timestampSchema,
  /** An authenticator app or a passkey confirms this account's sign-ins. */
  twoStep: v.boolean(),
  /** When one of the account's sessions was last used, or null when none is left. */
  lastActiveAt: nullableTimestampSchema,
  workspaceCount: countSchema
})

/** Which accounts a list of people shows. */
export const cloudAdminUserFilterSchema = v.picklist([
  'all',
  'administrators',
  'suspended',
  'without-two-step'
])
export const cloudAdminUsersResponseSchema = v.object({
  users: v.array(cloudAdminUserSchema),
  /** How many accounts match the search and filter, across every page. */
  total: countSchema,
  /** How many accounts match the search under each filter. */
  counts: v.object({
    all: countSchema,
    administrators: countSchema,
    suspended: countSchema,
    'without-two-step': countSchema
  })
})

export const cloudAdminUserDetailSchema = v.object({
  user: v.object({
    ...cloudAdminUserSchema.entries,
    emailVerified: v.boolean()
  }),
  methods: v.array(v.object({ provider: v.string(), createdAt: timestampSchema })),
  authenticator: v.boolean(),
  passkeyCount: countSchema,
  sessions: v.array(cloudAccountSessionSchema),
  signIns: v.array(cloudSignInSchema),
  workspaces: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      role: workspaceRoleSchema,
      memberCount: countSchema,
      joinedAt: timestampSchema
    })
  )
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

/** Who or what an event names; `name` is null once the server no longer knows it. */
const auditPartySchema = v.object({ id: v.string(), name: v.nullable(v.string()) })

export const adminAuditEventSchema = v.object({
  id: v.string(),
  actor: auditPartySchema,
  action: v.string(),
  /** What the event is about: an account, an access request, or an email. */
  subject: v.object({ ...auditPartySchema.entries, type: v.string() }),
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
  failedEmail: v.pipe(v.number(), v.integer(), v.minValue(0)),
  accounts: countSchema,
  workspaces: countSchema,
  documents: countSchema,
  storedBytes: countSchema
})

export type AdminErrorCode = v.InferOutput<typeof adminErrorCodeSchema>
export type Enrollment = v.InferOutput<typeof enrollmentSchema>
export type CloudAdminSessionResponse = v.InferOutput<typeof cloudAdminSessionResponseSchema>
export type CloudAdminUser = v.InferOutput<typeof cloudAdminUserSchema>
export type CloudAdminUserFilter = v.InferOutput<typeof cloudAdminUserFilterSchema>
export type CloudAdminUsers = v.InferOutput<typeof cloudAdminUsersResponseSchema>
export type CloudAdminUserDetail = v.InferOutput<typeof cloudAdminUserDetailSchema>
export type TransactionalEmailAdmin = v.InferOutput<typeof transactionalEmailAdminSchema>
export type AdminAuditEvent = v.InferOutput<typeof adminAuditEventSchema>
export type AdminOperations = v.InferOutput<typeof adminOperationsResponseSchema>
