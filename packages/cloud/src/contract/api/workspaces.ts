import { oc } from '@orpc/contract'
import * as v from 'valibot'

import { cloudIdentitySchema } from '../account'
import { billingTokenSchema } from '../billing'
import { accountEntitlementsResponseSchema, workspaceEntitlementsSchema } from '../entitlements'
import { createServicesTokenSchema, servicesTokenSchema } from '../services'
import {
  createdWorkspaceInvitationSchema,
  createWorkspaceInvitationSchema,
  createWorkspaceSchema,
  updateWorkspaceMemberSchema,
  updateWorkspaceSchema,
  workspaceListSchema,
  workspaceMembersSchema,
  workspaceSummarySchema
} from '../workspaces'
import { WORKSPACE_ERRORS } from './errors'
import {
  workspaceInvitationParamsSchema,
  workspaceMemberParamsSchema,
  workspaceParamsSchema
} from './params'
import { at } from './route'

const route = oc.errors(WORKSPACE_ERRORS)
const workspaceResultSchema = v.object({ workspace: workspaceSummarySchema })

/** Workspaces, their members and invitations, and what their plans give them. */
export const workspacesContract = {
  list: route.meta(at('GET', '/workspaces')).output(workspaceListSchema),
  create: route
    .meta(at('POST', '/workspaces', { successStatus: 201 }))
    .input(v.object({ body: createWorkspaceSchema }))
    .output(workspaceResultSchema),
  get: route
    .meta(at('GET', '/workspaces/{workspaceId}'))
    .input(v.object({ params: workspaceParamsSchema }))
    .output(workspaceResultSchema),
  rename: route
    .meta(at('PATCH', '/workspaces/{workspaceId}'))
    .input(v.object({ params: workspaceParamsSchema, body: updateWorkspaceSchema }))
    .output(workspaceResultSchema),
  remove: route
    .meta(at('DELETE', '/workspaces/{workspaceId}', { successStatus: 204 }))
    .input(v.object({ params: workspaceParamsSchema })),
  members: route
    .meta(at('GET', '/workspaces/{workspaceId}/members'))
    .input(v.object({ params: workspaceParamsSchema }))
    .output(workspaceMembersSchema),
  invite: route
    .meta(at('POST', '/workspaces/{workspaceId}/invitations', { successStatus: 201 }))
    .input(v.object({ params: workspaceParamsSchema, body: createWorkspaceInvitationSchema }))
    .output(createdWorkspaceInvitationSchema),
  resendInvitation: route
    .meta(at('POST', '/workspaces/{workspaceId}/invitations/{invitationId}/resend'))
    .input(v.object({ params: workspaceInvitationParamsSchema }))
    .output(createdWorkspaceInvitationSchema),
  revokeInvitation: route
    .meta(
      at('DELETE', '/workspaces/{workspaceId}/invitations/{invitationId}', { successStatus: 204 })
    )
    .input(v.object({ params: workspaceInvitationParamsSchema })),
  updateMember: route
    .meta(at('PATCH', '/workspaces/{workspaceId}/members/{userId}', { successStatus: 204 }))
    .input(v.object({ params: workspaceMemberParamsSchema, body: updateWorkspaceMemberSchema })),
  removeMember: route
    .meta(at('DELETE', '/workspaces/{workspaceId}/members/{userId}', { successStatus: 204 }))
    .input(v.object({ params: workspaceMemberParamsSchema })),
  entitlements: route
    .meta(at('GET', '/workspaces/{workspaceId}/entitlements'))
    .input(v.object({ params: workspaceParamsSchema }))
    .output(v.object({ entitlements: workspaceEntitlementsSchema }))
}

/**
 * Who is signed in, what their plan gives them, and the short-lived tokens that let the
 * deployment's services and billing act for them.
 */
export const sessionContract = {
  session: route.meta(at('GET', '/session')).output(v.object({ user: cloudIdentitySchema })),
  accountEntitlements: route
    .meta(at('GET', '/account/entitlements'))
    .output(accountEntitlementsResponseSchema),
  servicesToken: route
    .meta(at('POST', '/services/token'))
    .input(v.object({ body: createServicesTokenSchema }))
    .output(servicesTokenSchema),
  billingToken: route.meta(at('POST', '/billing/token')).output(billingTokenSchema)
}
