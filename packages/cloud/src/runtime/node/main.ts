#!/usr/bin/env node
import dedent from 'dedent'

import { startNodeCloudServer } from './server'

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(dedent`
    Usage: openpencil-cloud

    Runs OpenPencil Cloud. Settings come from the environment:
      OPENPENCIL_CLOUD_CONFIG    the deployment TOML file (required)
      OPENPENCIL_CLOUD_SITE_DIR  the editor and portal build to serve
      OPENPENCIL_CLOUD_DEV_SITE_URL
                                 a Vite dev server to serve them from instead (cloud:dev)
      PORT, HOST                 where to listen (default 8787 on 0.0.0.0)
    plus the secrets the TOML names. See https://openpencil.dev/reference/self-hosting-cloud
  `)
  process.exit(0)
}

const cloud = await startNodeCloudServer()
console.log(`OpenPencil Cloud listening on ${cloud.url}`)

function shutdown() {
  void cloud.stop().then(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
