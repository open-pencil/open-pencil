import { oc } from '@orpc/contract'
import * as v from 'valibot'

import {
  adminAuditResponseSchema,
  adminEmailResponseSchema,
  adminMutationResponseSchema,
  adminOperationsResponseSchema,
  cloudAdminAuditFilterSchema,
  cloudAdminDocumentFilterSchema,
  cloudAdminDocumentsResponseSchema,
  cloudAdminEmailFilterSchema,
  cloudAdminReportFilterSchema,
  cloudAdminReportsResponseSchema,
  cloudAdminUserDetailSchema,
  cloudAdminUserFilterSchema,
  cloudAdminUserMethodSchema,
  cloudAdminUsersResponseSchema,
  enrollmentReviewResponseSchema,
  enrollmentsResponseSchema,
  enrollmentStatusSchema
} from '../admin'
import { documentDownloadSchema } from '../documents'
import { ADMIN_ERRORS } from './errors'
import { uuidParamSchema } from './params'
import { at } from './route'

/**
 * A count from the query string; anything but digits, or a number too large to be exact, is a bad
 * request rather than a NaN or out-of-range query.
 */
const countSchema = v.optional(v.pipe(v.string(), v.digits(), v.toNumber(), v.safeInteger()))

/** What an admin list reads from its query string: a search, one of `filters`, and a page. */
function listQuery<const Filter extends string>(filters: v.PicklistSchema<Filter[], undefined>) {
  return v.object({
    search: v.optional(v.string()),
    filter: v.optional(filters),
    limit: countSchema,
    offset: countSchema
  })
}

export const enrollmentReviewSchema = v.object({
  note: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(1000)))
})
export type EnrollmentReview = v.InferOutput<typeof enrollmentReviewSchema>
const accountSchema = v.pipe(v.string(), v.trim(), v.minLength(1))
export const userMutationSchema = v.object({
  userId: accountSchema,
  reason: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500)))
})
export const userRoleMutationSchema = v.object({ userId: accountSchema, enabled: v.boolean() })
/** One of an account's sign-in methods, as the person's page lists them. */
export const signInMethodMutationSchema = v.object({
  userId: accountSchema,
  methodId: v.pipe(v.string(), v.trim(), v.minLength(1))
})
/** Why an administrator takes a document down, which the audit log keeps. */
export const documentTakedownSchema = v.object({
  reason: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500)))
})

const route = oc.errors(ADMIN_ERRORS)
const idInputSchema = v.object({ params: v.object({ id: uuidParamSchema }) })

/** An enrollment review, which records what the administrator decided and why. */
function review(action: 'approve' | 'reject' | 'revoke') {
  return route
    .meta(at('POST', `/enrollments/{id}/${action}`))
    .input(v.object({ params: v.object({ id: uuidParamSchema }), body: enrollmentReviewSchema }))
    .output(enrollmentReviewResponseSchema)
}

/** An action on another account, named in the body; one that is not an account is not found. */
function userAction(path: `/users/${string}`) {
  return route
    .meta(at('POST', path))
    .input(v.object({ body: userMutationSchema }))
    .output(adminMutationResponseSchema)
}

/** A change to a document or share by its ID. */
function documentAction(path: `/${string}/{id}/${string}`) {
  return route.meta(at('POST', path)).input(idInputSchema).output(adminMutationResponseSchema)
}

/**
 * The server's administration, under `/api/admin`, for its administrators: access requests,
 * people, email, the audit log, reports, documents, and the server's health.
 */
export const adminContract = {
  enrollments: route
    .meta(at('GET', '/enrollments'))
    .input(v.object({ query: listQuery(enrollmentStatusSchema) }))
    .output(enrollmentsResponseSchema),
  approveEnrollment: review('approve'),
  rejectEnrollment: review('reject'),
  revokeEnrollment: review('revoke'),
  users: route
    .meta(at('GET', '/users'))
    .input(
      v.object({
        query: v.object({
          ...listQuery(cloudAdminUserFilterSchema).entries,
          method: v.optional(cloudAdminUserMethodSchema)
        })
      })
    )
    .output(cloudAdminUsersResponseSchema),
  user: route
    .meta(at('GET', '/users/{id}'))
    .input(idInputSchema)
    .output(cloudAdminUserDetailSchema),
  resetTwoStep: userAction('/users/reset-two-step'),
  removeSignInMethod: route
    .meta(at('POST', '/users/remove-sign-in-method'))
    .input(v.object({ body: signInMethodMutationSchema }))
    .output(adminMutationResponseSchema),
  removePicture: userAction('/users/remove-picture'),
  deleteUser: userAction('/users/delete'),
  ban: userAction('/users/ban'),
  unban: userAction('/users/unban'),
  revokeSessions: userAction('/users/revoke-sessions'),
  setAdmin: route
    .meta(at('POST', '/users/set-admin'))
    .input(v.object({ body: userRoleMutationSchema }))
    .output(adminMutationResponseSchema),
  email: route
    .meta(at('GET', '/email'))
    .input(v.object({ query: listQuery(cloudAdminEmailFilterSchema) }))
    .output(adminEmailResponseSchema),
  regenerateEmail: documentAction('/email/{id}/regenerate'),
  audit: route
    .meta(at('GET', '/audit'))
    .input(v.object({ query: listQuery(cloudAdminAuditFilterSchema) }))
    .output(adminAuditResponseSchema),
  operations: route.meta(at('GET', '/operations')).output(adminOperationsResponseSchema),
  reports: route
    .meta(at('GET', '/reports'))
    .input(v.object({ query: listQuery(cloudAdminReportFilterSchema) }))
    .output(cloudAdminReportsResponseSchema),
  dismissReport: documentAction('/reports/{id}/dismiss'),
  actionReport: documentAction('/reports/{id}/action'),
  documents: route
    .meta(at('GET', '/documents'))
    .input(v.object({ query: listQuery(cloudAdminDocumentFilterSchema) }))
    .output(cloudAdminDocumentsResponseSchema),
  disableDocument: route
    .meta(at('POST', '/documents/{id}/disable'))
    .input(v.object({ params: v.object({ id: uuidParamSchema }), body: documentTakedownSchema }))
    .output(adminMutationResponseSchema),
  enableDocument: documentAction('/documents/{id}/enable'),
  undeleteDocument: documentAction('/documents/{id}/undelete'),
  downloadDocument: route
    .meta(at('POST', '/documents/{id}/download'))
    .input(idInputSchema)
    .output(documentDownloadSchema),
  revokeShare: documentAction('/shares/{id}/revoke')
}
