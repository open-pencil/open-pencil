import * as v from 'valibot'

import { collaborationPrincipalSchema } from './collaboration'
import { documentPermissionSchema } from './documents'

export const documentShareSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  documentId: v.pipe(v.string(), v.uuid()),
  permission: documentPermissionSchema,
  roomEpoch: v.pipe(v.number(), v.integer(), v.minValue(0)),
  createdBy: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
  expiresAt: v.nullable(v.string()),
  revokedAt: v.nullable(v.string()),
  lastUsedAt: v.nullable(v.string())
})
export type DocumentShare = v.InferOutput<typeof documentShareSchema>

export const createDocumentShareSchema = v.object({
  permission: documentPermissionSchema,
  expiresAt: v.optional(v.nullable(v.string()))
})
export type CreateDocumentShareInput = v.InferOutput<typeof createDocumentShareSchema>

export const updateDocumentShareSchema = v.object({
  permission: v.optional(documentPermissionSchema),
  expiresAt: v.optional(v.nullable(v.string()))
})
export type UpdateDocumentShareInput = v.InferOutput<typeof updateDocumentShareSchema>

export const resolveDocumentShareSchema = v.object({
  secret: v.pipe(v.string(), v.minLength(32), v.maxLength(128)),
  guestName: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80))),
  guestId: v.optional(v.pipe(v.string(), v.minLength(16), v.maxLength(128)))
})
export type ResolveDocumentShareInput = v.InferOutput<typeof resolveDocumentShareSchema>

export const resolvedDocumentShareSchema = v.object({
  documentId: v.pipe(v.string(), v.uuid()),
  permission: documentPermissionSchema,
  principal: collaborationPrincipalSchema,
  roomEpoch: v.pipe(v.number(), v.integer(), v.minValue(0))
})
export type ResolvedDocumentShare = v.InferOutput<typeof resolvedDocumentShareSchema>

export const cloudUserProfileSchema = v.object({
  id: v.string(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  image: v.nullable(v.pipe(v.string(), v.url()))
})
export type CloudUserProfile = v.InferOutput<typeof cloudUserProfileSchema>

export const documentGrantSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  documentId: v.pipe(v.string(), v.uuid()),
  userId: v.string(),
  permission: documentPermissionSchema,
  createdBy: v.string(),
  createdAt: v.string(),
  updatedAt: v.string()
})
export type DocumentGrant = v.InferOutput<typeof documentGrantSchema>

export const lookupCloudUserSchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email())
})
export type LookupCloudUserInput = v.InferOutput<typeof lookupCloudUserSchema>

export const putDocumentGrantSchema = v.object({ permission: documentPermissionSchema })
export type PutDocumentGrantInput = v.InferOutput<typeof putDocumentGrantSchema>

export const createDocumentInvitationSchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email()),
  permission: documentPermissionSchema
})
export type CreateDocumentInvitationInput = v.InferOutput<typeof createDocumentInvitationSchema>

export const acceptDocumentInvitationSchema = v.object({
  token: v.pipe(v.string(), v.minLength(32), v.maxLength(128))
})
export type AcceptDocumentInvitationInput = v.InferOutput<typeof acceptDocumentInvitationSchema>

export const documentInvitationSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  documentId: v.pipe(v.string(), v.uuid()),
  email: v.pipe(v.string(), v.email()),
  permission: documentPermissionSchema,
  invitedBy: v.string(),
  invitedAt: v.string(),
  expiresAt: v.string(),
  acceptedAt: v.nullable(v.string())
})
export type DocumentInvitation = v.InferOutput<typeof documentInvitationSchema>

export function parseLookupCloudUser(input: unknown): LookupCloudUserInput {
  return v.parse(lookupCloudUserSchema, input)
}

export function parseCreateDocumentShare(input: unknown): CreateDocumentShareInput {
  return v.parse(createDocumentShareSchema, input)
}

export function parseUpdateDocumentShare(input: unknown): UpdateDocumentShareInput {
  return v.parse(updateDocumentShareSchema, input)
}

export function parseResolveDocumentShare(input: unknown): ResolveDocumentShareInput {
  return v.parse(resolveDocumentShareSchema, input)
}

export function parsePutDocumentGrant(input: unknown): PutDocumentGrantInput {
  return v.parse(putDocumentGrantSchema, input)
}

export function parseCreateDocumentInvitation(input: unknown): CreateDocumentInvitationInput {
  return v.parse(createDocumentInvitationSchema, input)
}

export function parseAcceptDocumentInvitation(input: unknown): AcceptDocumentInvitationInput {
  return v.parse(acceptDocumentInvitationSchema, input)
}
