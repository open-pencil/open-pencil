import { stringify } from 'smol-toml'

import type { CloudDeploymentInput } from '@open-pencil/cloud/server'

export type LocalCloudEndpoints = {
  cloudURL: string
  editorURL: string
  objectStorageURL: string
  smtpPort: number
  /** The workspace the server shows as its community gallery, if any. */
  communityWorkspace?: string
  /**
   * A billing service to sell plans through, such as the official one run locally, with the
   * services endpoint whose key signs its tokens.
   */
  billing?: { endpoint: string; servicesEndpoint: string }
}

/** Deployment settings for one worktree's local Cloud, with open sign-up and captured mail. */
export function localCloudDeployment(endpoints: LocalCloudEndpoints): CloudDeploymentInput {
  const deployment: CloudDeploymentInput = {
    schema_version: 2,
    deployment: {
      mode: 'self-hosted',
      public_url: endpoints.cloudURL,
      indexing: 'deny',
      trusted_origins: [endpoints.editorURL, endpoints.cloudURL],
      // Any page may frame documents, so embeds can be tried from a local HTML file.
      embedding: { enabled: true }
    },
    database: {},
    authentication: {
      enrollment: { mode: 'open', notification_emails: [] },
      email_password: {
        enabled: true,
        sign_up: true,
        minimum_password_length: 8,
        maximum_password_length: 128,
        verification_link_lifetime_minutes: 60,
        password_reset_link_lifetime_minutes: 60,
        compromised_password_check: false
      },
      mfa: {
        required_for_admins: false,
        totp: true,
        recovery_codes: true,
        trusted_device_lifetime_days: 14
      },
      passkeys: { enabled: true, rp_name: 'OpenPencil Cloud' },
      trusted_proxies: { headers: [], addresses: [] }
    },
    object_storage: {
      endpoint: endpoints.objectStorageURL,
      region: 'us-east-1',
      bucket: 'openpencil',
      force_path_style: true,
      checksum_verification: 'metadata',
      maximum_upload_bytes: 1_073_741_824
    },
    collaboration: { maximum_message_bytes: 1_048_576, maximum_connections_per_room: 1000 },
    documents: { retention_days: 30 },
    // Apps can connect, so a worktree exercises the approval page and connected apps.
    oauth: { enabled: true },
    email: {
      transport: 'smtp',
      from: 'OpenPencil Cloud <cloud@openpencil.localhost>',
      smtp: { host: '127.0.0.1', port: endpoints.smtpPort, secure: false }
    },
    workers: {
      email: { batch_size: 50, interval_ms: 1000, lease_ms: 300_000, maximum_attempts: 5 },
      cleanup: {
        enabled: true,
        batch_size: 100,
        interval_ms: 60_000,
        lease_ms: 300_000
      }
    },
    entitlements: {
      // Billing keeps the plans it sells in the database, which static entitlements would hide.
      source: endpoints.billing ? 'database' : 'static',
      documents: { maximum_file_bytes: 1_073_741_824, revision_history: true },
      // With billing, the free plan Cloud publishes is what its pricing page shows, so it is the
      // official Cloud's 300 MB and not room to develop in.
      storage: { maximum_bytes: endpoints.billing ? 314_572_800 : 1_099_511_627_776 },
      sharing: {
        links: true,
        guest_view: true,
        guest_edit: false,
        guest_presence: true
      },
      collaboration: { enabled: true, maximum_participants: 100 }
    }
  }
  if (endpoints.communityWorkspace) {
    deployment.community = { workspace: endpoints.communityWorkspace }
  }
  if (endpoints.billing) Object.assign(deployment, billingTables(endpoints.billing))
  return deployment
}

/**
 * What a billing service needs from Cloud: the services' key to sign its tokens, the internal API
 * to set the plans it sells, and entitlements in the database, where those plans are kept; their
 * secrets come from the environment `cloud:dev` sets.
 */
function billingTables(billing: { endpoint: string; servicesEndpoint: string }) {
  return {
    services: { endpoint: billing.servicesEndpoint },
    billing: { endpoint: billing.endpoint },
    internal_api: {}
  }
}

export function localCloudDeploymentTOML(endpoints: LocalCloudEndpoints): string {
  return `${stringify(localCloudDeployment(endpoints))}\n`
}

export function composeProjectName(branch: string): string {
  const normalized = branch
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
  return `openpencil-cloud-${normalized || 'development'}`
}
