import { describe, expect, test } from 'bun:test'

import { fetchBundledFont, markFontLoaded, probeGlyphOutlineCommands } from '@open-pencil/core'

describe('clipboard text outline probe', () => {
  test('lazy-loads opentype.js and extracts glyph commands from a loaded font', async () => {
    const font = await fetchBundledFont('/Inter-Regular.ttf')
    expect(font).toBeTruthy()
    if (!font) return

    markFontLoaded('Inter', 'Regular', font)

    const probe = await probeGlyphOutlineCommands('Inter', 'Regular', 'Hello', 16)
    expect(probe).toBeTruthy()
    expect(probe?.family).toBe('Inter')
    expect(probe?.style).toBe('Regular')
    expect(probe?.unitsPerEm).toBeGreaterThan(0)
    expect(probe?.commandCount).toBeGreaterThan(0)
    expect(probe?.firstGlyphCommandSample.length).toBeGreaterThan(0)
  })
})
