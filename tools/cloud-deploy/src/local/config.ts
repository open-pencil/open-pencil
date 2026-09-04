import { stringify } from 'smol-toml'

import type { CloudDeploymentConfig } from '@open-pencil/cloud/server'

export type LocalCloudDevelopmentConfig = {
  cloudURL: string
  editorURL: string
}

export function localCloudDeployment(config: LocalCloudDevelopmentConfig): CloudDeploymentConfig {
  return {
    schema_version: 2,
    deployment: {
      mode: 'self-hosted',
      public_url: config.cloudURL,
      app_url: config.editorURL,
      indexing: 'deny',
      trusted_origins: [config.editorURL, config.cloudURL]
    },
    database: {},
    authentication: {
      enrollment_mode: 'open',
      admin_notification_emails: [],
      email_password: {
        enabled: true,
        sign_up: true,
        minimum_password_length: 15,
        maximum_password_length: 128,
        verification_link_expires_minutes: 60,
        password_reset_link_expires_minutes: 60,
        compromised_password_check: false
      },
      trusted_proxies: { headers: [], addresses: [] }
    },
    object_storage: {
      endpoint: 'http://seaweedfs:8333',
      region: 'us-east-1',
      bucket: 'openpencil',
      force_path_style: true,
      checksum_verification: 'metadata'
    },
    email: {
      transport: 'smtp',
      from: 'OpenPencil Cloud <cloud@openpencil.localhost>',
      smtp: { host: 'mailpit', port: 1025, secure: false }
    },
    workers: {
      email: {
        batch_size: 50,
        interval_ms: 1000,
        lease_ms: 300000,
        maximum_attempts: 5
      },
      cleanup: {
        enabled: true,
        batch_size: 100,
        interval_ms: 60000,
        lease_ms: 300000,
        document_retention_days: 30
      }
    },
    entitlements: {
      source: 'static',
      documents: { maximum_file_bytes: 1073741824, revision_history: true },
      storage: { maximum_bytes: 1099511627776 },
      sharing: {
        capability_links: true,
        anonymous_view: true,
        anonymous_edit: true,
        guest_presence: true
      },
      collaboration: { enabled: true, maximum_participants: 100 }
    },
    technical_limits: {
      maximum_upload_bytes: 1073741824,
      maximum_collaboration_message_bytes: 1048576,
      maximum_connections_per_room: 1000
    }
  }
}

export function localCloudDeploymentTOML(config: LocalCloudDevelopmentConfig): string {
  return `${stringify(localCloudDeployment(config))}\n`
}

export function composeProjectName(branch: string): string {
  const normalized = branch
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
  return `openpencil-cloud-${normalized || 'development'}`
}
