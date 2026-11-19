#!/usr/bin/env node
import dedent from 'dedent'

import { startNodeServices } from './server'

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(dedent`
    Usage: openpencil-services

    Runs the reference AI service for a self-hosted OpenPencil Cloud. Settings come from the
    environment:
      OPENPENCIL_SERVICES_CONFIG  the services TOML file (required)
      PORT, HOST                  where to listen (default 8788 on 0.0.0.0)
    plus the secrets the TOML names. See https://openpencil.dev/cloud/self-hosting/
  `)
  process.exit(0)
}

const relay = await startNodeServices()
console.log(`OpenPencil services listening on ${relay.url}`)

let stopping: Promise<void> | undefined

function shutdown() {
  stopping ??= relay.stop().then(
    () => process.exit(0),
    (error: unknown) => {
      console.error('[Services] Shutdown failed:', error)
      process.exit(1)
    }
  )
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
