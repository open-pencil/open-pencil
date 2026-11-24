import { oc } from '@orpc/contract'
import * as v from 'valibot'

import { collaborationTicketSchema } from '../collaboration'
import { documentDownloadSchema, documentImageLinkSchema } from '../documents'
import { fileDocumentReportResponseSchema, fileDocumentReportSchema } from '../reports'
import {
  acceptDocumentInvitationSchema,
  acceptedInvitationSchema,
  cloudUserProfileSchema,
  createDocumentInvitationSchema,
  createDocumentShareSchema,
  createInvitationContinuationSchema,
  documentGrantSchema,
  documentInvitationSchema,
  documentShareSchema,
  invitationContinuationSchema,
  invitationPreviewSchema,
  putDocumentGrantSchema,
  requestSharedImageLinksSchema,
  resolveDocumentShareSchema,
  resolvedDocumentShareSchema,
  updateDocumentShareSchema
} from '../sharing'
import { SHARE_ERRORS } from './errors'
import {
  documentInvitationParamsSchema,
  documentParamsSchema,
  documentShareParamsSchema,
  documentUserParamsSchema,
  invitationContinuationParamsSchema,
  invitationParamsSchema,
  shareParamsSchema
} from './params'
import { at } from './route'

const route = oc.errors(SHARE_ERRORS)

/** A link, with the secret it carries and its path, which only its creator ever sees. */
const shareCapabilitySchema = v.object({
  share: documentShareSchema,
  secret: v.string(),
  path: v.string()
})
const ticketResultSchema = v.object({ ticket: collaborationTicketSchema })

/** Sharing a document: its links, grants, and invitations, and its live room's tickets. */
export const sharingContract = {
  userProfile: route
    .meta(at('GET', '/documents/{documentId}/users/{userId}'))
    .input(v.object({ params: documentUserParamsSchema }))
    .output(v.object({ user: v.nullable(cloudUserProfileSchema) })),
  listShares: route
    .meta(at('GET', '/documents/{documentId}/shares'))
    .input(v.object({ params: documentParamsSchema }))
    .output(v.object({ shares: v.array(documentShareSchema) })),
  createShare: route
    .meta(at('POST', '/documents/{documentId}/shares', { successStatus: 201 }))
    .input(v.object({ params: documentParamsSchema, body: createDocumentShareSchema }))
    .output(shareCapabilitySchema),
  updateShare: route
    .meta(at('PATCH', '/documents/{documentId}/shares/{shareId}'))
    .input(v.object({ params: documentShareParamsSchema, body: updateDocumentShareSchema }))
    .output(v.object({ share: documentShareSchema })),
  rotateShare: route
    .meta(at('POST', '/documents/{documentId}/shares/{shareId}/rotate'))
    .input(v.object({ params: documentShareParamsSchema }))
    .output(shareCapabilitySchema),
  revokeShare: route
    .meta(at('DELETE', '/documents/{documentId}/shares/{shareId}', { successStatus: 204 }))
    .input(v.object({ params: documentShareParamsSchema })),
  listGrants: route
    .meta(at('GET', '/documents/{documentId}/grants'))
    .input(v.object({ params: documentParamsSchema }))
    .output(v.object({ grants: v.array(documentGrantSchema) })),
  putGrant: route
    .meta(at('PUT', '/documents/{documentId}/grants/{userId}'))
    .input(v.object({ params: documentUserParamsSchema, body: putDocumentGrantSchema }))
    .output(v.object({ grant: documentGrantSchema })),
  revokeGrant: route
    .meta(at('DELETE', '/documents/{documentId}/grants/{userId}', { successStatus: 204 }))
    .input(v.object({ params: documentUserParamsSchema })),
  listInvitations: route
    .meta(at('GET', '/documents/{documentId}/invitations'))
    .input(v.object({ params: documentParamsSchema }))
    .output(v.object({ invitations: v.array(documentInvitationSchema) })),
  createInvitation: route
    .meta(at('POST', '/documents/{documentId}/invitations', { successStatus: 201 }))
    .input(v.object({ params: documentParamsSchema, body: createDocumentInvitationSchema }))
    .output(v.object({ invitation: documentInvitationSchema, token: v.string() })),
  revokeInvitation: route
    .meta(
      at('DELETE', '/documents/{documentId}/invitations/{invitationId}', { successStatus: 204 })
    )
    .input(v.object({ params: documentInvitationParamsSchema })),
  acceptInvitation: route
    .meta(at('POST', '/invitations/{invitationId}/accept'))
    .input(v.object({ params: invitationParamsSchema, body: acceptDocumentInvitationSchema }))
    .output(v.object({ accepted: acceptedInvitationSchema })),
  collaborationTicket: route
    .meta(at('POST', '/documents/{documentId}/collaboration-ticket'))
    .input(v.object({ params: documentParamsSchema }))
    .output(ticketResultSchema)
}

/**
 * What anyone may do with a link or an invitation: open what it shares, follow its live room,
 * report it, and carry an invitation through signing in.
 */
export const publicSharingContract = {
  createContinuation: route
    .meta(at('POST', '/invitations/continuations', { successStatus: 201 }))
    .input(v.object({ body: createInvitationContinuationSchema }))
    .output(invitationContinuationSchema),
  consumeContinuation: route
    .meta(at('POST', '/invitations/continuations/{continuationId}/consume'))
    .input(v.object({ params: invitationContinuationParamsSchema }))
    .output(createInvitationContinuationSchema),
  previewInvitation: route
    .meta(at('POST', '/invitations/{invitationId}/preview'))
    .input(v.object({ params: invitationParamsSchema, body: acceptDocumentInvitationSchema }))
    .output(v.object({ invitation: invitationPreviewSchema })),
  resolveShare: route
    .meta(at('POST', '/shares/{shareId}/resolve'))
    .input(v.object({ params: shareParamsSchema, body: resolveDocumentShareSchema }))
    .output(v.object({ resolution: resolvedDocumentShareSchema })),
  document: route
    .meta(at('POST', '/shares/{shareId}/document'))
    .input(v.object({ params: shareParamsSchema, body: resolveDocumentShareSchema }))
    .output(
      v.object({ resolution: resolvedDocumentShareSchema, document: documentDownloadSchema })
    ),
  imageLinks: route
    .meta(at('POST', '/shares/{shareId}/images'))
    .input(v.object({ params: shareParamsSchema, body: requestSharedImageLinksSchema }))
    .output(v.object({ images: v.array(documentImageLinkSchema) })),
  collaborationTicket: route
    .meta(at('POST', '/shares/{shareId}/collaboration-ticket'))
    .input(v.object({ params: shareParamsSchema, body: resolveDocumentShareSchema }))
    .output(ticketResultSchema),
  fileReport: route
    .meta(at('POST', '/shares/{shareId}/reports', { successStatus: 201 }))
    .input(v.object({ params: shareParamsSchema, body: fileDocumentReportSchema }))
    .output(fileDocumentReportResponseSchema)
}
