import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SceneGraph } from '@open-pencil/scene-graph'
import { percentLength } from '@open-pencil/scene-graph/text'
import { createConnector, connectorSublayers, freeEndpoint } from '@open-pencil/scene-graph/connectors'
import { createSticky, stickySublayers } from '@open-pencil/scene-graph/generated'

import { connectorLabelPlaceholderNode, stickyPlaceholderNode } from '#core/canvas/text/placeholder'

function emptyNote() {
  const graph = new SceneGraph()
  const sticky = createSticky(graph, graph.getPages()[0].id, { author: 'Ada' })
  return { graph, ...expectDefined(stickySublayers(graph, sticky)) }
}

describe('sticky note placeholder', () => {
  test("an empty body shows the canvas's placeholder, in the body's style at 30% black", () => {
    const { graph, body } = emptyNote()
    const drawn = expectDefined(stickyPlaceholderNode(graph, body, 'Пишите что угодно'))
    expect(drawn).toMatchObject({ text: 'Пишите что угодно', fontSize: 16, lineHeight: percentLength(150) })
    expect(drawn.fills[0]).toMatchObject({ opacity: 0.3, color: { r: 0, g: 0, b: 0 } })
    expect(body.text).toBe('')
  })

  test('a canvas without a placeholder, such as an export, draws none', () => {
    const { graph, body } = emptyNote()
    expect(stickyPlaceholderNode(graph, body, null)).toBeNull()
  })

  test('the author line and a body with text show no placeholder', () => {
    const { graph, body, author } = emptyNote()
    expect(stickyPlaceholderNode(graph, author, 'Type anything')).toBeNull()
    graph.updateNode(body.id, { text: 'Hello' })
    expect(
      stickyPlaceholderNode(graph, expectDefined(graph.getNode(body.id)), 'Type anything')
    ).toBeNull()
  })
})

describe('connector label placeholder', () => {
  function emptyLabel() {
    const graph = new SceneGraph()
    const connector = createConnector(graph, graph.getPages()[0].id, {
      start: freeEndpoint(0, 0),
      end: freeEndpoint(200, 0)
    })
    return { graph, ...expectDefined(connectorSublayers(graph, connector)) }
  }

  test('an empty label shows it only while it is typed into, at 30% black', () => {
    const { graph, label } = emptyLabel()
    const drawn = expectDefined(connectorLabelPlaceholderNode(graph, label, 'Add text', label.id))
    expect(drawn.text).toBe('Add text')
    expect(drawn.fills[0]).toMatchObject({ opacity: 0.3, color: { r: 0, g: 0, b: 0 } })
    expect(connectorLabelPlaceholderNode(graph, label, 'Add text', null)).toBeNull()
  })

  test('a label with text, or other text being edited, shows none', () => {
    const { graph, label, line } = emptyLabel()
    expect(connectorLabelPlaceholderNode(graph, line, 'Add text', line.id)).toBeNull()
    graph.updateNode(label.id, { text: 'Next' })
    const typed = expectDefined(graph.getNode(label.id))
    expect(connectorLabelPlaceholderNode(graph, typed, 'Add text', label.id)).toBeNull()
  })
})
