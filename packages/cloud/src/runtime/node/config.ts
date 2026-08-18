import { readFile } from 'node:fs/promises'

import {
  parseCloudDeploymentTOML,
  type CloudEnvironment,
  type CloudServerConfig
} from '#cloud/server'

export async function loadNodeCloudServerConfig(
  environment: CloudEnvironment
): Promise<CloudServerConfig | null> {
  const path = environment.OPENPENCIL_CLOUD_CONFIG
  if (!path) return null
  return parseCloudDeploymentTOML(await readFile(path, 'utf8'), environment)
}
