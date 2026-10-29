import { createPostgresCloudDatabase } from '#cloud/runtime/postgres/database'
import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import {
  createCloudAuthenticationRuntime,
  createCloudApp,
  loadAISigningKey,
  type CloudApp,
  type CloudEnvironment,
  type CloudServerConfig,
  type ObjectStore
} from '#cloud/server'

import { loadNodeCloudServerConfig } from './config'
import { createNodeTransactionalEmailRuntime } from './email/runtime'

export type NodeCloudApplicationOptions = {
  environment?: CloudEnvironment
  databaseURL?: string
}

export async function createNodeCloudApplication(
  options: NodeCloudApplicationOptions = {}
): Promise<{
  app: CloudApp
  config: CloudServerConfig
  database: ReturnType<typeof createPostgresCloudDatabase>
  objects: ObjectStore
  email: ReturnType<typeof createNodeTransactionalEmailRuntime>['email']
}> {
  const environment = options.environment ?? process.env
  const config = await loadNodeCloudServerConfig(environment)
  const aiSigningKey = await loadAISigningKey(config)
  const database = createPostgresCloudDatabase({
    connectionString: options.databaseURL ?? config.databaseURL
  })
  const objects = createS3ObjectStore(config)
  const { email, invitationOutbox } = createNodeTransactionalEmailRuntime(config, database)
  const { auth, enrollment } = createCloudAuthenticationRuntime(config, database, email)
  const app = createCloudApp({
    config,
    database,
    auth,
    objects,
    invitationOutbox,
    transactionalEmail: email,
    enrollment,
    aiSigningKey
  })
  return { app, config, database, objects, email }
}
