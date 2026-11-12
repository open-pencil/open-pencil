import { createCloudflareCloud } from '#cloud/runtime/cloudflare'

import config from './openpencil-cloud.toml'

// Production's data stays in the EU, rooms' Durable Objects included.
const cloud = createCloudflareCloud(config, { relayJurisdiction: 'eu' })

export default cloud.worker
export const CollaborationRelayObject = cloud.CollaborationRelayObject
