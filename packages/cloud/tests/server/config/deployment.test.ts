import { describe, expect, test } from 'bun:test'

import { parseCloudDeploymentTOML } from '@open-pencil/cloud/server'

const source = `
schema_version = 1
[deployment]
mode = "self-hosted"
public_url = "https://cloud.example.com"
app_url = "https://app.example.com"
trusted_origins = ["https://app.example.com"]
[database.url]
from_env = "DATABASE_URL"
[authentication.secret]
from_env = "AUTH_SECRET"
[object_storage]
endpoint = "https://objects.example.com"
region = "us-east-1"
bucket = "openpencil"
[object_storage.access_key_id]
from_env = "S3_KEY"
[object_storage.secret_access_key]
from_env = "S3_SECRET"
[technical_limits]
maximum_upload_bytes = 104857600
maximum_collaboration_message_bytes = 524288
maximum_connections_per_room = 250
`

const environment = {
  DATABASE_URL: 'postgresql://user:password@database/openpencil',
  AUTH_SECRET: 'auth-secret-at-least-32-characters-long',
  S3_KEY: 'access-key',
  S3_SECRET: 'secret-key'
}

describe('Cloud TOML deployment configuration', () => {
  test('resolves secret references and normalizes technical limits', () => {
    expect(parseCloudDeploymentTOML(source, environment)).toMatchObject({
      deployment: 'self-hosted',
      databaseURL: environment.DATABASE_URL,
      authSecret: environment.AUTH_SECRET,
      technicalLimits: {
        maximumUploadBytes: 104857600,
        maximumCollaborationMessageBytes: 524288,
        maximumConnectionsPerRoom: 250
      }
    })
  })

  test('rejects missing secrets and unsupported schema versions', () => {
    expect(() => parseCloudDeploymentTOML(source, {})).toThrow('DATABASE_URL')
    expect(() =>
      parseCloudDeploymentTOML(
        source.replace('schema_version = 1', 'schema_version = 2'),
        environment
      )
    ).toThrow()
  })
})
