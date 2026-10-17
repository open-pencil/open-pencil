import { describe, expect, test } from 'bun:test'

import { deflateSync, zlibSync } from 'fflate'
import { fromUint8Array } from 'js-base64'

import { BUILTIN_IO_FORMATS, IORegistry } from '#core/io'
import { readDrawioDocument } from '#core/io/formats/drawio'
import { drawioSource, isDrawioExportFileName } from '#core/io/formats/drawio/embedded'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

const io = new IORegistry(BUILTIN_IO_FORMATS)

function cell(id: string, style: string, value = id): string {
  return `<mxCell id="${id}" value="${value}" style="${style}" vertex="1" parent="1">
    <mxGeometry x="40" y="40" width="200" height="120" as="geometry"/>
  </mxCell>`
}

function model(...cells: string[]): string {
  return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}</root></mxGraphModel>`
}

function shapeOf(source: string): { graph: SceneGraph; frame: SceneNode } {
  const graph = readDrawioDocument(source)
  if (!graph) throw new Error('not a draw.io file')
  const page = graph.getPages()[0]
  const frame = graph.getNode(page.childIds[0])
  if (!frame) throw new Error('no shape')
  return { graph, frame }
}

function layers(graph: SceneGraph, frame: SceneNode) {
  return graph.getChildren(frame.id).map((child) => ({ type: child.type, name: child.name }))
}

describe('draw.io shapes beyond rectangles', () => {
  test('a swimlane draws a filled title bar and an outlined lane, with its title in the bar', () => {
    const { graph, frame } = shapeOf(model(cell('lane', 'swimlane;startSize=30;fillColor=#dae8fc;', 'Orders')))
    expect(frame.fills).toEqual([])
    expect(layers(graph, frame)).toEqual([
      { type: 'VECTOR', name: 'Shape' },
      { type: 'VECTOR', name: 'Outline' },
      { type: 'TEXT', name: 'Orders' }
    ])
    const [bar, lane, title] = graph.getChildren(frame.id)
    expect(bar.fills[0]?.color).toMatchObject({ r: 0xda / 255, g: 0xe8 / 255, b: 0xfc / 255 })
    expect(lane.fills).toEqual([])
    expect(title.y + title.height).toBeLessThanOrEqual(30)
  })

  test('a vertical swimlane puts its title bar on the left', () => {
    const { graph, frame } = shapeOf(model(cell('lane', 'swimlane;horizontal=0;startSize=30;')))
    const title = graph.getChildren(frame.id).find((child) => child.type === 'TEXT')
    expect(title?.width).toBeLessThanOrEqual(30)
  })

  test.each([
    'shape=hexagon;',
    'shape=parallelogram;',
    'shape=trapezoid;',
    'shape=step;',
    'shape=card;',
    'shape=process;',
    'shape=document;',
    'shape=doubleEllipse;',
    'triangle;',
    'shape=triangle;direction=south;'
  ])('%s draws its own outline, not a rectangle', (style) => {
    const { graph, frame } = shapeOf(model(cell('s', style)))
    expect(frame.fills).toEqual([])
    expect(layers(graph, frame)[0]).toEqual({ type: 'VECTOR', name: 'Shape' })
  })

  test('a shape without an outline here keeps its box', () => {
    const { graph, frame } = shapeOf(model(cell('s', 'shape=mxgraph.aws4.lambda;fillColor=#ffffff;')))
    expect(frame.fills).toHaveLength(1)
    expect(layers(graph, frame).filter((layer) => layer.type === 'VECTOR')).toEqual([])
  })
})

const MXFILE = `<mxfile><diagram id="p" name="Embedded">${model(cell('a', 'rounded=1;', 'Alpha'))}</diagram></mxfile>`

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(new TextEncoder().encode(type), 4)
  out.set(data, 8)
  // The CRC is not read.
  return out
}

function png(...chunks: Uint8Array[]): Uint8Array {
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', new Uint8Array(13)),
    ...chunks,
    chunk('IEND', new Uint8Array())
  ]
  const out = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

const bytes = (...parts: (string | Uint8Array)[]) =>
  new Uint8Array(
    parts.flatMap((part) => [...(typeof part === 'string' ? new TextEncoder().encode(part) : part)])
  )

describe('draw.io diagrams embedded in PNG and SVG exports', () => {
  test('a PNG tEXt chunk', () => {
    const file = png(chunk('tEXt', bytes('mxfile', new Uint8Array([0]), encodeURIComponent(MXFILE))))
    expect(drawioSource(file)).toBe(MXFILE)
  })

  test('a compressed PNG zTXt chunk', () => {
    const packed = zlibSync(new TextEncoder().encode(encodeURIComponent(MXFILE)))
    const file = png(chunk('zTXt', bytes('mxfile', new Uint8Array([0, 0]), packed)))
    expect(drawioSource(file)).toBe(MXFILE)
  })

  test('a PNG iTXt chunk, compressed or not', () => {
    const plain = bytes('mxfile', new Uint8Array([0, 0, 0, 0, 0]), encodeURIComponent(MXFILE))
    expect(drawioSource(png(chunk('iTXt', plain)))).toBe(MXFILE)
    const packed = zlibSync(new TextEncoder().encode(encodeURIComponent(MXFILE)))
    const compressed = bytes('mxfile', new Uint8Array([0, 1, 0, 0, 0]), packed)
    expect(drawioSource(png(chunk('iTXt', compressed)))).toBe(MXFILE)
  })

  test("a PNG's other text chunks are not taken for a diagram", () => {
    expect(drawioSource(png(chunk('tEXt', bytes('Software', new Uint8Array([0]), 'x'))))).toBeNull()
  })

  test("an SVG export's content attribute", () => {
    // As draw.io writes it: escaped for an attribute, its line breaks as character references.
    const escaped = MXFILE.replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('"', '&quot;')
      .replaceAll('\n', '&#10;')
    const svg = `<?xml version="1.0"?><!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg" content="${escaped}"><rect/></svg>`
    expect(drawioSource(new TextEncoder().encode(svg))).toBe(MXFILE)
    expect(drawioSource(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
  })

  test('a damaged compressed PNG chunk is an error that says so', () => {
    const file = png(chunk('zTXt', bytes('mxfile', new Uint8Array([0, 0]), 'not zlib data')))
    expect(() => drawioSource(file)).toThrow('Could not read the draw.io diagram in this image')
  })

  test('ordinary images are not offered as draw.io documents', () => {
    expect(io.findReader('photo.png')).toBeNull()
    expect(io.findReader('logo.svg')).toBeNull()
    expect(io.findReader('flow.drawio.svg')?.id).toBe('drawio')
  })

  test('a PNG export opens through the registry as its diagram', async () => {
    const file = png(chunk('tEXt', bytes('mxfile', new Uint8Array([0]), encodeURIComponent(MXFILE))))
    expect(io.findReader('flow.drawio.png')?.id).toBe('drawio')
    const { graph } = await io.readDocument({ name: 'flow.drawio.png', data: file })
    expect(graph.getPages().map((page) => page.name)).toEqual(['Embedded'])
  })

  test('a draw.io export without a diagram says so', async () => {
    await expect(io.readDocument({ name: 'photo.drawio.png', data: png() })).rejects.toThrow(
      'This image holds no draw.io diagram'
    )
  })

  test("draw.io's names for editable exports", () => {
    expect(['flow.drawio.png', 'Flow.DRAWIO.SVG'].map(isDrawioExportFileName)).toEqual([true, true])
    expect(['flow.png', 'flow.drawio', 'drawio.png'].map(isDrawioExportFileName)).toEqual([
      false,
      false,
      false
    ])
  })
})

describe('a draw.io file with a page that cannot be read', () => {
  const bomb = fromUint8Array(deflateSync(new Uint8Array(32 * 1024 * 1024 + 1).fill(32), { level: 9 }))
  const encode = (text: string) => new TextEncoder().encode(text)

  test('is an error naming the pages, not a document with pages missing', async () => {
    const source = `<mxfile><diagram id="a" name="Fine">${model(cell('a', ''))}</diagram><diagram id="b" name="Huge">${bomb}</diagram><diagram id="c" name="Broken">not base64 at all</diagram></mxfile>`
    await expect(io.readDocument({ name: 'pages.drawio', data: encode(source) })).rejects.toThrow(
      'Could not read these draw.io pages: Huge, Broken'
    )
  }, 30_000)
})
