import { expect, test } from 'bun:test'
import { join } from 'node:path'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { getTextMeasurer } from '@open-pencil/core/layout'
import { fontManager } from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'
import { FIXTURES } from '@open-pencil/test-support/paths'

import { editDocument, measureTextHeadlessly } from '#cli/headless'

test('sizes the text an edit writes in the fonts its characters load after it', async () => {
  // A family nothing loaded yet, as a script's new characters need a web font fetched again.
  const family = 'Edit Test Han'
  const font = await Bun.file(join(FIXTURES, 'fonts', 'NotoSansSC-Regular.ttf')).arrayBuffer()
  fontManager.setHostFontLoader(async (name) => (name === family ? font : null))
  try {
    await measureTextHeadlessly()
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const id = await editDocument(
      graph,
      () =>
        graph.createNode('TEXT', pageId, {
          text: '中文字',
          fontFamily: family,
          fontSize: 40,
          textAutoResize: 'WIDTH_AND_HEIGHT'
        }).id
    )
    const node = graph.getNode(id)
    if (!node) throw new Error('Expected the text')
    const measured = getTextMeasurer()?.(node)
    if (!measured) throw new Error('Expected the text measured in its font')
    // Each Han character is one em wide in the font, so three at 40 px are 120 px; a stand-in
    // measures them otherwise.
    expect(node.width).toBe(120)
    expect(node.width).toBe(measured.width)
    expect(node.height).toBe(measured.height)
  } finally {
    fontManager.setHostFontLoader(null)
  }
})

test('warns when an edit re-measures text narrower in a fallback font', async () => {
  // No web font provider is on, so no fallback pack can load for the missing font's
  // characters: the text is measured in the substitute, as the issue's headless edit does.
  const providersBefore = fontManager.enabledOnlineFontProviders()
  fontManager.setOnlineFontProviders({})
  try {
    const renderer = await measureTextHeadlessly()
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const id = graph.createNode('TEXT', pageId, {
      text: '评级',
      fontFamily: 'PingFang SC',
      fontSize: 15,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    }).id
    // As saved in the .fig: measured in PingFang SC, two characters at 15 px are 30 px wide.
    graph.updateNode(id, { width: 30, height: 15 })
    const node = graph.getNode(id)
    if (!node) throw new Error('Expected the text')
    const errors: string[] = []
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(' '))
    }
    try {
      // The first edit kicks off the fallback demand; the text keeps its size while it
      // is pending, as the issue's step 3 does.
      await editDocument(graph, () => {
        graph.updateNode(id, { text: '评级' })
      })
      expect(graph.getNode(id)?.width).toBe(30)
      const start = Date.now()
      while (renderer.nodeFontReadiness(node) === 'pending' && Date.now() - start < 10000) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 100)
        })
      }
      expect(renderer.nodeFontReadiness(node)).toBe('substituted')
      // The next edit measures in the substitute, as the issue's step 4 does.
      await editDocument(graph, () => {
        graph.updateNode(id, { text: '评级' })
      })
    } finally {
      console.error = originalError
    }
    // The substitute has no Han glyphs, so each character measures as a narrow box.
    expect(graph.getNode(id)?.width).toBe(20)
    const warnings = errors.filter((line) => line.includes('Font substitution'))
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('PingFang SC')
    expect(warnings[0]).toContain('30')
    expect(warnings[0]).toContain('20')
  } finally {
    fontManager.setOnlineFontProviders(
      Object.fromEntries(providersBefore.map((provider) => [provider, true]))
    )
  }
}, 30000)

test('brings instances in line with the components an edit changes, without a read', async () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const component = figma.createComponent()
  const shape = figma.createRectangle()
  component.appendChild(shape)
  const instance = component.createInstance()
  const copyId = graph.getNode(instance.id)?.childIds[0] ?? ''
  const green = { r: 0, g: 1, b: 0, a: 1 }

  await editDocument(graph, () => {
    shape.fills = [{ type: 'SOLID', color: { r: 0, g: 1, b: 0 } }]
  })

  expect(graph.getNode(copyId)?.fills[0].color).toEqual(green)
})
