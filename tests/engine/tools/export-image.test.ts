import { describe, expect, test } from 'bun:test'

import { getTool, setupToolTest } from '#tests/helpers/tools'

type ExportImageResult = {
  width?: unknown
  height?: unknown
  scale?: unknown
}

function exportImageResult(value: unknown): ExportImageResult {
  return typeof value === 'object' && value !== null ? value : {}
}

describe('export_image tool', () => {
  test('bounds model-facing image output by its longest edge without upscaling', async () => {
    const { figma } = setupToolTest()
    const frame = figma.createFrame()
    frame.resize(2560, 1600)
    const calls: Array<{ scale?: number; format?: string }> = []
    figma.exportImage = async (_ids, options) => {
      calls.push(options)
      return new Uint8Array([1, 2, 3])
    }

    const result = exportImageResult(
      await getTool('export_image').execute(figma, {
        ids: [frame.id],
        format: 'PNG',
        scale: 2,
        maxEdge: 1280
      })
    )

    expect(calls).toEqual([{ scale: 0.5, format: 'PNG' }])
    expect(result.width).toBe(1280)
    expect(result.height).toBe(800)
    expect(result.scale).toBe(0.5)
  })

  test('keeps the requested scale when the image already fits', async () => {
    const { figma } = setupToolTest()
    const frame = figma.createFrame()
    frame.resize(640, 400)
    const calls: Array<{ scale?: number; format?: string }> = []
    figma.exportImage = async (_ids, options) => {
      calls.push(options)
      return new Uint8Array([1])
    }

    await getTool('export_image').execute(figma, {
      ids: [frame.id],
      scale: 1,
      maxEdge: 1280
    })

    expect(calls[0]?.scale).toBe(1)
  })

  test('switches to the page containing the requested node before exporting', async () => {
    const { figma } = setupToolTest()
    const initialPage = figma.currentPage
    const requestedPage = figma.createPage()
    figma.currentPage = requestedPage
    const frame = figma.createFrame()
    frame.resize(375, 812)
    figma.currentPage = initialPage
    const exportedPages: string[] = []
    figma.exportImage = async () => {
      exportedPages.push(figma.currentPageId)
      return new Uint8Array([1])
    }

    const result = await getTool('export_image').execute(figma, { ids: [frame.id] })

    expect(result).not.toEqual({ error: expect.any(String) })
    expect(exportedPages).toEqual([requestedPage.id])
    expect(figma.currentPageId).toBe(requestedPage.id)
  })

  test('rejects node selections spanning multiple pages', async () => {
    const { figma } = setupToolTest()
    const first = figma.createFrame()
    const secondPage = figma.createPage()
    figma.currentPage = secondPage
    const second = figma.createFrame()
    figma.exportImage = async () => new Uint8Array([1])

    const result = await getTool('export_image').execute(figma, {
      ids: [first.id, second.id]
    })

    expect(result).toEqual({ error: 'Export selection must stay on a single page' })
  })
})
