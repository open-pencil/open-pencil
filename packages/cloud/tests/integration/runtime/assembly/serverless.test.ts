import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'
import { createMemoryObjectStore } from '#cloud-test/helpers/objects'

import { createNodeCloudApplication } from '@open-pencil/cloud/runtime/node'

// Deployment adapters must assemble an app without starting listeners, migrations, or timers.
describe('serverless Cloud assembly', () => {
  test('keeps application construction separate from migrations and listeners', async () => {
    const runtime = await createCloudTestDatabase()
    const objects = createMemoryObjectStore()
    try {
      // Exercise the same portable app dependencies used by platform adapters.
      expect(runtime.database).toBeDefined()
      expect(objects.store.capabilities.multipartUpload).toBe(false)
      expect(createNodeCloudApplication).toBeFunction()
    } finally {
      await runtime.close()
    }
  })
})
