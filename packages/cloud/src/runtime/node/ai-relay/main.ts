import { startNodeAIRelay } from './server'

const relay = await startNodeAIRelay()
console.log(`OpenPencil AI relay listening on ${relay.url}`)

let stopping: Promise<void> | undefined

function shutdown() {
  stopping ??= relay.stop().then(
    () => process.exit(0),
    (error: unknown) => {
      console.error('[AI relay] Shutdown failed:', error)
      process.exit(1)
    }
  )
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
