export const CLOUD_FEATURE_KEYS = {
  capabilityLinks: 'cloud.sharing.capability-links',
  anonymousView: 'cloud.sharing.anonymous-view',
  anonymousEdit: 'cloud.sharing.anonymous-edit',
  guestPresence: 'cloud.sharing.guest-presence',
  collaboration: 'cloud.collaboration.enabled',
  serverEnforcedWrites: 'cloud.collaboration.server-enforced-writes',
  revisionHistory: 'cloud.documents.revision-history',
  maximumFileBytes: 'cloud.documents.maximum-file-bytes'
} as const

export type CloudPolicyContext = {
  targetingKey: string
  actorId?: string
  workspaceId?: string
  organizationId?: string
  documentId?: string
  deploymentMode: 'official' | 'self-hosted'
}
