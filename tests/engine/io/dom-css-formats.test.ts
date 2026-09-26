import { describe, expect, test } from 'bun:test'

import { toUint8Array } from 'js-base64'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { SceneGraph } from '@open-pencil/scene-graph'

const io = new IORegistry(BUILTIN_IO_FORMATS)

function cardGraph() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const card = graph.createNode('FRAME', page.id, {
    name: 'Card',
    width: 120,
    height: 80,
    layoutMode: 'VERTICAL'
  })
  graph.createNode('TEXT', card.id, { name: 'Title', text: 'Hello', width: 100, height: 20 })
  // A 1×1 PNG, exported as an external image file.
  const png = toUint8Array(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  )
  graph.images.set('pixel', png)
  graph.createNode('RECTANGLE', card.id, {
    name: 'Photo',
    width: 40,
    height: 40,
    fills: [
      { type: 'IMAGE', imageHash: 'pixel', imageScaleMode: 'FILL', opacity: 1, visible: true }
    ]
  })
  return { graph, page, card }
}

describe('HTML export format', () => {
  test('exports a node with its own box', async () => {
    const { graph, card } = cardGraph()
    const result = await io.exportContent('html', {
      graph,
      target: { scope: 'node', nodeId: card.id }
    })

    expect(result).toMatchObject({ format: 'html', extension: 'html', mimeType: 'text/html' })
    expect(String(result.data)).toContain('width: 120px')
    expect(String(result.data)).toContain('Hello')
  })

  test('writes external assets next to the file it was named after', async () => {
    const { graph, page } = cardGraph()
    const result = await io.exportContent(
      'html',
      { graph, target: { scope: 'page', pageId: page.id }, fileName: 'out/card.html' },
      { html: 'standalone', assets: 'external' }
    )

    const paths = (result.assets ?? []).map((asset) => asset.path)
    expect(paths.length).toBeGreaterThan(0)
    for (const path of paths) expect(path).toStartWith('card.assets/')
    for (const path of paths) expect(String(result.data)).toContain(path)
  })
})

describe('HTML export asset paths', () => {
  test('are relative for Windows paths too', async () => {
    const { graph, page } = cardGraph()
    const result = await io.exportContent(
      'html',
      { graph, target: { scope: 'page', pageId: page.id }, fileName: 'C:\\out\\card.html' },
      { html: 'standalone', assets: 'external' }
    )

    const paths = (result.assets ?? []).map((asset) => asset.path)
    expect(paths.length).toBeGreaterThan(0)
    for (const path of paths) expect(path).toStartWith('card.assets/')
  })
})

describe('Tailwind JSX export format', () => {
  test('is a registered export next to OpenPencil JSX', async () => {
    const { graph, card } = cardGraph()
    const result = await io.exportContent('tailwind-jsx', {
      graph,
      target: { scope: 'selection', nodeIds: [card.id] }
    })

    expect(result).toMatchObject({ format: 'tailwind-jsx', extension: 'jsx' })
    expect(String(result.data)).toStartWith('<div data-name="Card" className="flex flex-col')
    expect(io.listExportFormats('page').map((format) => format.id)).toContain('tailwind-jsx')
  })
})
