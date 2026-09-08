import {
  createCloudCollaborationRelay,
  createNodeCloudDatabase
} from '@open-pencil/cloud/runtime/node'
import { createCollaborationStateStore, migrateCloudDatabase } from '@open-pencil/cloud/server'

const databaseURL = process.env.DATABASE_URL
const authSecret = process.env.BETTER_AUTH_SECRET
if (!databaseURL || !authSecret) throw new Error('Relay E2E configuration is incomplete')
const database = createNodeCloudDatabase({ connectionString: databaseURL })
await migrateCloudDatabase(database)
const relay = createCloudCollaborationRelay({
  authSecret,
  stateStore: createCollaborationStateStore(database)
})
await relay.listen(Number(process.env.OPENPENCIL_CLOUD_COLLABORATION_PORT ?? 12345))
console.log('OPENPENCIL_CLOUD_RELAY_READY')

async function stop() {
  await relay.destroy()
  await database.destroy()
  process.exit(0)
}

process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())
