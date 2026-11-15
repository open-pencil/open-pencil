import { describe, expect, test } from 'bun:test'

import { createLinter, type LintMessage } from '@open-pencil/core/lint'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { internalCanvas, newSharedStyleId } from '@open-pencil/scene-graph/shared-styles'

function dropShadow(visible = true): SceneNode['effects'][number] {
  return {
    type: 'DROP_SHADOW',
    visible,
    color: { r: 0, g: 0, b: 0, a: 0.2 },
    offset: { x: 0, y: 2 },
    radius: 8,
    spread: 0
  }
}

function lint(graph: SceneGraph): LintMessage[] {
  return createLinter({
    preset: 'recommended',
    rules: ['effect-style-required']
  }).lintGraph(graph).messages
}

/** A shared style on the internal canvas, linked by its source id the way a `.fig` file does. */
function sharedStyle(
  graph: SceneGraph,
  type: 'EFFECT' | 'FILL',
  effects: SceneNode['effects']
): SceneNode {
  const style = graph.createNode('RECTANGLE', internalCanvas(graph).id, {
    name: type === 'EFFECT' ? 'shared shadow' : 'shared fill',
    sharedStyleType: type,
    internalOnly: true,
    fills: [],
    effects
  })
  style.source.id = newSharedStyleId()
  return style
}

function card(
  graph: SceneGraph,
  effects: SceneNode['effects'],
  effectStyleId: string | null = null
): SceneNode {
  return graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    name: 'card',
    width: 100,
    height: 100,
    effects,
    effectStyleId
  })
}

describe('effect-style-required', () => {
  test('accepts a layer whose effectStyleId is a shared EFFECT style', () => {
    const graph = new SceneGraph()
    const effects = [dropShadow()]
    const style = sharedStyle(graph, 'EFFECT', effects)
    const layer = card(graph, effects, style.source.id)

    expect(lint(graph)).toEqual([])
    expect(layer.effects).toEqual(effects)
    expect(layer.effectStyleId).toBe(style.source.id)
  })

  test('reports a visible effect that is not linked to a shared style', () => {
    const graph = new SceneGraph()
    const layer = card(graph, [dropShadow()])

    expect(lint(graph)).toMatchObject([
      {
        ruleId: 'effect-style-required',
        message: 'Effect without shared style: DROP_SHADOW 8px',
        suggest: 'Extract reusable shadows and blurs into shared presets or variables',
        nodeId: layer.id,
        nodeName: 'card',
        data: { effect: 'DROP_SHADOW', count: 1 }
      }
    ])
    expect(layer.effects).toEqual([dropShadow()])
  })

  test('reports an effectStyleId that resolves to nothing', () => {
    const graph = new SceneGraph()
    const layer = card(graph, [dropShadow()], 'S:missing,')

    const messages = lint(graph)

    expect(messages).toHaveLength(1)
    expect(messages[0]?.nodeId).toBe(layer.id)
    expect(messages[0]?.message).toBe('Effect without shared style: DROP_SHADOW 8px')
  })

  test('reports an effectStyleId that points at a style of another kind', () => {
    const graph = new SceneGraph()
    const effects = [dropShadow()]
    const fill = sharedStyle(graph, 'FILL', effects)
    const layer = card(graph, effects, fill.source.id)

    const messages = lint(graph)

    expect(messages).toHaveLength(1)
    expect(messages[0]?.nodeId).toBe(layer.id)
    expect(messages[0]?.message).toBe('Effect without shared style: DROP_SHADOW 8px')
  })

  test('reports nothing when every effect is hidden', () => {
    const graph = new SceneGraph()
    card(graph, [dropShadow(false)])

    expect(lint(graph)).toEqual([])
  })
})
