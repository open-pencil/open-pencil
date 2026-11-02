import { expect, spyOn, test } from 'bun:test'

import { scriptResult } from '#core-tests/helpers/script'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

// Figma refuses every API call after closePlugin, so Figma's docs end a plugin with
// `figma.closePlugin(); return`. A script here is one call with nothing to close, and code after
// closePlugin still runs, so this follows the documented shape instead.
test('a script written as a Figma plugin keeps its edits through loadAllPagesAsync and closePlugin', async () => {
  const figma = new FigmaAPI(new SceneGraph())
  const notify = spyOn(figma, 'notify').mockImplementation(() => ({ cancel: () => undefined }))
  try {
    const result = await scriptResult(
      `
      async function main() {
        await figma.loadAllPagesAsync()
        const rect = figma.createRectangle()
        rect.name = 'Card'
        figma.closePlugin('Done')
        return
      }
      await main()
      return figma.currentPage.children.map((node) => node.name)
    `,
      figma
    )

    expect(result).toEqual(['Card'])
    // Figma shows closePlugin's message as it shows figma.notify's.
    expect(notify.mock.calls).toEqual([['Done']])
  } finally {
    notify.mockRestore()
  }
})
