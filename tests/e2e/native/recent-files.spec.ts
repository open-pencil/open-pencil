import { strict as assert } from 'node:assert'
import { join } from 'node:path'

import { invokeNative, invokeNativeBytes } from '#tests/helpers/tauri/invoke'

const fixture = join(process.cwd(), 'tests', 'fixtures', 'gold-preview.fig')
// A .fig file is a zip archive.
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]

describe('recent file thumbnails', () => {
  it('reads a .fig file the way the thumbnail loader does', async () => {
    const info = await invokeNative<{ size: number }>('plugin:fs|stat', { path: fixture })
    assert.ok(info.size > 0, 'stat returned no size')

    const rid = await invokeNative<number>('plugin:fs|open', {
      path: fixture,
      options: { read: true }
    })
    try {
      const handle = await invokeNative<{ size: number }>('plugin:fs|fstat', { rid })
      assert.equal(handle.size, info.size)
      await invokeNative('plugin:fs|seek', { rid, offset: 0, whence: 0 })
      // The plugin appends the byte count as a big-endian u64 after the data.
      const read = await invokeNativeBytes('plugin:fs|read', { rid, len: ZIP_SIGNATURE.length })
      assert.deepEqual(read.slice(0, -8), ZIP_SIGNATURE)
      assert.equal(read.at(-1), ZIP_SIGNATURE.length)
    } finally {
      await invokeNative('plugin:resources|close', { rid })
    }
  })
})
