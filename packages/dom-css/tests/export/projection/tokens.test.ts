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

  test('writes the colour the canvas draws for a bound paint, whatever colour the paint keeps', () => {
    // A script binding a paint keeps the colour it gave; the canvas draws the variable's value.
    const graph = designSystem()
    const page = graph.getPages()[0].id
    const stale = card(graph, page, BLUE_300)
    const current = card(graph, page, BLUE_500)

    expect(element(graph, stale.id).inlineStyle?.['background-color']).toBe('var(--color-primary)')
    expect(element(graph, stale.id, false).inlineStyle?.['background-color']).toBe(
      element(graph, current.id, false).inlineStyle?.['background-color']
    )
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

  test('puts a node in its mode with the attribute its collection names', () => {
    const graph = designSystem()
    const theme = graph.variableCollections.get('theme')
    if (theme) theme.modeAttribute = 'data-scheme'
    const outer = card(graph, graph.getPages()[0].id, BLUE_500)
    card(graph, outer.id, BLUE_300, { variableModes: { theme: 'dark' } })

    const inner = child(element(graph, outer.id))

    expect(inner.attrs['data-scheme']).toBe('dark')
    expect(inner.attrs).not.toHaveProperty('data-theme')
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

describe('token references in effects', () => {
  const shadow = (offsetY: number) => ({
    type: 'DROP_SHADOW' as const,
    color: BLUE_500,
    offset: { x: 0, y: offsetY },
    radius: 8,
    spread: 0,
    visible: true
  })

  test('write a bound shadow’s colour and length as tokens', () => {
    const graph = designSystem()
    const frame = card(graph, graph.getPages()[0].id, BLUE_500, { effects: [shadow(24)] })
    graph.bindVariable(frame.id, 'effects/0/offsetY', 'gutter')
    graph.bindVariable(frame.id, 'effects/0/color', 'primary')

    // A shadow's blur length is twice the sigma the canvas blurs radius 8 by.
    expect(element(graph, frame.id).inlineStyle?.['box-shadow']).toBe(
      '0px var(--spacing-gutter) 6.88px 0px var(--color-primary)'
    )
  })

  test('write a bound blur radius as a token', () => {
    const graph = designSystem()
    const frame = card(graph, graph.getPages()[0].id, BLUE_500, {
      effects: [{ ...shadow(0), type: 'LAYER_BLUR' as const, radius: 24 }]
    })
    graph.bindVariable(frame.id, 'effects/0/radius', 'gutter')

    // The token holds the Figma radius; `blur()` takes the sigma the canvas draws it with.
    expect(element(graph, frame.id).inlineStyle?.filter).toBe(
      'blur(calc(var(--spacing-gutter) * 0.43))'
    )
  })

  test('keep the literal where the shadow draws another value, as a scaled instance does', () => {
    const graph = designSystem()
    const frame = card(graph, graph.getPages()[0].id, BLUE_500, { effects: [shadow(48)] })
    graph.updateNode(frame.id, { boundVariables: { 'effects/0/offsetY': 'gutter' } })

    expect(element(graph, frame.id).inlineStyle?.['box-shadow']).toBe('0px 48px 6.88px 0px #3B82F5')
  })
})
