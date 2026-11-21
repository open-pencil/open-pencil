import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'

import { designDocumentToLayers, designDocumentToSceneGraph } from '#dom-css/import/scene-graph'
import type { DesignElement } from '#dom-css/index'

import { FIXTURES } from '@open-pencil/test-support/paths'

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

  it('hides the text a hidden box holds itself, while its child shows again', () => {
    const menu = box('menu', 'hidden', [box('item', 'visible')])
    menu.children.unshift({ type: 'text', text: 'Hidden label' })
    const layers = layersOf(menu)

    expect(layers.find((layer) => layer.type === 'TEXT')).toMatchObject({
      text: 'Hidden label',
      visible: false
    })
    expect(layers.find((layer) => layer.name === 'item')?.visible).toBe(true)
  })

  it('leaves out the background pictures of a box that paints nothing of its own', async () => {
    const png = await Bun.file(join(FIXTURES, 'absolute-constraint-figma.png')).bytes()
    const menu = box('menu', 'hidden', [box('item', 'visible')])
    menu.computedStyle = {
      ...menu.computedStyle,
      'background-image': 'url("https://site.test/photo.png")',
      'background-size': '10px 10px',
      'background-repeat': 'no-repeat'
    }
    menu.backgroundImages = [{ url: 'https://site.test/photo.png', bytes: png }]

    const { backgroundPictures } = designDocumentToLayers({ type: 'document', children: [menu] })

    expect(backgroundPictures).toEqual([])
  })
})
