import { createCloudflareCloud } from '@open-pencil/cloud/runtime/cloudflare'

import config from './openpencil-cloud.toml'

const cloud = createCloudflareCloud(config)

export default cloud.worker
export const CollaborationRelayObject = cloud.CollaborationRelayObject
