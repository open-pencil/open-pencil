import { readFile } from 'node:fs/promises'

import {
  CloudConfigError,
  parseCloudDeploymentTOML,
  type CloudEnvironment,
  type CloudServerConfig
} from '#cloud/server'

export async function loadNodeCloudServerConfig(
  environment: CloudEnvironment
): Promise<CloudServerConfig> {
  const path = environment.OPENPENCIL_CLOUD_CONFIG
  if (!path) throw new CloudConfigError('OPENPENCIL_CLOUD_CONFIG must name a deployment TOML file')
  return parseCloudDeploymentTOML(await readFile(path, 'utf8'), environment)
}
