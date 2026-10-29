import { expect, test } from 'bun:test'
import { join } from 'node:path'

import { FIXTURES } from '#core-tests/helpers/paths'

import { SceneGraph } from '@open-pencil/scene-graph'

import { exportPDFDocument } from '#core/io/formats/pdf'
import { fontManager } from '#core/text/fonts'

/** A page with a red square and a gradient, drawn without a browser DOM, as the CLI exports. */
function card() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', pageId, { name: 'Card', width: 120, height: 80 })
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
  return { graph, spec: { pageId, nodeIds: [frame.id], label: 'Card' } }
}

test('exports a PDF without a browser DOM, and leaves no DOM behind', async () => {
  const { graph, spec } = card()
  const result = await exportPDFDocument(graph, [spec], { embedFonts: false })
  expect(new TextDecoder().decode(result?.data.slice(0, 5))).toBe('%PDF-')
  expect(result?.pages).toEqual([{ label: 'Card', width: 120, height: 80 }])
  expect('document' in globalThis).toBe(false)
  expect('CSSStyleSheet' in globalThis).toBe(false)
})

test('exports several PDFs at once', async () => {
  const exports = Array.from({ length: 3 }, () => {
    const { graph, spec } = card()
    return exportPDFDocument(graph, [spec], { embedFonts: false })
  })
  const results = await Promise.all(exports)
  expect(results.map((result) => result?.pages.length)).toEqual([1, 1, 1])
  expect('document' in globalThis).toBe(false)
})

test('embeds the fallback font that draws characters the text’s own font lacks', async () => {
  const cjk = await Bun.file(join(FIXTURES, 'fonts', 'NotoSansSC-Regular.ttf')).arrayBuffer()
  await fontManager.markLoaded('PDF Test CJK', 'Regular', cjk)
  fontManager.setCJKFallbackFamily('PDF Test CJK')
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const text = graph.createNode('TEXT', pageId, {
    text: 'Hello 中文',
    fontFamily: 'Inter',
    fontSize: 32,
    textAutoResize: 'WIDTH_AND_HEIGHT'
  })
  // Offline, so the fallback is the one loaded here and not a web font.
  const providers = fontManager.enabledOnlineFontProviders()
  fontManager.setOnlineFontProviders({})
  try {
    const result = await exportPDFDocument(
      graph,
      [{ pageId, nodeIds: [text.id], label: 'Text' }],
      { embedFonts: true, layOutPages: true }
    )
    // Inter has no Chinese, which the canvas draws in a CJK fallback, the one loaded here or one
    // another test loaded first; the PDF embeds that face too.
    const embedded = result?.fonts?.embedded ?? []
    expect(embedded).toHaveLength(2)
    expect(embedded.filter((face) => !face.startsWith('Inter '))).toHaveLength(1)
    expect(result?.fonts?.fallback).toEqual([])
  } finally {
    fontManager.setOnlineFontProviders(
      Object.fromEntries(providers.map((provider) => [provider, true]))
    )
  }
})

test('embeds each file of a split web font the text draws from', async () => {
  const family = 'PDF Test Split'
  const files = {
    'https://fonts.gstatic.com/s/test/pdf-latin.ttf': {
      range: 'U+0000-00FF',
      data: await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
    },
    'https://fonts.gstatic.com/s/test/pdf-han.ttf': {
      range: 'U+4E00-9FFF',
      data: await Bun.file(join(FIXTURES, 'fonts', 'NotoSansSC-Regular.ttf')).arrayBuffer()
    }
  }
  const providers = fontManager.enabledOnlineFontProviders()
  fontManager.setOnlineFontProviders({ google: true })
  fontManager.setWebFontFetch(async (url) => {
    if (url.startsWith('https://fonts.google.com/metadata/fonts'))
      return Response.json({ familyMetadataList: [{ family, fonts: { '400': {} }, axes: [] }] })
    if (url.startsWith('https://fonts.google.com/metadata/icons'))
      return new Response(`)]}'\n${JSON.stringify({ families: [] })}`)
    if (url.startsWith('https://fonts.googleapis.com/css2'))
      return new Response(
        Object.entries(files)
          .map(
            ([src, { range }]) =>
              `@font-face { font-family: '${family}'; font-weight: 400; src: url(${src}) format('truetype'); unicode-range: ${range}; }`
          )
          .join('\n')
      )
    const file = Object.entries(files).find(([src]) => src === url)?.[1]
    return file ? new Response(file.data.slice(0)) : new Response(null, { status: 404 })
  })
  try {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const text = graph.createNode('TEXT', pageId, {
      text: 'Split 中文',
      fontFamily: family,
      fontSize: 32,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    const result = await exportPDFDocument(
      graph,
      [{ pageId, nodeIds: [text.id], label: 'Text' }],
      { embedFonts: true, layOutPages: true }
    )
    // The Chinese is in the family's second file, which the canvas draws it from. The first is
    // variable, so it is embedded as the instance the text draws.
    expect(result?.fonts?.embedded.toSorted()).toEqual([
      `${family} Regular (file 2)`,
      `${family} Regular (opsz 32, wght 400)`
    ])
  } finally {
    fontManager.setWebFontFetch(null)
    fontManager.setOnlineFontProviders(
      Object.fromEntries(providers.map((provider) => [provider, true]))
    )
  }
})

test('asks a web font for the forms jsPDF writes Arabic letters in', async () => {
  const family = 'PDF Test Arabic'
  const fontURL = 'https://fonts.gstatic.com/s/test/pdf-arabic.ttf'
  const naskh = await Bun.file(join(FIXTURES, 'fonts', 'NotoNaskhArabic-Regular.ttf')).arrayBuffer()
  const asked: string[] = []
  const providers = fontManager.enabledOnlineFontProviders()
  fontManager.setOnlineFontProviders({ google: true })
  fontManager.setWebFontFetch(async (url) => {
    if (url.startsWith('https://fonts.google.com/metadata/fonts'))
      return Response.json({ familyMetadataList: [{ family, fonts: { '400': {} }, axes: [] }] })
    if (url.startsWith('https://fonts.google.com/metadata/icons'))
      return new Response(`)]}'\n${JSON.stringify({ families: [] })}`)
    if (url.startsWith('https://fonts.googleapis.com/css2')) {
      asked.push(new URL(url).searchParams.get('text') ?? '')
      return new Response(
        `@font-face { font-family: '${family}'; font-weight: 400; src: url(${fontURL}) format('truetype'); }`
      )
    }
    return url === fontURL ? new Response(naskh.slice(0)) : new Response(null, { status: 404 })
  })
  try {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const text = graph.createNode('TEXT', pageId, {
      text: 'مرحبا',
      fontFamily: family,
      fontSize: 32,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    await exportPDFDocument(graph, [{ pageId, nodeIds: [text.id], label: 'Text' }], {
      embedFonts: true,
      layOutPages: true
    })
    // jsPDF writes مرحبا as ﻣﺮﺣﺒﺎ, so a font subset to the typed letters alone would draw nothing.
    expect(asked.some((characters) => [...'ﻣﺮﺣﺒﺎ'].every((form) => characters.includes(form)))).toBe(
      true
    )
  } finally {
    fontManager.setWebFontFetch(null)
    fontManager.setOnlineFontProviders(
      Object.fromEntries(providers.map((provider) => [provider, true]))
    )
  }
})
