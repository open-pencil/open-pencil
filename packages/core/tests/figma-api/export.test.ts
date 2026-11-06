import { describe, expect, test } from 'bun:test'

import { createAPI } from '#core-tests/helpers/figma-api'
import {
  createCanvasKitRasterCodec,
  headlessRenderNodes,
  initCanvasKit,
  MAX_RASTER_PIXELS
} from '#core/io/formats/raster'

// Figma's answers measured in Figma desktop 126.

function refusal(run: () => unknown): string | null {
  try {
    run()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  return null
}

/** A PNG's size, from its header. */
function pngSize(data: Uint8Array | string): [number, number] {
  if (typeof data === 'string') throw new Error('expected PNG bytes')
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  return [view.getUint32(16), view.getUint32(20)]
}

describe('exportSettings', () => {
  test('reads each export with Figma’s defaults filled in', () => {
    const figma = createAPI()
    const rect = figma.createRectangle()
    expect(rect.exportSettings).toEqual([])
    rect.exportSettings = [
      { format: 'PNG', constraint: { type: 'SCALE', value: 2 }, suffix: '@2x' },
      { format: 'SVG', svgIdAttribute: true },
      { format: 'JPG', constraint: { type: 'HEIGHT', value: 30 }, colorProfile: 'SRGB' },
      { format: 'PDF' }
    ]
    expect(rect.exportSettings).toEqual([
      {
        format: 'PNG',
        suffix: '@2x',
        contentsOnly: true,
        colorProfile: 'DOCUMENT',
        constraint: { type: 'SCALE', value: 2 }
      },
      {
        format: 'SVG',
        suffix: '',
        contentsOnly: true,
        colorProfile: 'DOCUMENT',
        svgOutlineText: true,
        svgIdAttribute: true,
        svgSimplifyStroke: true
      },
      {
        format: 'JPG',
        suffix: '',
        contentsOnly: true,
        colorProfile: 'SRGB',
        constraint: { type: 'HEIGHT', value: 30 }
      },
      { format: 'PDF', suffix: '', contentsOnly: true, colorProfile: 'DOCUMENT' }
    ])
    expect(figma.graph.getNode(rect.id)?.exportSettings[2]).toEqual({
      scale: 1,
      format: 'jpg',
      size: { type: 'HEIGHT', value: 30 },
      colorProfile: 'SRGB'
    })
  })

  test('drops keys Figma does not know, and options its format has no use for', () => {
    const figma = createAPI()
    const rect = figma.createRectangle()
    rect.exportSettings = [
      { format: 'PNG', foo: 1 },
      { format: 'PDF', constraint: { type: 'SCALE', value: 2 } }
    ] as never
    expect(rect.exportSettings).toEqual([
      {
        format: 'PNG',
        suffix: '',
        contentsOnly: true,
        colorProfile: 'DOCUMENT',
        constraint: { type: 'SCALE', value: 1 }
      },
      { format: 'PDF', suffix: '', contentsOnly: true, colorProfile: 'DOCUMENT' }
    ])
  })

  test('leaves out exports in formats Figma has no setting for', () => {
    const figma = createAPI()
    const rect = figma.createRectangle()
    figma.graph.updateNode(rect.id, {
      exportSettings: [
        { scale: 1, format: 'webp' },
        { scale: 1, format: 'png' }
      ]
    })
    expect(rect.exportSettings.map((setting) => setting.format)).toEqual(['PNG'])
  })

  test('refuses what Figma refuses, in its words', () => {
    const figma = createAPI()
    const rect = figma.createRectangle()
    const text = figma.createText()
    const set = (value: unknown) =>
      refusal(() => {
        rect.exportSettings = value as never
      })
    const invalid = 'in set_exportSettings: Property "exportSettings" failed validation: '
    expect(set([{ format: 'WEBP' }])).toBe(
      `${invalid}Expected [0].format to be one of the following: PNG, JPG, PDF, SVG, SVG_STRING`
    )
    expect(set({ format: 'PNG' })).toBe(`${invalid}Expected array, received object`)
    expect(set([null])).toBe(`${invalid}Expected object, received null at index 0`)
    expect(set([{ format: 'PNG', suffix: 1 }])).toBe(
      `${invalid}Expected string, received number at [0].suffix`
    )
    expect(set([{ format: 'PNG', colorProfile: 'P3' }])).toBe(
      `${invalid}Invalid option: expected one of "DOCUMENT"|"SRGB"|"DISPLAY_P3_V4" at [0].colorProfile`
    )
    expect(set([{ format: 'PNG', constraint: { type: 'SCALE' } }])).toBe(
      `${invalid}Expected [0].constraint to be one of the following, but none matched:\n` +
        '  Required value missing at [0].constraint.value\n' +
        '  Multiple issues at [0].constraint:\n' +
        '    Invalid option: expected one of "WIDTH"|"HEIGHT" at [0].constraint.type\n' +
        '    Required value missing at [0].constraint.value'
    )
    expect(set([{ format: 'PNG', constraint: { type: 'WIDTH', value: 2, foo: 1 } }])).toBe(
      `${invalid}Unrecognized key: "foo" at [0].constraint`
    )
    expect(set([{ format: 'SVG_STRING' }])).toBe(
      'in set_exportSettings: Invalid value "SVG_STRING" for enum "ImageType"'
    )
    expect(set([{ format: 'PNG', useAbsoluteBounds: true }])).toBe(
      'in set_exportSettings: Cannot set useAbsoluteBounds for ExportSetting on node that is not type text.'
    )
    text.exportSettings = [{ format: 'PNG', useAbsoluteBounds: true }]
    expect(text.exportSettings[0]).toMatchObject({ useAbsoluteBounds: true })
  })

  test('pages keep exports, and the document has none', () => {
    const figma = createAPI()
    figma.currentPage.exportSettings = [{ format: 'PDF' }]
    expect(figma.currentPage.exportSettings).toHaveLength(1)
    expect('exportSettings' in figma.root).toBe(false)
    expect('exportAsync' in figma.root).toBe(false)
  })
})

describe('exportAsync', () => {
  test('refuses settings Figma refuses, in its words', async () => {
    const figma = createAPI()
    const rect = figma.createRectangle()
    const invalid = 'in exportAsync: Property "settings" failed validation: '
    await expect(rect.exportAsync({ format: 'WEBP' } as never)).rejects.toThrow(
      `${invalid}Expected .format to be one of the following: PNG, JPG, PDF, SVG, SVG_STRING, JSON_REST_V1, MP4, GIF, WEBM`
    )
    await expect(rect.exportAsync(null as never)).rejects.toThrow(
      `${invalid}Expected object, received null`
    )
    await expect(rect.exportAsync({ format: 'JSON_REST_V1', foo: 1 } as never)).rejects.toThrow(
      `${invalid}Unrecognized key: "foo"`
    )
    await expect(rect.exportAsync({ format: 'GIF' })).rejects.toThrow('Cannot export node as video')
    const gone = figma.createRectangle()
    gone.remove()
    await expect(gone.exportAsync({ format: 'SVG' })).rejects.toThrow(
      `in exportAsync: The node with id "${gone.id}" does not exist`
    )
  })

  test('writes SVG as bytes or a string, with layer names as ids on request', async () => {
    const figma = createAPI()
    const frame = figma.createFrame()
    frame.name = 'Card'
    frame.resize(60, 40)
    for (const x of [0, 20]) {
      const box = figma.createRectangle()
      box.name = 'Box'
      box.resize(10, 10)
      box.x = x
      frame.appendChild(box)
    }
    const bytes = await frame.exportAsync({ format: 'SVG' })
    expect(bytes).toBeInstanceOf(Uint8Array)
    const svg = await frame.exportAsync({ format: 'SVG_STRING', svgIdAttribute: true })
    expect(svg.startsWith('<svg')).toBe(true)
    // Layers' ids, not those of the clip paths and gradients they use.
    const layerIds = [...svg.matchAll(/<(?:g|rect|path) id="([^"]+)"/g)].map((match) => match[1])
    expect(layerIds).toEqual(['Card', 'Box', 'Box_2'])
    expect(await frame.exportAsync({ format: 'SVG_STRING' })).not.toContain(' id="Box"')
  })

  test('writes a PDF', async () => {
    const figma = createAPI()
    const pdf = await figma.createRectangle().exportAsync({ format: 'PDF' })
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-')
  })

  test('sizes images by scale, width, or height, around what the layer draws', async () => {
    const figma = createAPI()
    figma.exportImage = (ids, options) =>
      headlessRenderNodes(figma.graph, options.pageId ?? figma.currentPageId, ids, options)
    const rect = figma.createRectangle()
    rect.resize(20, 10)
    rect.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
    rect.strokeWeight = 2
    rect.strokeAlign = 'OUTSIDE'
    expect(pngSize(await rect.exportAsync())).toEqual([24, 14])
    expect(pngSize(await rect.exportAsync({ format: 'PNG', useAbsoluteBounds: true }))).toEqual([
      20, 10
    ])
    const scaled = { format: 'PNG', constraint: { type: 'SCALE', value: 0.5 } } as const
    expect(pngSize(await rect.exportAsync(scaled))).toEqual([12, 7])
    const wide = { format: 'PNG', constraint: { type: 'WIDTH', value: 48 } } as const
    expect(pngSize(await rect.exportAsync(wide))).toEqual([48, 28])
    const tall = { format: 'PNG', constraint: { type: 'HEIGHT', value: 7 } } as const
    expect(pngSize(await rect.exportAsync(tall))).toEqual([12, 7])
    // Figma reads a scale of 0 as none.
    const unscaled = { format: 'PNG', constraint: { type: 'SCALE', value: 0 } } as const
    expect(pngSize(await rect.exportAsync(unscaled))).toEqual([24, 14])
    const jpg = await rect.exportAsync({ format: 'JPG' })
    expect([jpg[0], jpg[1]]).toEqual([0xff, 0xd8])
  })

  test('exports a layer that draws nothing as one blank pixel, and refuses it as a vector', async () => {
    const figma = createAPI()
    const codec = createCanvasKitRasterCodec(await initCanvasKit())
    figma.rasterCodec = codec
    figma.exportImage = (ids, options) =>
      headlessRenderNodes(figma.graph, options.pageId ?? figma.currentPageId, ids, options)
    const rect = figma.createRectangle()
    rect.fills = []
    const scaled = { format: 'PNG', constraint: { type: 'SCALE', value: 3 } } as const
    for (const settings of [{ format: 'PNG' }, scaled] as const) {
      const png = codec.decode(await rect.exportAsync(settings))
      expect(png).toEqual({ width: 1, height: 1, data: new Uint8Array([0, 0, 0, 0]) })
    }
    const jpg = codec.decode(await rect.exportAsync({ format: 'JPG' }))
    expect(jpg).toEqual({ width: 1, height: 1, data: new Uint8Array([0, 0, 0, 255]) })
    const refused = 'Failed to export node. This node may not have any visible layers.'
    await expect(rect.exportAsync({ format: 'SVG' })).rejects.toThrow(refused)
    await expect(rect.exportAsync({ format: 'SVG_STRING' })).rejects.toThrow(refused)
    await expect(rect.exportAsync({ format: 'PDF' })).rejects.toThrow(refused)
  })

  test('lays out a script’s pending edits before exporting', async () => {
    const figma = createAPI()
    const frame = figma.createFrame()
    frame.layoutMode = 'HORIZONTAL'
    frame.primaryAxisSizingMode = 'AUTO'
    frame.counterAxisSizingMode = 'AUTO'
    for (let index = 0; index < 3; index += 1) {
      const box = figma.createRectangle()
      box.resize(10, 10)
      frame.appendChild(box)
    }
    const svg = await frame.exportAsync({ format: 'SVG_STRING' })
    expect(svg).toContain('width="30"')
  })

  test('keeps every SVG id unique', async () => {
    const figma = createAPI()
    const frame = figma.createFrame()
    frame.name = 'clip0'
    frame.resize(60, 40)
    frame.clipsContent = true
    for (const name of ['Box', 'Box_2', 'Box']) {
      const box = figma.createRectangle()
      box.name = name
      box.resize(10, 10)
      frame.appendChild(box)
    }
    const unnamed = figma.createRectangle()
    unnamed.name = ''
    frame.appendChild(unnamed)
    const svg = await frame.exportAsync({ format: 'SVG_STRING', svgIdAttribute: true })
    expect(svg).not.toContain('id=""')
    const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((match) => match[1])
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(['clip0', 'Box', 'Box_2', 'Box_3']))
  })

  test('sizes an SVG to the layer’s box with useAbsoluteBounds', async () => {
    const figma = createAPI()
    const rect = figma.createRectangle()
    rect.resize(20, 10)
    rect.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
    rect.strokeWeight = 2
    rect.strokeAlign = 'OUTSIDE'
    expect(await rect.exportAsync({ format: 'SVG_STRING' })).toContain('width="24"')
    const boxed = await rect.exportAsync({ format: 'SVG_STRING', useAbsoluteBounds: true })
    expect(boxed).toContain('width="20"')
  })

  test('refuses an image size past the export scale limits rather than shrinking it', async () => {
    const figma = createAPI()
    figma.exportImage = () => Promise.resolve(new Uint8Array([1]))
    const rect = figma.createRectangle()
    rect.resize(1, 1)
    const limit = "in exportAsync: An image must be exported at 0.01 to 1024 times the layer's size"
    await expect(
      rect.exportAsync({ format: 'PNG', constraint: { type: 'WIDTH', value: 2000 } })
    ).rejects.toThrow(limit)
    await expect(
      rect.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: -1 } })
    ).rejects.toThrow(limit)
  })

  test('refuses an image too big for the renderer before drawing it', async () => {
    const figma = createAPI()
    let drawn = 0
    figma.exportImage = () => {
      drawn++
      return Promise.resolve(new Uint8Array([1]))
    }
    const rect = figma.createRectangle()
    rect.resize(10, 10)
    await expect(
      rect.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1024 } })
    ).rejects.toThrow(
      `in exportAsync: An image can hold at most ${MAX_RASTER_PIXELS} pixels; this one would be 10240 by 10240`
    )
    expect(drawn).toBe(0)
    // The renderer refuses it as well, for callers that skip exportAsync.
    await expect(
      headlessRenderNodes(figma.graph, figma.currentPageId, [rect.id], {
        scale: 1024,
        format: 'PNG'
      })
    ).rejects.toThrow(`at most ${MAX_RASTER_PIXELS} pixels`)
  })

  test('says so when the host has no renderer for images', async () => {
    const figma = createAPI()
    await expect(figma.createRectangle().exportAsync()).rejects.toThrow(
      'in exportAsync: This host has no renderer to export PNG or JPG images with'
    )
  })
})
