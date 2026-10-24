import { expect, spyOn, test } from 'bun:test'

import { scriptResult } from '#core-tests/helpers/script'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

test('a script written as a Figma plugin runs to its end, past loadAllPagesAsync and closePlugin', async () => {
  const figma = new FigmaAPI(new SceneGraph())
  const notify = spyOn(figma, 'notify').mockImplementation(() => ({ cancel: () => undefined }))
  try {
    const result = await scriptResult(
      `
      await figma.loadAllPagesAsync()
      const before = figma.createRectangle()
      before.name = 'Before'
      figma.closePlugin('Done')
      const after = figma.createRectangle()
      after.name = 'After'
      return figma.currentPage.children.map((node) => node.name)
    `,
      figma
    )

    expect(result).toEqual(['Before', 'After'])
    // Figma shows closePlugin's message as it shows figma.notify's.
    expect(notify.mock.calls).toEqual([['Done']])
  } finally {
    notify.mockRestore()
  }
})
