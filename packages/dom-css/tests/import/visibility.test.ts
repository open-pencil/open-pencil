import { describe, expect, it } from 'bun:test'

import { designDocumentToSceneGraph } from '#dom-css/import/scene-graph'
import type { DesignElement } from '#dom-css/index'

function box(name: string, visibility: string, children: DesignElement[] = []): DesignElement {
  return {
    type: 'element',
    tagName: 'div',
    attrs: { class: name },
    computedStyle: { width: '28px', height: '28px', visibility, 'background-color': '#000' },
    children
  }
}

function layersOf(...children: DesignElement[]) {
  const graph = designDocumentToSceneGraph({ type: 'document', children })
  return graph.flattenTree(graph.getPages()[0].id).map(({ node }) => node)
}

describe('visibility in imported HTML', () => {
  it('keeps a box CSS hides as a hidden layer', () => {
    const [button] = layersOf(box('scroll', 'hidden', [box('icon', 'hidden')]))

    expect(button).toMatchObject({ name: 'scroll', visible: false })
  })

  it('shows a hidden box that holds one showing again, as its child shows', () => {
    const layers = layersOf(box('menu', 'hidden', [box('item', 'visible')]))

    expect(layers.find((layer) => layer.name === 'menu')).toMatchObject({
      visible: true,
      fills: []
    })
    expect(layers.find((layer) => layer.name === 'item')?.visible).toBe(true)
  })
})
