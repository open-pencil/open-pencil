import { startNodeCloudServer } from './server'

const cloud = await startNodeCloudServer()
console.log(`OpenPencil Cloud listening on ${cloud.server.url}`)

async function shutdown() {
  await cloud.stop()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
