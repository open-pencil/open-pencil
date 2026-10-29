import { describe, expect, test } from 'bun:test'

import { fontManager, probeGlyphOutlineCommands } from '@open-pencil/core/text'

describe('clipboard text outline probe', () => {
  test('loads HarfBuzz and extracts glyph commands from a loaded font', async () => {
    const font = await fontManager.fetchBundledFont('/InterVariable.ttf')
    expect(font).toBeTruthy()
    if (!font) return

    await fontManager.markLoaded('Inter', 'Regular', font)

    const probe = await probeGlyphOutlineCommands('Inter', 'Regular', 'Hello', 16)
    expect(probe).toBeTruthy()
    expect(probe?.family).toBe('Inter')
    expect(probe?.style).toBe('Regular')
    expect(probe?.unitsPerEm).toBeGreaterThan(0)
    expect(probe?.commandCount).toBeGreaterThan(0)
    expect(probe?.firstGlyphCommandSample.length).toBeGreaterThan(0)
  })
})
