import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parseFigBuffer } from '@open-pencil/fig'
import type { FigPageManifestEntry } from '@open-pencil/kiwi/fig'

const fixturePath = resolve(import.meta.dir, '../../../fixtures/gold-preview.fig')

test('reports FIG pages before materializing NodeChange objects', () => {
  const bytes = readFileSync(fixturePath)
  let callbackCount = 0
  let manifest: FigPageManifestEntry[] = []

  const parsed = parseFigBuffer(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    (pages) => {
      callbackCount++
      manifest = pages
    }
  )

  expect(callbackCount).toBe(1)
  expect(parsed.nodeChanges.length).toBeGreaterThan(0)
  expect(manifest).toEqual([
    {
      sourceId: '0:1',
      name: 'Page 1',
      position: '!',
      internalOnly: false
    },
    {
      sourceId: '0:2',
      name: 'Internal Only Canvas',
      position: '~',
      internalOnly: true
    }
  ])
})
