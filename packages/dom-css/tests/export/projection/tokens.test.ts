import { describe, expect, test } from 'bun:test'

import { sceneNodeToDesignDocument, type DesignElement } from '#dom-css/export/index'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { BLUE_300, BLUE_500, card, designSystem } from '../token-fixtures'

function element(graph: SceneGraph, nodeId: string, tokens?: boolean): DesignElement {
  const [node] = sceneNodeToDesignDocument(graph, nodeId, { tokens }).children
  if (node?.type !== 'element') throw new Error('Expected an element')
  return node
}

function child(node: DesignElement, index = 0): DesignElement {
  const found = node.children[index]
  if (found?.type !== 'element') throw new Error('Expected a child element')
  return found
}

describe('token references in design-to-code', () => {
  test('writes bound colors and lengths as the tokens the stylesheet declares', () => {
    const graph = designSystem()
    const frame = card(graph, graph.getPages()[0].id, BLUE_500)

    const { inlineStyle, attrs } = element(graph, frame.id)

    expect(inlineStyle).toMatchObject({
      'background-color': 'var(--color-primary)',
      padding: 'var(--spacing-gutter)'
    })
    expect(attrs).not.toHaveProperty('data-theme')
  })

  test('keeps the literal value where the node no longer draws the token', () => {
    const graph = designSystem()
    const frame = card(graph, graph.getPages()[0].id, BLUE_300)

    expect(element(graph, frame.id).inlineStyle?.['background-color']).toBe('#94C4FC')
  })

  test('keeps a length literal when the token is unitless', () => {
    const graph = designSystem()
    const frame = card(graph, graph.getPages()[0].id, BLUE_500, {
      boundVariables: { 'fills/0/color': 'primary', paddingTop: 'count' }
    })

    expect(element(graph, frame.id).inlineStyle?.padding).toBe('24px')
  })

  test('puts a node in its mode, so the token resolves as the canvas draws it', () => {
    const graph = designSystem()
    const outer = card(graph, graph.getPages()[0].id, BLUE_500)
    card(graph, outer.id, BLUE_300, { variableModes: { theme: 'dark' } })

    const inner = child(element(graph, outer.id))

    expect(inner.attrs['data-theme']).toBe('dark')
    expect(inner.inlineStyle?.['background-color']).toBe('var(--color-primary)')
  })

  test('keeps literals where no attribute can bring back the mode the node is in', () => {
    const graph = designSystem()
    const outer = card(graph, graph.getPages()[0].id, BLUE_300, {
      variableModes: { theme: 'dark' }
    })
    card(graph, outer.id, BLUE_500, { variableModes: { theme: 'light' } })
    card(graph, outer.id, BLUE_300, { variableModes: { theme: 'contrast' } })

    const projected = element(graph, outer.id)

    expect(projected.attrs['data-theme']).toBe('dark')
    expect(child(projected, 0).inlineStyle?.['background-color']).toBe('#3B82F5')
    expect(child(projected, 1).inlineStyle?.['background-color']).toBe('#94C4FC')
  })

  test('starts an exported node in the modes the editor is showing', () => {
    const graph = designSystem()
    graph.setActiveMode('theme', 'dark')
    const frame = card(graph, graph.getPages()[0].id, BLUE_300)

    const projected = element(graph, frame.id)

    expect(projected.attrs['data-theme']).toBe('dark')
    expect(projected.inlineStyle?.['background-color']).toBe('var(--color-primary)')
  })

  test('writes literal values when tokens are turned off', () => {
    const graph = designSystem()
    const frame = card(graph, graph.getPages()[0].id, BLUE_500)

    expect(element(graph, frame.id, false).inlineStyle).toMatchObject({
      'background-color': '#3B82F5',
      padding: '24px'
    })
  })
})
