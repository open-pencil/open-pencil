import { strict as assert } from 'node:assert'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import { writeNativeFile } from '#tests/helpers/tauri/invoke'

const NAME = 'openpencil-native-test-scope.txt'

describe('desktop file scope', () => {
  it('saves documents but not where a written file would run', async () => {
    const documents = mkdtempSync(join(tmpdir(), 'openpencil-scope-'))
    const refused = [
      join(homedir(), 'Library', 'LaunchAgents', NAME),
      join(homedir(), `.${NAME}`),
      join(homedir(), '.openpencil', 'mcp.json')
    ]
    try {
      assert.equal(await writeNativeFile(join(documents, 'design.fig'), 'design'), null)
      for (const path of refused) {
        const error = await writeNativeFile(path, 'not allowed')
        assert.match(error ?? '', /forbidden|not allowed/i, `${path} was writable`)
      }
    } finally {
      rmSync(documents, { recursive: true, force: true })
      // Only the test's own files; the real discovery file is never touched by a refused write.
      for (const path of refused.slice(0, 2)) if (existsSync(path)) rmSync(path)
    }
  })
})
