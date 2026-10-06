import { strict as assert } from 'node:assert'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import { invokeNative, writeNativeFile } from '#tests/helpers/tauri/invoke'

const NAME = 'openpencil-native-test-scope.txt'
const DISCOVERY = join(homedir(), 'Library', 'Application Support', 'OpenPencil', 'mcp.json')

describe('desktop file scope', () => {
  // The protected paths below are macOS ones; other platforms are not claimed.
  before(function () {
    if (process.platform !== 'darwin') this.skip()
  })

  it('saves documents but not where a written file would run', async () => {
    const documents = mkdtempSync(join(tmpdir(), 'openpencil-scope-'))
    const refused = [
      join(homedir(), 'Library', 'LaunchAgents', NAME),
      join(homedir(), `.${NAME}`),
      join(homedir(), '.openpencil', 'mcp.json')
    ]
    // Only files this test would have created are removed afterwards.
    const created = refused.filter((path) => !existsSync(path))
    try {
      assert.equal(await writeNativeFile(join(documents, 'design.fig'), 'design'), null)
      for (const path of refused) {
        const error = await writeNativeFile(path, 'not allowed')
        assert.match(error ?? '', /forbidden|not allowed/i, `${path} was writable`)
      }
    } finally {
      rmSync(documents, { recursive: true, force: true })
      for (const path of created) if (existsSync(path)) rmSync(path)
    }
  })

  it('refuses to open the MCP discovery file for writing', async () => {
    // The scope is checked before the file is opened, so a refusal does not depend on the file
    // existing; opening without truncating changes nothing even if the scope let it through.
    const opened = await invokeNative<number>('plugin:fs|open', {
      path: DISCOVERY,
      options: { write: true }
    }).then((rid) => rid, String)
    if (typeof opened === 'number') await invokeNative('plugin:resources|close', { rid: opened })
    assert.match(String(opened), /forbidden|not allowed/i, `${DISCOVERY} opened for writing`)
  })
})
