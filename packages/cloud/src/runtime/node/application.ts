import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import {
  createBetterAuthAdapter,
  createCloudApp,
  createEnrollmentService,
  type CloudApp,
  type CloudEnvironment,
  type CloudServerConfig,
  type ObjectStore
} from '#cloud/server'

import { resolveNodeCloudServerConfig } from './config'
import { createNodeCloudDatabase } from './database'
import { createNodeTransactionalEmailRuntime } from './email-runtime'

export type NodeCloudApplicationOptions = {
  environment?: CloudEnvironment
  databaseURL?: string
}

export async function createNodeCloudApplication(
  options: NodeCloudApplicationOptions = {}
): Promise<{
  app: CloudApp
  config: CloudServerConfig
  database: ReturnType<typeof createNodeCloudDatabase>
  objects: ObjectStore
  email: ReturnType<typeof createNodeTransactionalEmailRuntime>['email']
}> {
  const environment = options.environment ?? process.env
  const config = await resolveNodeCloudServerConfig(environment)
  const database = createNodeCloudDatabase({
    connectionString: options.databaseURL ?? config.databaseURL
  })
  const objects = createS3ObjectStore(config)
  const { email, invitationOutbox } = createNodeTransactionalEmailRuntime(config, database)
  const enrollment = createEnrollmentService(database, {
    appURL: config.appURL ?? config.publicURL,
    adminRecipients: config.enrollmentAdminNotificationEmails,
    email
  })
  const auth = createBetterAuthAdapter(config, database, enrollment)
  const app = createCloudApp({
    config,
    database,
    auth,
    objects,
    invitationOutbox,
    transactionalEmail: email,
    enrollment
  })
  return { app, config, database, objects, email }
}
