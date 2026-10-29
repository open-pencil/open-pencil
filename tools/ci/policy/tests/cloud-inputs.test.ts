import { expect, test } from 'bun:test'

import { cloudInputs } from '#ci/cloud-inputs'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

test('Cloud inputs follow its workspace dependencies and shared test setup', async () => {
  const inputs = await cloudInputs(await resolveWorkspaceRoot(import.meta.dir))
  expect(inputs).toContain('packages/cloud/')
  // `@open-pencil/cloud` depends on `@open-pencil/scene-graph` for random identifiers.
  expect(inputs).toContain('packages/scene-graph/')
  expect(inputs).toContain('bun.lock')
  expect(inputs).toContain('tests/helpers/mcp/discovery-isolation.ts')
  expect(inputs).not.toContain('packages/core/')
  expect(inputs).not.toContain('src/')
})
