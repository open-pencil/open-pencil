import { strict as assert } from 'node:assert'

import { invokeNative } from '#tests/helpers/tauri/invoke'

interface AgentLookup {
  executables: Record<string, string | null>
  versions: Record<string, string | null>
  searchPath: string
}

describe('native agent discovery', () => {
  it('answers agent discovery through the desktop shell', async () => {
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(window.openPencil?.getStore?.())),
      { timeout: 30_000, timeoutMsg: 'OpenPencil editor did not initialize' }
    )
    const lookup = await invokeNative<AgentLookup>('agent_lookup')
    assert.ok(Object.keys(lookup.executables).length > 0)
    for (const path of Object.values(lookup.executables)) {
      assert.ok(path === null || path.length > 0)
    }
    for (const version of Object.values(lookup.versions)) {
      assert.ok(version === null || /^\d+\.\d+\.\d+/.test(version))
    }
    assert.ok(lookup.searchPath.length > 0)
  })
})
