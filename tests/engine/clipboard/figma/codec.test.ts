import { expect, test } from 'bun:test'

import { encodeFigmaClipboard, parseFigmaClipboard } from '@open-pencil/fig/clipboard'
import { initCodec } from '@open-pencil/kiwi/fig/codec'

test('Fig clipboard codec preserves prepared node changes and binary blobs', async () => {
  await initCodec()
  const bytes = new Uint8Array([0, 1, 127, 255])
  const html = encodeFigmaClipboard(
    [
      {
        guid: { sessionID: 0, localID: 10 },
        type: 'RECTANGLE',
        name: 'Prepared rectangle',
        size: { x: 100, y: 80 }
      }
    ],
    [bytes],
    123
  )
  const parsed = await parseFigmaClipboard(html)
  expect(parsed?.meta).toEqual({ fileKey: 'openpencil', pasteID: 123, dataType: 'scene' })
  expect(parsed?.nodes[0]).toMatchObject({ name: 'Prepared rectangle', size: { x: 100, y: 80 } })
  expect(parsed?.blobs[0]).toEqual(bytes)
  expect(parsed?.blobs[0]).toBeInstanceOf(Uint8Array)
})
