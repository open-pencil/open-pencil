import { beforeAll, expect, test } from 'bun:test'
import { join } from 'node:path'

import { unzlibSync } from 'fflate'

import {
  SceneGraph,
  type BlendMode,
  type Effect,
  type Fill,
  type SceneNode
} from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { FIXTURES } from '@open-pencil/test-support/paths'

import { SkiaRenderer } from '#core/canvas'
import { getCanvasKit } from '#core/canvaskit'
import { exportPDFDocument } from '#core/io/formats/pdf'
import { fontManager } from '#core/text/font/manager'

const ARABIC_FAMILY = 'PDF Test Arabic'

beforeAll(async () => {
  const inter = expectDefined(await fontManager.fetchBundledFont('/InterVariable.ttf'), 'Inter')
  await fontManager.markLoaded('Inter', 'Regular', inter)
  await fontManager.markLoaded('Inter', 'Bold', inter)
  const naskh = await Bun.file(join(FIXTURES, 'fonts', 'NotoNaskhArabic-Regular.ttf')).arrayBuffer()
  await fontManager.markLoaded(ARABIC_FAMILY, 'Regular', naskh)
})

/** A frame with a red square and a gradient circle. */
function card(graph: SceneGraph, name: string): SceneNode {
  const pageId = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', pageId, { name, width: 120, height: 80 })
  graph.createNode('RECTANGLE', frame.id, {
    width: 40,
    height: 40,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
  })
  graph.createNode('ELLIPSE', frame.id, {
    x: 60,
    width: 40,
    height: 40,
    fills: [
      {
        type: 'GRADIENT_LINEAR',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        gradientStops: [
          { position: 0, color: { r: 0, g: 0, b: 1, a: 1 } },
          { position: 1, color: { r: 0, g: 1, b: 0, a: 1 } }
        ],
        gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      }
    ]
  })
  return frame
}

async function exportText(props: Partial<SceneNode>): Promise<string> {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const text = graph.createNode('TEXT', pageId, {
    fontSize: 32,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    ...props
  })
  const result = await exportPDFDocument(graph, [{ pageId, nodeIds: [text.id] }])
  return pdfObjects(expectDefined(result, 'PDF').data)
}

/** The PDF's objects as text, with its compressed streams inflated, one byte per character. */
function pdfObjects(data: Uint8Array): string {
  const raw = new TextDecoder('latin1').decode(data)
  const parts = [raw]
  for (const match of raw.matchAll(/(?<!end)stream\r?\n/g)) {
    // Only streams their object's dictionary declares Flate-compressed.
    const dictionary = raw.slice(raw.lastIndexOf(' obj', match.index), match.index)
    if (!dictionary.includes('/FlateDecode')) continue
    const start = match.index + match[0].length
    const end = raw.indexOf('endstream', start)
    parts.push(new TextDecoder('latin1').decode(unzlibSync(data.subarray(start, end))))
  }
  return parts.join('\n')
}

/** Every character the PDF maps its glyphs to: ToUnicode maps and ActualText spans. */
function mappedCharacters(objects: string): Set<string> {
  const characters = new Set<string>()
  const add = (hex: string) => {
    for (let i = 0; i + 4 <= hex.length; i += 4) {
      characters.add(String.fromCharCode(Number.parseInt(hex.slice(i, i + 4), 16)))
    }
  }
  for (const [, block] of objects.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const [, , to] of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) add(to)
  }
  for (const [, block] of objects.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const [, from, to, first] of block.matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g
    )) {
      const count = Number.parseInt(to, 16) - Number.parseInt(from, 16)
      const start = Number.parseInt(first, 16)
      for (let i = 0; i <= count; i++) characters.add(String.fromCharCode(start + i))
    }
  }
  for (const [, hex] of objects.matchAll(/\/ActualText\s*<FEFF([0-9A-Fa-f]*)>/g)) add(hex)
  return characters
}

test('draws a page the size of what its layers draw, as PNG export sizes it', async () => {
  const graph = new SceneGraph()
  const frame = card(graph, 'Card')
  const result = expectDefined(
    await exportPDFDocument(graph, [
      { pageId: graph.getPages()[0].id, nodeIds: [frame.id], label: 'Card' }
    ])
  )
  expect(new TextDecoder().decode(result.data.slice(0, 5))).toBe('%PDF-')
  expect(result.pages).toEqual([{ label: 'Card', width: 120, height: 80 }])
})

test('writes a page for each spec with something to draw', async () => {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const first = card(graph, 'First')
  const second = card(graph, 'Second')
  const hidden = card(graph, 'Hidden')
  graph.updateNode(hidden.id, { visible: false })
  const result = expectDefined(
    await exportPDFDocument(graph, [
      { pageId, nodeIds: [first.id], label: 'First' },
      { pageId, nodeIds: [hidden.id], label: 'Hidden' },
      { pageId, nodeIds: [second.id], label: 'Second' }
    ])
  )
  expect(result.pages.map((page) => page.label)).toEqual(['First', 'Second'])
  expect(pdfObjects(result.data)).toContain('/Count 2')
})

test('is null when no page has anything to draw', async () => {
  const graph = new SceneGraph()
  const hidden = card(graph, 'Hidden')
  graph.updateNode(hidden.id, { visible: false })
  expect(
    await exportPDFDocument(graph, [{ pageId: graph.getPages()[0].id, nodeIds: [hidden.id] }])
  ).toBeNull()
})

test('embeds a variable font as the TrueType instance the text draws, and keeps its text', async () => {
  const objects = await exportText({ text: 'Hello', fontFamily: 'Inter', fontWeight: 700 })
  expect(objects).toContain('/FontFile2')
  expect(objects).not.toContain('/Type3')
  for (const character of 'Helo') expect(mappedCharacters(objects)).toContain(character)
})

test('keeps Arabic as the letters it draws, joining forms included', async () => {
  // The canvas draws each letter in the form its neighbours give it, glyphs no cmap maps back.
  const objects = await exportText({ text: 'مرحبا بكم', fontFamily: ARABIC_FAMILY })
  expect(objects).toContain('/FontFile2')
  const mapped = mappedCharacters(objects)
  for (const letter of 'مرحبابكم') expect(mapped).toContain(letter)
})

function grey(value: number, blendMode: BlendMode = 'NORMAL'): Fill {
  return {
    type: 'SOLID',
    color: { r: value, g: value, b: value, a: 1 },
    opacity: 1,
    visible: true,
    blendMode
  }
}

const SHADOW: Effect = {
  type: 'DROP_SHADOW',
  color: { r: 0, g: 0, b: 0, a: 0.5 },
  offset: { x: 2, y: 2 },
  radius: 0,
  spread: 0,
  visible: true,
  blendMode: 'NORMAL',
  showShadowBehindNode: false
}

function blendedSquare(layer: BlendMode, fill: BlendMode, effects: Effect[] = []) {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', pageId, { width: 40, height: 40, fills: [grey(0.5)] })
  graph.createNode('RECTANGLE', frame.id, {
    width: 20,
    height: 20,
    fills: [grey(0.1, fill)],
    blendMode: layer,
    effects
  })
  return { graph, specs: [{ pageId, nodeIds: [frame.id] }] }
}

async function exportBlendedSquare(layer: BlendMode, fill: BlendMode): Promise<string> {
  const { graph, specs } = blendedSquare(layer, fill)
  return pdfObjects(expectDefined(await exportPDFDocument(graph, specs), 'PDF').data)
}

test('writes a soft light layer and a soft light fill as PDF soft light', async () => {
  expect(await exportBlendedSquare('SOFT_LIGHT', 'NORMAL')).toMatch(/\/BM\s*\/SoftLight/)
  expect(await exportBlendedSquare('PASS_THROUGH', 'SOFT_LIGHT')).toMatch(/\/BM\s*\/SoftLight/)
})

test('writes soft light into the PDF even after the canvas recorded the layer in a picture', async () => {
  const { graph, specs } = blendedSquare('PASS_THROUGH', 'SOFT_LIGHT', [SHADOW])
  const ck = await getCanvasKit()
  const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(40, 40), 'surface'))
  try {
    await renderer.prepareForExport(graph, specs[0].pageId, specs[0].nodeIds)
    renderer.renderSceneToCanvas(renderer.surface.getCanvas(), graph, specs[0].pageId)
    expect(renderer.nodePictures.size).toBeGreaterThan(0)
    const result = await exportPDFDocument(graph, specs, { renderer })
    expect(pdfObjects(expectDefined(result, 'PDF').data)).toMatch(/\/BM\s*\/SoftLight/)
    expect(renderer.builtInBlendModesOnly).toBe(false)
  } finally {
    renderer.destroy()
  }
})
