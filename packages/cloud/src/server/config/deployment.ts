import { readFile } from 'node:fs/promises'

import { parse as parseTOML } from 'smol-toml'
import * as v from 'valibot'

import type { CloudEnvironment } from './environment'
import { parseCloudServerConfig, type CloudServerConfig } from './schema'

const secretReferenceSchema = v.object({ from_env: v.pipe(v.string(), v.trim(), v.minLength(1)) })
const deploymentConfigSchema = v.object({
  schema_version: v.literal(1),
  deployment: v.object({
    mode: v.picklist(['official', 'self-hosted']),
    public_url: v.pipe(v.string(), v.url()),
    app_url: v.optional(v.pipe(v.string(), v.url())),
    trusted_origins: v.optional(v.array(v.pipe(v.string(), v.url())), [])
  }),
  database: v.object({ url: secretReferenceSchema }),
  authentication: v.object({ secret: secretReferenceSchema }),
  object_storage: v.object({
    endpoint: v.pipe(v.string(), v.url()),
    region: v.string(),
    bucket: v.string(),
    access_key_id: secretReferenceSchema,
    secret_access_key: secretReferenceSchema,
    force_path_style: v.optional(v.boolean(), true),
    checksum_verification: v.optional(v.picklist(['native', 'metadata']), 'native')
  }),
  collaboration: v.optional(
    v.object({ public_url: v.pipe(v.string(), v.url()), port: v.optional(v.number(), 1234) })
  ),
  technical_limits: v.optional(
    v.object({
      maximum_upload_bytes: v.optional(v.number()),
      maximum_collaboration_message_bytes: v.optional(v.number()),
      maximum_connections_per_room: v.optional(v.number())
    })
  )
})

function secret(environment: CloudEnvironment, reference: { from_env: string }): string {
  const value = environment[reference.from_env]
  if (!value) throw new Error(`Required secret binding is unavailable: ${reference.from_env}`)
  return value
}

export function parseCloudDeploymentTOML(
  source: string,
  environment: CloudEnvironment
): CloudServerConfig {
  const config = v.parse(deploymentConfigSchema, parseTOML(source))
  return parseCloudServerConfig({
    deployment: config.deployment.mode,
    publicURL: config.deployment.public_url,
    appURL: config.deployment.app_url,
    trustedOrigins: config.deployment.trusted_origins,
    databaseURL: secret(environment, config.database.url),
    authSecret: secret(environment, config.authentication.secret),
    s3Endpoint: config.object_storage.endpoint,
    s3Region: config.object_storage.region,
    s3Bucket: config.object_storage.bucket,
    s3AccessKeyId: secret(environment, config.object_storage.access_key_id),
    s3SecretAccessKey: secret(environment, config.object_storage.secret_access_key),
    s3ForcePathStyle: config.object_storage.force_path_style,
    s3ChecksumVerification: config.object_storage.checksum_verification,
    collaborationURL: config.collaboration?.public_url,
    collaborationPort: config.collaboration?.port,
    technicalLimits: config.technical_limits
      ? {
          maximumUploadBytes: config.technical_limits.maximum_upload_bytes,
          maximumCollaborationMessageBytes:
            config.technical_limits.maximum_collaboration_message_bytes,
          maximumConnectionsPerRoom: config.technical_limits.maximum_connections_per_room
        }
      : undefined
  })
}

export async function loadCloudServerConfig(
  environment: CloudEnvironment
): Promise<CloudServerConfig | null> {
  const path = environment.OPENPENCIL_CLOUD_CONFIG
  if (!path) return null
  return parseCloudDeploymentTOML(await readFile(path, 'utf8'), environment)
}
