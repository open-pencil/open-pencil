import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { effectiveFigmaRawNodeFields } from '@open-pencil/fig'
import type { Effect, Fill, SceneNode } from '@open-pencil/scene-graph'
import { getSharedStyles } from '@open-pencil/scene-graph/shared-styles'
import { pixelLength } from '@open-pencil/scene-graph/text'

import { sharedStyleDetachPatch, sharedStylePatch } from '#vue/controls/shared-style/model'

import { firstPageId, makeSceneGraph } from '#tests/helpers/scene'

const red: Fill = {
  type: 'SOLID',
  color: { r: 1, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true
}
const blue: Fill = {
  type: 'SOLID',
  color: { r: 0, g: 0.3, b: 1, a: 1 },
  opacity: 1,
  visible: true
}

function setSourceId(node: SceneNode, id: string) {
  node.source.id = id
  node.source.format = 'fig'
}

describe('shared style model', () => {
  test('lists internal definitions and applies canonical domain properties', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const fillStyle = graph.createNode('RECTANGLE', pageId, {
      name: 'Brand/Primary',
      fills: [red],
      sharedStyleType: 'FILL',
      internalOnly: true
    })
    setSourceId(fillStyle, '1:20')
    const target = graph.createNode('RECTANGLE', pageId, { fills: [blue] })

    expect(getSharedStyles(graph, 'fill')).toEqual([
      { id: '1:20', nodeId: fillStyle.id, name: 'Brand/Primary', type: 'FILL' }
    ])
    expect(sharedStylePatch('fill', target, '1:20', fillStyle)).toMatchObject({
      fillStyleId: '1:20',
      fills: [red]
    })
    expect(sharedStyleDetachPatch('fill')).toEqual({ fillStyleId: null })
  })

  test('applies text, effect, and grid style payloads', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const target = graph.createNode('TEXT', pageId)
    const textStyle = graph.createNode('TEXT', pageId, {
      fontFamily: 'Inter',
      fontSize: 24,
      fontWeight: 700,
      lineHeight: pixelLength(32),
      textCase: 'UPPER'
    })
    const effect: Effect = {
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.25 },
      offset: { x: 0, y: 4 },
      radius: 8,
      spread: 0,
      visible: true
    }
    const effectStyle = graph.createNode('RECTANGLE', pageId, { effects: [effect] })
    const gridStyle = graph.createNode('FRAME', pageId, {
      layoutGrids: [{ pattern: 'COLUMNS', count: 12, gutterSize: 16, visible: true }]
    })

    expect(sharedStylePatch('text', target, '1:21', textStyle)).toMatchObject({
      textStyleId: '1:21',
      fontSize: 24,
      fontWeight: 700,
      lineHeight: pixelLength(32),
      textCase: 'UPPER'
    })
    expect(sharedStylePatch('effect', target, '1:22', effectStyle)).toMatchObject({
      effectStyleId: '1:22',
      effects: [effect]
    })
    expect(sharedStylePatch('grid', target, '1:23', gridStyle)).toMatchObject({
      gridStyleId: '1:23',
      layoutGrids: [{ count: 12 }]
    })
  })

  test('detaching a reference invalidates only its effective Figma fallback', () => {
    const graph = makeSceneGraph()
    const target = graph.createNode('RECTANGLE', firstPageId(graph), {
      fillStyleId: '1:20',
      effectStyleId: '1:22'
    })
    target.source.fig.rawNodeFields = {
      styleIdForFill: { guid: { sessionID: 1, localID: 20 } },
      styleIdForEffect: { guid: { sessionID: 1, localID: 22 } },
      description: 'Preserve me'
    }

    graph.updateNode(target.id, { fillStyleId: null })

    expect(target.source.fig.rawNodeFields).toHaveProperty('styleIdForFill')
    expect(effectiveFigmaRawNodeFields(target)).toEqual({
      styleIdForEffect: { guid: { sessionID: 1, localID: 22 } },
      description: 'Preserve me'
    })
  })

  test('manual visual edits detach only the matching style and undo restores it', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const target = graph.createNode('RECTANGLE', pageId, {
      fills: [red],
      fillStyleId: '1:20',
      effectStyleId: '1:22'
    })
    const editor = createEditor({ graph })

    editor.updateNodeWithUndo(target.id, { fills: [blue] }, 'Change fills')
    expect(graph.getNode(target.id)).toMatchObject({
      fillStyleId: null,
      effectStyleId: '1:22',
      fills: [blue]
    })

    editor.undo.undo()
    expect(graph.getNode(target.id)).toMatchObject({ fillStyleId: '1:20', fills: [red] })

    const text = graph.createNode('TEXT', pageId, { fontSize: 16, textStyleId: '1:21' })
    editor.updateNodeWithUndo(text.id, { fontSize: 24 }, 'Change font size')
    expect(graph.getNode(text.id)).toMatchObject({ fontSize: 24, textStyleId: null })
    editor.undo.undo()
    expect(graph.getNode(text.id)).toMatchObject({ fontSize: 16, textStyleId: '1:21' })
  })
})
