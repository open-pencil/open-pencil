import { createEnrollmentService, type EnrollmentService } from '#cloud/admin'
import type {
  CloudAuthAdapter,
  CloudIdentityResolver,
  CloudSessionResolver
} from '#cloud/server/auth'
import { createBillingTokenService } from '#cloud/server/billing'
import { createCollaborationTicketService } from '#cloud/server/collaboration'
import { createCommunityService } from '#cloud/server/community'
import { CloudConfigError, type CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import { createDocumentService } from '#cloud/server/documents'
import { createDocumentVersionService } from '#cloud/server/documents/versions'
import type { TransactionalEmailService } from '#cloud/server/email'
import type { CloudErrorReporter } from '#cloud/server/errors'
import type { InvitationDelivery, InvitationOutbox } from '#cloud/server/invitations'
import type { ForwardedRequestId } from '#cloud/server/logging'
import type { ObjectStore } from '#cloud/server/objects'
import { createUserPictures } from '#cloud/server/pictures'
import {
  createConfiguredCloudPolicy,
  createDefaultCloudPolicy,
  createEntitlementService,
  EntitlementOpenFeatureProvider,
  type CloudPolicy,
  type EntitlementSource
} from '#cloud/server/policy'
import { createDocumentReportService } from '#cloud/server/reports'
import { createServicesTokenService, type ServicesSigningKey } from '#cloud/server/services'
import { createDocumentSharingService } from '#cloud/server/sharing'
import { createWorkspaceMemberService, createWorkspaceService } from '#cloud/server/workspaces'
import type { Kysely } from 'kysely'

export type CloudServices = {
  config: CloudServerConfig
  database: Kysely<CloudDatabase>
  auth: CloudAuthAdapter
  objects: ObjectStore
  resolveIdentity?: CloudIdentityResolver
  resolveSession?: CloudSessionResolver
  /**
   * An approved account even before it accepted the current terms, for leaving: reading its
   * documents and deleting the account. Defaults to `resolveSession` when that is given.
   */
  resolveAccountSession?: CloudSessionResolver
  invitationDelivery?: InvitationDelivery
  invitationOutbox?: InvitationOutbox
  transactionalEmail?: TransactionalEmailService
  enrollment?: EnrollmentService
  entitlementSource?: EntitlementSource
  policy?: CloudPolicy
  /** The imported `servicesSigningKey`, required when the config names one. See `loadServicesSigningKey`. */
  servicesSigningKey?: ServicesSigningKey
  /**
   * Where clients reach this runtime's collaboration relay. Without one, Cloud rooms fall back to
   * peer-to-peer and writes are not enforced by the server.
   */
  relayURL?: string
  /** Ends a restored document's live rooms, on the relay this runtime runs, if any. */
  onDocumentRestored?: (documentId: string) => void
  /** Ends a taken-down document's live rooms, saving them for when it is restored. */
  onDocumentTakenDown?: (documentId: string) => void
  /** Tells a document's live rooms its version history changed, on the relay this runtime runs. */
  onDocumentVersionsChanged?: (documentId: string) => void
  /** Logs errors no route handled, and reports them when the deployment configures error tracking. */
  reportError?: CloudErrorReporter
  /** The request ID this runtime trusts from what stands in front of it, such as `cf-ray`. */
  forwardedRequestId?: ForwardedRequestId
}

/** The domain services the app's routes are built from, over the runtime's injected services. */
export function createAppServices(services: CloudServices) {
  const { config, database, objects } = services
  const workspaces = createWorkspaceService(database)
  const pictures = createUserPictures(database, { publicURL: config.publicURL })
  const workspaceMembers = createWorkspaceMemberService(database, {
    email: services.transactionalEmail,
    publicURL: config.publicURL
  })
  const enrollment =
    services.enrollment ??
    createEnrollmentService(database, {
      publicURL: config.publicURL,
      adminRecipients: config.enrollmentAdminNotificationEmails,
      email: services.transactionalEmail
    })
  const policy =
    services.policy ??
    (services.entitlementSource
      ? createDefaultCloudPolicy(new EntitlementOpenFeatureProvider(services.entitlementSource))
      : createConfiguredCloudPolicy(config, database))
  const documents = createDocumentService(database, objects, {
    policy,
    technicalMaximumUploadBytes: config.technicalLimits.maximumUploadBytes,
    onVersionsChanged: services.onDocumentVersionsChanged,
    trash: {
      retentionMs: config.documentRetentionMs,
      purgeGraceMs: config.documentPurgeGraceMs,
      leaseDurationMs: config.cleanupLeaseDurationMs,
      reportError: services.reportError
    },
    reportError: services.reportError
  })
  const versions = createDocumentVersionService(database, objects, {
    policy,
    deploymentMode: config.deployment,
    onRestored: services.onDocumentRestored,
    onVersionsChanged: services.onDocumentVersionsChanged
  })
  const community = createCommunityService(
    database,
    objects,
    documents,
    versions,
    config.community?.workspaceId ?? null
  )
  const entitlements = createEntitlementService(
    database,
    policy,
    config.technicalLimits.maximumUploadBytes,
    config.technicalLimits.maximumConnectionsPerRoom
  )
  const sharing = createDocumentSharingService(database, {
    delivery: services.invitationDelivery,
    outbox: services.invitationOutbox,
    continuationSecret: config.authSecret,
    publicURL: config.publicURL,
    policy,
    deploymentMode: config.deployment,
    workspaceInvitations: workspaceMembers
  })
  const collaboration = createCollaborationTicketService({
    database,
    sharing,
    authSecret: config.authSecret,
    relayURL: services.relayURL,
    policy,
    deploymentMode: config.deployment
  })
  if (config.servicesSigningKey && !services.servicesSigningKey) {
    throw new CloudConfigError('Services need the signing key imported by loadServicesSigningKey')
  }
  const servicesTokens = services.servicesSigningKey
    ? createServicesTokenService({
        database,
        policy,
        deploymentMode: config.deployment,
        issuer: new URL(config.publicURL).origin,
        signingKey: services.servicesSigningKey,
        lifetimeSeconds: config.servicesTokenLifetimeSeconds
      })
    : undefined
  const billingTokens =
    services.servicesSigningKey && config.billingEndpoint
      ? createBillingTokenService({
          issuer: new URL(config.publicURL).origin,
          signingKey: services.servicesSigningKey,
          lifetimeSeconds: config.servicesTokenLifetimeSeconds
        })
      : undefined
  const reports = createDocumentReportService(database, {
    sharing,
    email: services.transactionalEmail,
    adminRecipients: config.enrollmentAdminNotificationEmails,
    publicURL: config.publicURL
  })
  return {
    workspaces,
    pictures,
    workspaceMembers,
    enrollment,
    policy,
    documents,
    versions,
    community,
    entitlements,
    sharing,
    collaboration,
    servicesTokens,
    billingTokens,
    reports
  }
}

export type CloudAppServices = ReturnType<typeof createAppServices>
