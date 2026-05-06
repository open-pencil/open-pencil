import { describe, expect, test } from 'bun:test'

import { computeAllLayouts, SceneGraph, setTextMeasurer } from '@open-pencil/core'

import { createEditorStore } from '@/app/editor/session'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { autoFrame, loadFixtureGraph, pageId, rect } from '#tests/helpers/layout'

describe('text measurement', () => {
  test('opening imported fig keeps stored text bounds before CanvasKit measurement', async () => {
    const graph = await loadFixtureGraph('gold-preview.fig')
    const store = createEditorStore(graph)
    const title = [...store.graph.getAllNodes()].find(
      (node) => node.type === 'TEXT' && node.text === "World's largest"
    )
    const subtitle = [...store.graph.getAllNodes()].find(
      (node) =>
        node.type === 'TEXT' && node.text === 'Preline UI Figma - crafted with Tailwind CSS styles'
    )
    const description = [...store.graph.getAllNodes()].find(
      (node) =>
        node.type === 'TEXT' &&
        node.text.startsWith('Preline UI Figma is the largest free design system for Figma')
    )

    if (!title || !subtitle || !description) {
      throw new Error('Expected imported text nodes in gold-preview.fig')
    }

    expect(title.width).toBe(444)
    expect(title.height).toBe(73)
    expect(subtitle.width).toBe(439)
    expect(subtitle.height).toBe(22)
    expect(description.width).toBe(878)
    expect(description.height).toBe(60)

    await store.switchPage(store.graph.getPages()[0].id)

    expect(store.graph.getNode(title.id)?.width).toBe(444)
    expect(store.graph.getNode(title.id)?.height).toBe(73)
    expect(store.graph.getNode(subtitle.id)?.width).toBe(439)
    expect(store.graph.getNode(subtitle.id)?.height).toBe(22)
    expect(store.graph.getNode(description.id)?.width).toBe(878)
    expect(store.graph.getNode(description.id)?.height).toBe(60)
  })

  test('imported nested instance layout keeps hidden sibling offsets stable', async () => {
    const graph = await loadFixtureGraph('gold-preview.fig')
    const previewRoot = graph.getChildren(graph.getPages()[0].id)[0]
    const wysiwygEditor = graph
      .getChildren(previewRoot.id)
      .find((node) => node.name === '_WYSIWYG-editor')
    const toolbarVariant = wysiwygEditor
      ? graph.getChildren(wysiwygEditor.id).find((node) => node.name === '_on-text-WYSIWYG-toolbar')
      : undefined
    const toolbarRow = toolbarVariant
      ? graph.getChildren(toolbarVariant.id).find((node) => node.name === 'Toolbar')
      : undefined
    const hiddenInput = toolbarRow
      ? graph.getChildren(toolbarRow.id).find((node) => node.name === 'Input')
      : undefined
    const visibleToolbar = toolbarRow
      ? graph
          .getChildren(toolbarRow.id)
          .find((node) => node.name === 'Toolbar' && node.id !== toolbarRow.id)
      : undefined

    if (!toolbarRow || !hiddenInput || !visibleToolbar) {
      throw new Error('Expected imported WYSIWYG toolbar nodes in gold-preview.fig')
    }

    expect(hiddenInput.visible).toBe(false)
    // x=8 is the Figma-exported fixture value (verified via fixture inspection 2026-05-03).
    // The old assertion of x=298 was incorrect — it was a post-layout computed value from
    // an older layout implementation. Post-layout, left-aligned HUG content retains x=8.
    expect(visibleToolbar.x).toBe(8)

    computeAllLayouts(graph, graph.getPages()[0].id)

    expect(graph.getNode(visibleToolbar.id)?.x).toBe(8)
    expect(graph.getNode(visibleToolbar.id)?.y).toBe(8)
  })

  test('WIDTH_AND_HEIGHT text uses measured width in centered layout', () => {
    const graph = new SceneGraph()
    const pid = pageId(graph)

    const frame = autoFrame(graph, pid, {
      width: 300,
      height: 40,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      primaryAxisAlign: 'CENTER',
      paddingLeft: 10,
      paddingRight: 10,
      itemSpacing: 10
    })

    const arrow1 = graph.createNode('FRAME', frame.id, { width: 20, height: 20 })
    const text = graph.createNode('TEXT', frame.id, {
      width: 200,
      height: 20,
      text: 'Test',
      fontSize: 14,
      textAutoResize: 'WIDTH_AND_HEIGHT' as const
    })
    const arrow2 = graph.createNode('FRAME', frame.id, { width: 20, height: 20 })

    setTextMeasurer((node) => {
      if (node.type === 'TEXT' && node.textAutoResize === 'WIDTH_AND_HEIGHT') {
        return { width: 60, height: 20 }
      }
      return null
    })

    computeAllLayouts(graph)

    setTextMeasurer(null)

    const updatedText = getNodeOrThrow(graph, text.id)
    const updatedArrow1 = getNodeOrThrow(graph, arrow1.id)
    const updatedArrow2 = getNodeOrThrow(graph, arrow2.id)

    expect(updatedText.width).toBe(60)

    // Total content: 10 + 20 + 10 + 60 + 10 + 20 + 10 = 140
    // Free space: 300 - 140 = 160, centered offset = 80
    expect(updatedArrow1.x).toBe(90)
    expect(updatedText.x).toBe(120)
    expect(updatedArrow2.x).toBe(190)
  })

  test('without measurer, text preserves stored dimensions from .fig import', () => {
    const graph = new SceneGraph()
    const pid = pageId(graph)

    const frame = autoFrame(graph, pid, {
      width: 300,
      height: 40,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      primaryAxisAlign: 'CENTER'
    })

    graph.createNode('TEXT', frame.id, {
      width: 200,
      height: 20,
      text: 'Test',
      fontSize: 14,
      textAutoResize: 'WIDTH_AND_HEIGHT' as const
    })

    setTextMeasurer(null)
    computeAllLayouts(graph)

    const children = graph.getChildren(frame.id)
    const updatedText = children[0]
    expect(updatedText.width).toBe(200)
    expect(updatedText.height).toBe(20)
  })

  test('without measurer, text with 100x100 default falls back to estimate', () => {
    const graph = new SceneGraph()
    const pid = pageId(graph)

    const frame = autoFrame(graph, pid, {
      width: 300,
      height: 40,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      primaryAxisAlign: 'CENTER'
    })

    graph.createNode('TEXT', frame.id, {
      width: 100,
      height: 100,
      text: 'Test',
      fontSize: 14,
      textAutoResize: 'WIDTH_AND_HEIGHT' as const
    })

    setTextMeasurer(null)
    computeAllLayouts(graph)

    const children = graph.getChildren(frame.id)
    const updatedText = children[0]
    expect(updatedText.width).toBeLessThan(100)
    expect(updatedText.width).toBeGreaterThan(0)
    expect(updatedText.height).toBeLessThan(100)
    expect(updatedText.height).toBeGreaterThan(0)
  })

  test('without measurer, HEIGHT text preserves stored height from .fig import', () => {
    const graph = new SceneGraph()
    const pid = pageId(graph)

    const frame = autoFrame(graph, pid, {
      width: 269,
      height: 400,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })

    graph.createNode('TEXT', frame.id, {
      width: 269,
      height: 66,
      text: 'GDP Growth Exceeds Expectations at 3.1% in Q2 Report That Nobody Expected',
      fontSize: 15,
      lineHeight: 22,
      textAutoResize: 'HEIGHT' as const
    })

    setTextMeasurer(null)
    computeAllLayouts(graph)

    const children = graph.getChildren(frame.id)
    const updatedText = children[0]
    expect(updatedText.height).toBe(66)
    expect(updatedText.width).toBe(269)
  })

  test('without measurer, HEIGHT text with 100x100 default falls back to estimate', () => {
    const graph = new SceneGraph()
    const pid = pageId(graph)

    const frame = autoFrame(graph, pid, {
      width: 269,
      height: 400,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })

    graph.createNode('TEXT', frame.id, {
      width: 100,
      height: 100,
      text: 'GDP Growth Exceeds Expectations at 3.1% in Q2 Report That Nobody Expected',
      fontSize: 15,
      lineHeight: 22,
      textAutoResize: 'HEIGHT' as const
    })

    setTextMeasurer(null)
    computeAllLayouts(graph)

    const children = graph.getChildren(frame.id)
    const updatedText = children[0]
    expect(updatedText.height).toBeGreaterThan(22)
  })

  test('text with w="fill" in flex="col" stretches to parent width', () => {
    const graph = new SceneGraph()
    const pid = pageId(graph)

    const frame = autoFrame(graph, pid, {
      width: 300,
      height: 400,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      paddingLeft: 20,
      paddingRight: 20
    })

    const text = graph.createNode('TEXT', frame.id, {
      width: 100,
      height: 20,
      text: 'This text should fill the parent width',
      fontSize: 14,
      textAutoResize: 'HEIGHT' as const,
      layoutAlignSelf: 'STRETCH' as const
    })

    setTextMeasurer((_node, maxWidth) => {
      const w = maxWidth ?? 260
      return { width: w, height: 20 }
    })

    computeAllLayouts(graph)
    setTextMeasurer(null)

    const updatedText = getNodeOrThrow(graph, text.id)
    // Should stretch to 300 - 20 - 20 = 260, NOT stay at 100
    expect(updatedText.width).toBe(260)
  })

  test('HEIGHT auto-resize text wraps via MeasureFunc when filling parent', () => {
    const graph = new SceneGraph()
    const pid = pageId(graph)

    const frame = autoFrame(graph, pid, {
      width: 300,
      height: 200,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })

    const text = graph.createNode('TEXT', frame.id, {
      width: 300,
      height: 20,
      text: 'Long text that should wrap within the available width',
      fontSize: 14,
      textAutoResize: 'HEIGHT' as const
    })

    setTextMeasurer((_node, maxWidth) => {
      const w = maxWidth ?? 1e6
      if (w >= 300) return { width: 300, height: 20 }
      return { width: w, height: 60 }
    })

    computeAllLayouts(graph)
    setTextMeasurer(null)

    const updatedText = getNodeOrThrow(graph, text.id)
    expect(updatedText.width).toBe(300)
    expect(updatedText.height).toBe(20)
  })

  test('MeasureFunc receives constraint width from flex layout', () => {
    const graph = new SceneGraph()
    const pid = pageId(graph)

    const frame = autoFrame(graph, pid, {
      width: 400,
      height: 200,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      itemSpacing: 10
    })

    rect(graph, frame.id, 100, 50)

    const text = graph.createNode('TEXT', frame.id, {
      width: 500,
      height: 20,
      text: 'Wide text',
      fontSize: 14,
      textAutoResize: 'WIDTH_AND_HEIGHT' as const,
      layoutGrow: 1
    })

    const receivedWidths: number[] = []
    setTextMeasurer((_node, maxWidth) => {
      if (maxWidth !== undefined) receivedWidths.push(Math.round(maxWidth))
      const w = maxWidth ?? 500
      return { width: Math.min(200, w), height: w < 200 ? 40 : 20 }
    })

    computeAllLayouts(graph)
    setTextMeasurer(null)

    // 400 - 100 - 10 = 290 available for the fill text
    expect(receivedWidths.length).toBeGreaterThan(0)
    const updatedText = getNodeOrThrow(graph, text.id)
    expect(updatedText.width).toBe(290)
  })

  test('textAutoResize NONE skips MeasureFunc', () => {
    const graph = new SceneGraph()
    const pid = pageId(graph)

    const frame = autoFrame(graph, pid, {
      width: 300,
      height: 100,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })

    const text = graph.createNode('TEXT', frame.id, {
      width: 150,
      height: 40,
      text: 'Fixed text',
      fontSize: 14,
      textAutoResize: 'NONE' as const
    })

    let measureCalled = false
    setTextMeasurer(() => {
      measureCalled = true
      return { width: 80, height: 20 }
    })

    computeAllLayouts(graph)
    setTextMeasurer(null)

    expect(measureCalled).toBe(false)
    const updatedText = getNodeOrThrow(graph, text.id)
    expect(updatedText.width).toBe(150)
    expect(updatedText.height).toBe(40)
  })
})
