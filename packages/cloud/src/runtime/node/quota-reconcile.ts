import { createStorageReconciliationService } from '#cloud/server'

import { withNodeCloudDatabase } from './command'

const dryRun = process.argv.includes('--dry-run')
const results = await withNodeCloudDatabase((database) =>
  createStorageReconciliationService(database).reconcile({ dryRun })
)
console.log(JSON.stringify({ dryRun, results }))
