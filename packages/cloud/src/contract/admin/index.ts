import { zipObject } from 'es-toolkit'
import * as v from 'valibot'

import {
  cloudIdentitySchema,
  cloudAccountSessionSchema,
  cloudPersonSchema,
  cloudSignInSchema
} from '../account'
import { documentReportReasonSchema } from '../reports'
import { workspaceRoleSchema } from '../workspaces'

const timestampSchema = v.pipe(v.string(), v.isoTimestamp())
const nullableTimestampSchema = v.nullable(timestampSchema)
const countSchema = v.pipe(v.number(), v.integer(), v.minValue(0))

/**
 * What every admin list answers besides its rows: how many rows match the search and filter
 * across every page, and how many match the search under each filter.
 */
function listTotals<const Filter extends string>(filters: readonly Filter[]) {
  return {
    total: countSchema,
    counts: v.object(
      zipObject(
        filters,
        filters.map(() => countSchema)
      )
    )
  }
}

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
  'mfa_required',
  'document_not_restorable',
  'workspace_gone'
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
  /** The reviewer's name, in lists, while the server still knows them. */
  reviewerName: v.optional(v.nullable(v.string())),
  reviewNote: v.nullable(v.string()),
  approvedUserId: v.nullable(v.string()),
  requestRevision: v.pipe(v.number(), v.integer(), v.minValue(1))
})

export const enrollmentsResponseSchema = v.object({
  enrollments: v.array(enrollmentSchema),
  ...listTotals(enrollmentStatusSchema.options)
})
export const enrollmentReviewResponseSchema = v.object({ enrollment: enrollmentSchema })

export const cloudAdminSessionResponseSchema = v.object({ user: cloudIdentitySchema })

export const cloudAdminUserSchema = v.object({
  ...cloudPersonSchema.entries,
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
  ...listTotals(cloudAdminUserFilterSchema.options)
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
/** Which messages a list of email shows, by how their delivery went. */
export const cloudAdminEmailFilterSchema = v.picklist(['all', 'sent', 'waiting', 'failed'])
export const adminEmailResponseSchema = v.object({
  messages: v.array(transactionalEmailAdminSchema),
  ...listTotals(cloudAdminEmailFilterSchema.options)
})

/** Who or what an event names; `name` is null once the server no longer knows it. */
const auditPartySchema = v.object({ id: v.string(), name: v.nullable(v.string()) })

export const adminAuditEventSchema = v.object({
  id: v.string(),
  actor: auditPartySchema,
  action: v.string(),
  /** What the event is about: an account, an access request, an email, or a document. */
  subject: v.object({ ...auditPartySchema.entries, type: v.string() }),
  metadata: v.unknown(),
  createdAt: timestampSchema
})
/** Which events a list of activity shows, by what they are about. */
export const cloudAdminAuditFilterSchema = v.picklist([
  'all',
  'accounts',
  'requests',
  'email',
  'documents'
])
export const adminAuditResponseSchema = v.object({
  events: v.array(adminAuditEventSchema),
  ...listTotals(cloudAdminAuditFilterSchema.options)
})

/** A document as the console shows it: where it lives, who made it, and whether it is taken down. */
export const cloudAdminDocumentSchema = v.object({
  id: v.string(),
  name: v.string(),
  workspace: v.object({ id: v.string(), name: v.string() }),
  /** Who made it, while the server knows them. */
  owner: v.nullable(v.object({ id: v.string(), name: v.string(), email: v.string() })),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  disabledAt: nullableTimestampSchema,
  disabledReason: v.nullable(v.string()),
  /** Reports about it still waiting for a decision. */
  openReports: countSchema,
  /**
   * When someone deleted it forever, and when cleanup destroys it; until then an administrator
   * can still restore it. Servers from before Trash send neither.
   */
  purgedAt: v.optional(nullableTimestampSchema, null),
  destroyedAt: v.optional(nullableTimestampSchema, null)
})
/** Which documents a list shows: live ones, or those deleted forever an administrator can restore. */
export const cloudAdminDocumentFilterSchema = v.picklist(['all', 'reported', 'disabled', 'purged'])
export const cloudAdminDocumentsResponseSchema = v.object({
  documents: v.array(cloudAdminDocumentSchema),
  ...listTotals(cloudAdminDocumentFilterSchema.options)
})

export const cloudAdminReportStatusSchema = v.picklist(['open', 'dismissed', 'actioned'])
export const cloudAdminReportSchema = v.object({
  id: v.string(),
  reason: documentReportReasonSchema,
  description: v.string(),
  status: cloudAdminReportStatusSchema,
  /** The account that filed it, or null for a guest. */
  reporter: v.nullable(v.object({ id: v.string(), name: v.nullable(v.string()) })),
  replyEmail: v.nullable(v.string()),
  createdAt: timestampSchema,
  resolvedAt: nullableTimestampSchema,
  document: cloudAdminDocumentSchema,
  /** The link it was opened from, and whether that link still works. */
  share: v.nullable(v.object({ id: v.string(), revoked: v.boolean() }))
})
/** Which reports a list shows, by where they stand. */
export const cloudAdminReportFilterSchema = v.picklist(['open', 'actioned', 'dismissed', 'all'])
export const cloudAdminReportsResponseSchema = v.object({
  reports: v.array(cloudAdminReportSchema),
  ...listTotals(cloudAdminReportFilterSchema.options)
})

export const adminOperationsResponseSchema = v.object({
  deployment: v.picklist(['official', 'self-hosted']),
  enrollmentMode: v.picklist(['open', 'approval', 'closed']),
  emailTransport: v.picklist(['none', 'smtp', 'cloudflare']),
  pendingEnrollment: v.pipe(v.number(), v.integer(), v.minValue(0)),
  openReports: countSchema,
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
export type CloudAdminEmailFilter = v.InferOutput<typeof cloudAdminEmailFilterSchema>
export type CloudAdminAuditFilter = v.InferOutput<typeof cloudAdminAuditFilterSchema>
export type EnrollmentStatus = v.InferOutput<typeof enrollmentStatusSchema>
export type CloudAdminUsers = v.InferOutput<typeof cloudAdminUsersResponseSchema>
export type CloudAdminUserDetail = v.InferOutput<typeof cloudAdminUserDetailSchema>
export type TransactionalEmailAdmin = v.InferOutput<typeof transactionalEmailAdminSchema>
export type AdminAuditEvent = v.InferOutput<typeof adminAuditEventSchema>
export type AdminOperations = v.InferOutput<typeof adminOperationsResponseSchema>
export type CloudAdminDocument = v.InferOutput<typeof cloudAdminDocumentSchema>
export type CloudAdminDocumentFilter = v.InferOutput<typeof cloudAdminDocumentFilterSchema>
export type CloudAdminReport = v.InferOutput<typeof cloudAdminReportSchema>
export type CloudAdminReportFilter = v.InferOutput<typeof cloudAdminReportFilterSchema>
export type CloudAdminReportStatus = v.InferOutput<typeof cloudAdminReportStatusSchema>
