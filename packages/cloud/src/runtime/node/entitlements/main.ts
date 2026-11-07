import { readFile } from 'node:fs/promises'

import { createAccountEntitlementRepository, parseStaticEntitlementsTOML } from '#cloud/server'
import { parse as parseTOML } from 'smol-toml'

import { withNodeCloudDatabase } from '../command'
import { entitlementWriteRefusal } from './refusal'

const operation = process.argv[2]
const accountIndex = process.argv.indexOf('--account')
const fileIndex = process.argv.indexOf('--file')
const dryRun = process.argv.includes('--dry-run')
const userId = accountIndex !== -1 ? process.argv[accountIndex + 1] : undefined
if (!userId) throw new Error('Expected --account <user id>')

await withNodeCloudDatabase(async (database, config) => {
  const repository = createAccountEntitlementRepository(database)
  const refusal = entitlementWriteRefusal(config, operation, dryRun)
  if (refusal) throw new Error(refusal)
  if (operation === 'get') {
    console.log(JSON.stringify({ entitlement: await repository.get(userId) }))
  } else if (operation === 'clear') {
    if (dryRun) {
      console.log(JSON.stringify({ dryRun, cleared: false, userId }))
      return
    }
    await repository.clear(userId)
    console.log(JSON.stringify({ cleared: true, userId }))
  } else if (operation === 'set') {
    const file = fileIndex !== -1 ? process.argv[fileIndex + 1] : undefined
    if (!file) throw new Error('Expected --file <path>')
    const values = parseStaticEntitlementsTOML(parseTOML(await readFile(file, 'utf8')))
    if (dryRun) {
      console.log(JSON.stringify({ dryRun, userId, values }))
      return
    }
    console.log(JSON.stringify({ entitlement: await repository.set(userId, values, 'cli') }))
  } else {
    throw new Error('Expected operation: get, set, or clear')
  }
})
