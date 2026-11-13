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
  state: createIslandState(new Map())
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

  test('other elements get no link attributes', () => {
    const frame = renderElement(context, element('div', {}), 'Frame')
    expect(frame.props?.target).toBeUndefined()
  })
})
