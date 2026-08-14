import { createNodeCloudApplication } from '@open-pencil/cloud/runtime/node'
import { handle } from 'hono/vercel'

const { app } = createNodeCloudApplication()

export const GET = handle(app)
export const POST = handle(app)
export const DELETE = handle(app)
export const OPTIONS = handle(app)
