import {
  CLOUD_DISCOVERY_PATH,
  CLOUD_PROTOCOL_VERSION,
  parseCloudDiscovery,
  type CloudDiscovery
} from '#cloud/contract'
import { Hono } from 'hono'

export type CloudServerConfig = Omit<CloudDiscovery, 'protocolVersion'>

export function createCloudApp(config: CloudServerConfig) {
  const discovery = parseCloudDiscovery({
    ...config,
    protocolVersion: CLOUD_PROTOCOL_VERSION
  })

  return new Hono()
    .get('/health', (context) =>
      context.json({
        status: 'ok' as const,
        protocolVersion: CLOUD_PROTOCOL_VERSION
      })
    )
    .get(CLOUD_DISCOVERY_PATH, (context) => context.json(discovery))
}

export type CloudApp = ReturnType<typeof createCloudApp>
