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

  it('reaches only the files it was given', async () => {
    const documents = mkdtempSync(join(tmpdir(), 'openpencil-scope-'))
    const given = join(documents, 'given.fig')
    try {
      const ungiven = await writeNativeFile(join(documents, 'other.fig'), 'design')
      assert.match(ungiven ?? '', /forbidden|not allowed/i, 'a file nobody gave was writable')
      await invokeNative('native_test_allow_file', { path: given })
      assert.equal(await writeNativeFile(given, 'design'), null)
      // A save writes a copy beside the file it was given, which the desktop app names.
      const partial = await invokeNative<string>('allow_save_partial', { path: given })
      assert.ok(partial.startsWith(`${given}.`) && partial.endsWith('.saving'), partial)
      assert.equal(await writeNativeFile(partial, 'design'), null)
      const refusedPartial = await invokeNative('allow_save_partial', {
        path: join(documents, 'other.fig')
      }).then(() => null, String)
      assert.match(refusedPartial ?? '', /forbidden/i, 'a save beside a file nobody gave')
    } finally {
      rmSync(documents, { recursive: true, force: true })
    }
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
      await invokeNative('native_test_allow_file', { path: join(documents, 'design.fig') })
      assert.equal(await writeNativeFile(join(documents, 'design.fig'), 'design'), null)
      for (const path of refused) {
        // Given or not, a place where a written file would run stays refused; a hidden file
        // nobody gave stays out of reach as any other.
        if (!path.includes(`.${NAME}`)) await invokeNative('native_test_allow_file', { path })
        const error = await writeNativeFile(path, 'not allowed')
        assert.match(error ?? '', /forbidden|not allowed/i, `${path} was writable`)
        // A save moves its finished copy over the file, so moving one there is refused too.
        const moved = await invokeNative('plugin:fs|rename', {
          oldPath: join(documents, 'design.fig'),
          newPath: path
        }).then(() => null, String)
        assert.match(moved ?? '', /forbidden|not allowed/i, `${path} took a moved file`)
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
