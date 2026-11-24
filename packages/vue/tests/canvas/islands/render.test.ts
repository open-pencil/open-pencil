import { describe, expect, test } from 'bun:test'

import type { DesignElement } from '@open-pencil/dom-css/export'
import { SceneGraph } from '@open-pencil/scene-graph'

import { renderElement, type IslandRenderContext } from '#vue/canvas/islands/render'
import { createIslandState } from '#vue/canvas/islands/state'

const context: IslandRenderContext = {
  graph: new SceneGraph(),
  rootId: '',
  controls: new Map(),
  roles: new Map(),
  state: createIslandState(new Map()),
  transitions: new Map()
}

const element = (tagName: string, attrs: Record<string, string>): DesignElement => ({
  type: 'element',
  tagName,
  attrs,
  children: [{ type: 'text', text: 'View in shadcn' }]
})

describe('preview island elements', () => {
  // The shadcn/ui kit links its "View in Shadcn" labels to the docs; following one in preview
  // must not take the editor away from the document.
  test("a text's link opens in a new tab", () => {
    const link = renderElement(context, element('a', { href: 'https://ui.shadcn.com' }), 'Link')
    expect(link.props).toMatchObject({
      href: 'https://ui.shadcn.com',
      target: '_blank',
      rel: 'noopener noreferrer'
    })
  })

  test('a layer plays the transition of the control it is in, the nearest one', () => {
    const transitions = new Map([
      ['Switch', { 'transition-duration': '250ms' }],
      ['Switch/Inner', { 'transition-duration': '100ms' }]
    ])
    const style = (path: string) =>
      renderElement({ ...context, transitions }, element('div', {}), path).props?.style
    expect(style('Switch/Knob')).toMatchObject({ 'transition-duration': '250ms' })
    expect(style('Switch/Inner/Dot')).toMatchObject({ 'transition-duration': '100ms' })
    expect(style('Other')).not.toHaveProperty('transition-duration')
  })

  test('other elements get no link attributes', () => {
    const frame = renderElement(context, element('div', {}), 'Frame')
    expect(frame.props?.target).toBeUndefined()
  })
})
