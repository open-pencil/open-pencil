import { parseArgs } from 'node:util'

import { createCloudAPIClient, discoverCloud } from '@open-pencil/cloud/client'

import { EXAMPLES } from './examples'
import { describeOutcome, publishExample } from './gallery'

/**
 * Publishes the gallery's examples to a Cloud server's community workspace, as the account whose
 * personal access token `CLOUD_COMMUNITY_TOKEN` holds.
 *
 *   bun tools/ci/cloud-examples/src/publish.ts --server <url> --workspace <id>
 *     [--version <name> [--description <text>]]
 */
if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      server: { type: 'string' },
      workspace: { type: 'string' },
      version: { type: 'string' },
      description: { type: 'string' }
    }
  })
  const token = process.env.CLOUD_COMMUNITY_TOKEN
  if (!values.server || !values.workspace || !token) {
    throw new Error(
      'Usage: publish.ts --server <url> --workspace <id> [--version <name> --description <text>], with CLOUD_COMMUNITY_TOKEN set'
    )
  }
  const discovery = await discoverCloud(values.server)
  const cloud = createCloudAPIClient(discovery.apiURL, { accessToken: token })
  const release = values.version
    ? { name: values.version, description: values.description ?? '' }
    : undefined
  for (const example of EXAMPLES) {
    const outcome = await publishExample({
      cloud,
      workspaceId: values.workspace,
      name: example.name,
      bytes: await example.build(),
      release,
      objectFetch: (input, init) => fetch(input, init)
    })
    console.log(describeOutcome(outcome))
  }
}
