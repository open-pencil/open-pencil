import { describe, expect, test } from 'bun:test'

import { unzipSync } from 'fflate'

import { createDocumentGraph } from '@open-pencil/core'
import { getPageBackgrounds } from '@open-pencil/core/figma-api'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'

describe('FigJam boards', () => {
  test('a board saves as a .jam canvas and opens as a board again', async () => {
    const graph = createDocumentGraph('board', 'light')
    const bytes = await exportFigFile(graph)
    const canvas = unzipSync(bytes)['canvas.fig']
    expect(new TextDecoder().decode(canvas?.slice(0, 8))).toBe('fig-jam.')
    const reopened = await parseFigFile(bytes.slice().buffer)
    expect(reopened.documentKind).toBe('board')
  })

  test('a design keeps the .fig header', async () => {
    const bytes = await exportFigFile(createDocumentGraph('design', 'light'))
    const canvas = unzipSync(bytes)['canvas.fig']
    expect(new TextDecoder().decode(canvas?.slice(0, 8))).toBe('fig-kiwi')
    expect((await parseFigFile(bytes.slice().buffer)).documentKind).toBe('design')
  })

  test("a new board starts on FigJam's #F5F5F5 page", () => {
    const graph = createDocumentGraph('board', 'light')
    expect(getPageBackgrounds(graph.getPages()[0])[0]?.color).toEqual({
      r: 245 / 255,
      g: 245 / 255,
      b: 245 / 255,
      a: 1
    })
  })
})
