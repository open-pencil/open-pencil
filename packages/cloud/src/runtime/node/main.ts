import { startNodeCloudServer } from './server'

const cloud = await startNodeCloudServer()
console.log(`OpenPencil Cloud listening on ${cloud.server.url}`)

function shutdown() {
  void cloud.stop().then(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
