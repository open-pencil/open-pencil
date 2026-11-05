import { expect, test } from 'bun:test'
import { join } from 'node:path'

import { bundleOfficialWorkers, officialDeployments } from '#cloud-deploy/bundle'

import { resolveWorkspaceRoot, type CommandRequest } from '@open-pencil/package-artifacts-tools'

const root = await resolveWorkspaceRoot(import.meta.dir)

test('bundles each official deployment around the built Cloud site', async () => {
  const deployments = await officialDeployments(root)
  expect(deployments).toContain(join(root, 'packages/cloud/deploy/openpencil/staging'))
  const requests: CommandRequest[] = []
  await bundleOfficialWorkers(root, async (request) => {
    requests.push(request)
    return { stdout: '', stderr: '' }
  })
  expect(requests.map((request) => request.cwd)).toEqual(deployments)
  expect(requests[0]?.args).toEqual([
    'wrangler',
    'deploy',
    '--dry-run',
    '--assets',
    join(root, 'dist-cloud')
  ])
})
