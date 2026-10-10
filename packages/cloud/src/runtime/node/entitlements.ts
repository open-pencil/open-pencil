import { readFile } from 'node:fs/promises'

import { createWorkspaceEntitlementRepository, parseStaticEntitlementsTOML } from '#cloud/server'
import { parse as parseTOML } from 'smol-toml'

import { withNodeCloudDatabase } from './command'

const operation = process.argv[2]
const workspaceIndex = process.argv.indexOf('--workspace')
const fileIndex = process.argv.indexOf('--file')
const dryRun = process.argv.includes('--dry-run')
const workspaceId = workspaceIndex !== -1 ? process.argv[workspaceIndex + 1] : undefined
if (!workspaceId) throw new Error('Expected --workspace <uuid>')

await withNodeCloudDatabase(async (database) => {
  const repository = createWorkspaceEntitlementRepository(database)
  if (operation === 'get') {
    console.log(JSON.stringify({ entitlement: await repository.get(workspaceId) }))
  } else if (operation === 'clear') {
    if (dryRun) {
      console.log(JSON.stringify({ dryRun, cleared: false, workspaceId }))
      return
    }
    await repository.clear(workspaceId)
    console.log(JSON.stringify({ cleared: true, workspaceId }))
  } else if (operation === 'set') {
    const file = fileIndex !== -1 ? process.argv[fileIndex + 1] : undefined
    if (!file) throw new Error('Expected --file <path>')
    const values = parseStaticEntitlementsTOML(parseTOML(await readFile(file, 'utf8')))
    if (dryRun) {
      console.log(JSON.stringify({ dryRun, workspaceId, values }))
      return
    }
    console.log(JSON.stringify({ entitlement: await repository.set(workspaceId, values, 'cli') }))
  } else {
    throw new Error('Expected operation: get, set, or clear')
  }
})
