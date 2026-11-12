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
  cloudServices: 'cloud.services.enabled',
  monthlyCreditAllowance: 'cloud.services.monthly-credit-allowance'
} as const

export type CloudPolicyContext = {
  /** Whose entitlements apply: an account by default for a workspace, its owner's. */
  targetingKey: string
  /** Required, so an account ID never reads as a workspace's and falls back to defaults. */
  subjectType: 'workspace' | 'user' | 'organization' | 'deployment'
  actorId?: string
  workspaceId?: string
  organizationId?: string
  documentId?: string
  deploymentMode: 'official' | 'self-hosted'
}
