export const CLOUD_FEATURE_KEYS = {
  links: 'cloud.sharing.links',
  guestView: 'cloud.sharing.guest-view',
  guestEdit: 'cloud.sharing.guest-edit',
  guestPresence: 'cloud.sharing.guest-presence',
  collaboration: 'cloud.collaboration.enabled',
  serverEnforcedWrites: 'cloud.collaboration.server-enforced-writes',
  revisionHistory: 'cloud.documents.revision-history',
  maximumFileBytes: 'cloud.documents.maximum-file-bytes',
  maximumStorageBytes: 'cloud.storage.maximum-bytes',
  maximumParticipants: 'cloud.collaboration.maximum-participants',
  cloudAI: 'cloud.ai.enabled',
  monthlyCreditAllowance: 'cloud.ai.monthly-credit-allowance'
} as const

export type CloudPolicyContext = {
  targetingKey: string
  actorId?: string
  workspaceId?: string
  organizationId?: string
  documentId?: string
  deploymentMode: 'official' | 'self-hosted'
}
