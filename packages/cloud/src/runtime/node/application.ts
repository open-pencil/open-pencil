import { createNodeCloudDatabase } from '#cloud/runtime/node/database'
import { createSMTPInvitationDelivery } from '#cloud/runtime/node/email'
import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import {
  cloudServerConfigFromEnvironment,
  createCloudApp,
  createBetterAuthAdapter,
  type CloudApp,
  type CloudEnvironment,
  type CloudServerConfig,
  type ObjectStore
} from '#cloud/server'

export type NodeCloudApplicationOptions = {
  environment?: CloudEnvironment
  databaseURL?: string
}

export function createNodeCloudApplication(options: NodeCloudApplicationOptions = {}): {
  app: CloudApp
  config: CloudServerConfig
  database: ReturnType<typeof createNodeCloudDatabase>
  objects: ObjectStore
} {
  const environment = options.environment ?? process.env
  const config = cloudServerConfigFromEnvironment(environment)
  const database = createNodeCloudDatabase({
    connectionString: options.databaseURL ?? config.databaseURL
  })
  const auth = createBetterAuthAdapter(config, database)
  const objects = createS3ObjectStore(config)
  const invitationDelivery =
    config.smtpHost && config.smtpPort && config.emailFrom
      ? createSMTPInvitationDelivery({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpSecure ?? config.smtpPort === 465,
          user: config.smtpUser,
          password: config.smtpPassword,
          from: config.emailFrom
        })
      : undefined
  const app = createCloudApp({
    config,
    database,
    auth,
    objects,
    invitationDelivery
  })
  return { app, config, database, objects }
}
