import { createNodeAdminAssetHandler, createNodeCloudApplication } from '@open-pencil/cloud/runtime/node'
import { cloudDiscoveryFromConfig } from '@open-pencil/cloud/server'
import { handle } from 'hono/vercel'

const { app, config } = await createNodeCloudApplication()
const adminAssets = createNodeAdminAssetHandler(
  new URL('../../../dist/admin', import.meta.url).pathname,
  cloudDiscoveryFromConfig(config)
)
const api = handle(app)

async function handler(request: Request): Promise<Response> {
  return (await adminAssets(request)) ?? api(request)
}

export const GET = handler
export const POST = handler
export const DELETE = handler
export const OPTIONS = handler
