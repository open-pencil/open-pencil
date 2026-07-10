import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseFigFile } from '@open-pencil/core/io/formats/fig'

const fedexPath = join('/Users/rcoenen/Downloads/FedEx.fig')

describe('vector fillGeometry style overrides', () => {
  test('FedEx wordmark keeps purple + orange path fills', async () => {
    let bytes: Uint8Array
    try {
      bytes = new Uint8Array(readFileSync(fedexPath))
    } catch {
      // Local fixture only — skip if the download is not present in CI.
      return
    }

    const graph = await parseFigFile(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    )
    const wordmark = [...graph.getAllNodes()].find(
      (n) => n.type === 'VECTOR' && n.fillGeometry.length >= 3
    )
    expect(wordmark).toBeDefined()

    const orange = wordmark!.fillGeometry.filter((g) => g.styleID === 1)
    const purple = wordmark!.fillGeometry.filter((g) => g.fills == null || g.styleID == null)

    expect(orange.length).toBeGreaterThanOrEqual(1)
    expect(purple.length).toBeGreaterThanOrEqual(1)

    const orangeColor = orange[0]?.fills?.[0]?.color
    expect(orangeColor).toBeDefined()
    expect(orangeColor!.r).toBeCloseTo(1, 2)
    expect(orangeColor!.g).toBeGreaterThan(0.2)
    expect(orangeColor!.g).toBeLessThan(0.5)
    expect(orangeColor!.b).toBeCloseTo(0, 2)

    const purpleColor = wordmark!.fills[0]?.color
    expect(purpleColor).toBeDefined()
    expect(purpleColor!.r).toBeGreaterThan(0.1)
    expect(purpleColor!.r).toBeLessThan(0.3)
    expect(purpleColor!.b).toBeGreaterThan(0.3)
  })
})
