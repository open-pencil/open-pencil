import { createNodeCloudDatabase } from '#cloud/runtime/node/database'
import { createS3ObjectStore } from '#cloud/runtime/s3/objects'
import {
  cloudServerConfigFromEnvironment,
  createCloudApp,
  createCloudAuth,
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
  const auth = createCloudAuth(config, database)
  const objects = createS3ObjectStore(config)
  const app = createCloudApp({
    config,
    database,
    auth,
    objects
  })
  return { app, config, database, objects }
}
