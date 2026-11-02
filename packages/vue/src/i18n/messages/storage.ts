import { i18n } from '#vue/i18n/create'

export const storageMessageDefaults = {
  workspace: 'Storage workspace',
  openWorkspace: 'Open workspace',
  newStoredDocument: 'New document',
  emptyStorageWorkspace: 'No stored documents yet.',
  loadingDocuments: 'Loading documents…',
  notConfigured: 'Configure storage before using this workspace.',
  providerS3: 'S3 storage',
  providerR2: 'Cloudflare R2',
  providerAmazonS3: 'Amazon S3',
  providerBackblaze: 'Backblaze B2',
  loadingWorkspace: 'Loading storage workspace…',
  copyCors: 'Copy CORS JSON',
  endpoint: 'Endpoint',
  bucket: 'Bucket',
  region: 'Region',
  accessKeyID: 'Access key ID',
  secretAccessKey: 'Secret access key',
  cloudTitle: 'Lawha Cloud',
  cloudDescription:
    'Your team’s workspace, hosted for you: live sync, share links, team libraries, and hosted AI, with no bucket to set up. Join the waitlist and we’ll email you when it opens.',
  waitlistEmail: 'Email address',
  waitlistPlaceholder: 'you@example.com',
  waitlistJoin: 'Join the waitlist',
  waitlistConfirmHuman: 'Confirm you’re human',
  waitlistInvalid: 'Enter a valid email address.',
  waitlistJoined: 'Check your inbox',
  waitlistJoinedDetail:
    'Open the link we sent to confirm your address. We only email you about Lawha Cloud.',
  waitlistRefused: 'We couldn’t confirm you’re not a bot. Try again.',
  waitlistLimited: 'Too many attempts. Try again in a minute.',
  waitlistFailed: 'Couldn’t reach the waitlist. Check your connection and try again.',
  waitlistUnavailable: 'You can’t join from here. Join on lawha.invalid instead.',
  waitlistOpenWebsite: 'Join on lawha.invalid'
} as const

export const storageMessages = i18n('storage', storageMessageDefaults)
