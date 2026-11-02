import { stringify } from 'smol-toml'

import type { CloudDeploymentInput } from '@open-pencil/cloud/server'

export type LocalCloudEndpoints = {
  cloudURL: string
  editorURL: string
  objectStorageURL: string
  smtpPort: number
}

/** Deployment settings for one worktree's local Cloud, with open sign-up and captured mail. */
export function localCloudDeployment(endpoints: LocalCloudEndpoints): CloudDeploymentInput {
  return {
    schema_version: 2,
    deployment: {
      mode: 'self-hosted',
      public_url: endpoints.cloudURL,
      indexing: 'deny',
      trusted_origins: [endpoints.editorURL, endpoints.cloudURL]
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
      source: 'static',
      documents: { maximum_file_bytes: 1_073_741_824, revision_history: true },
      storage: { maximum_bytes: 1_099_511_627_776 },
      sharing: {
        links: true,
        guest_view: true,
        guest_edit: true,
        guest_presence: true
      },
      collaboration: { enabled: true, maximum_participants: 100 }
    }
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
