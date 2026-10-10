import { describe, expect, test } from 'bun:test'

import { switchSet } from '#dom-css-tests/behaviours/fixtures'
import { fileText } from '#dom-css-tests/helpers'
import { layerComponents, layerMarkup } from '#dom-css/export'

import { SceneGraph } from '@open-pencil/scene-graph'

function card(graph: SceneGraph, name: string) {
  const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
    name,
    x: 300,
    y: 200,
    width: 240,
    height: 120,
    layoutMode: 'VERTICAL',
    itemSpacing: 8,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
  })
  graph.createNode('TEXT', frame.id, { name: 'Title', text: 'Pro' })
  return frame
}

describe('layers as components', () => {
  test('a frame is a plain component of the elements it draws', async () => {
    const graph = new SceneGraph()
    const frame = card(graph, 'Pricing card')

    const [vue] = await layerComponents(graph, [frame.id], 'vue')
    const [react] = await layerComponents(graph, [frame.id], 'react')

    expect(vue?.name).toBe('PricingCard')
    const sfc = fileText(vue?.files ?? [], 'PricingCard.vue')
    expect(sfc).not.toContain('<script')
    expect(sfc).toContain('<span class="pricing-card__title">Pro</span>')
    expect(sfc).toContain('gap: 8px')
    // Where the frame sits on the canvas is not the component's.
    expect(sfc).not.toContain('300px')
    expect(react?.files.map((file) => file.path)).toEqual([
      'PricingCard.tsx',
      'PricingCard.module.css'
    ])
    expect(fileText(react?.files ?? [], 'PricingCard.tsx')).toContain(
      'export function PricingCard(props: PricingCardProps)'
    )
  })

  test('a component set keeps its behaviour', async () => {
    const { graph, set } = switchSet()

    const [vue] = await layerComponents(graph, [set.id], 'vue')

    expect(fileText(vue?.files ?? [], `${vue?.name}.vue`)).toContain('SwitchRoot')
  })

  test('a component lists the layer each element draws, in the order they open', async () => {
    const { graph, set } = switchSet()
    const rest = graph.getNode(set.childIds[0])
    if (!rest) throw new Error('The switch has no variants')
    const drawn = [rest.id, rest.childIds[0]]

    for (const styling of ['css', 'tailwind'] as const) {
      const [react] = await layerComponents(graph, [set.id], 'react', { styling })
      expect(react?.files.find((file) => file.path.endsWith('.tsx'))?.layerIds).toEqual(drawn)
      // The script, template, and style blocks around a Vue template draw no layer.
      const [vue] = await layerComponents(graph, [set.id], 'vue', { styling })
      expect(vue?.files[0]?.layerIds).toEqual([
        null,
        null,
        ...drawn,
        ...(styling === 'css' ? [null] : [])
      ])
      expect((await layerMarkup(graph, [set.id], { styling })).layerIds).toEqual(drawn)
    }
  })

  test('styled with Tailwind, a component has no stylesheet', async () => {
    const graph = new SceneGraph()
    const frame = card(graph, 'Pricing card')

    const [vue] = await layerComponents(graph, [frame.id], 'vue', { styling: 'tailwind' })
    const [react] = await layerComponents(graph, [frame.id], 'react', { styling: 'tailwind' })

    expect(fileText(vue?.files ?? [], 'PricingCard.vue')).not.toContain('<style')
    expect(fileText(vue?.files ?? [], 'PricingCard.vue')).toContain('flex flex-col')
    expect(react?.files.map((file) => file.path)).toEqual(['PricingCard.tsx'])
  })

  test('layers with the same name get distinct component names', async () => {
    const graph = new SceneGraph()
    const first = card(graph, 'Card')
    const second = card(graph, 'Card')

    const components = await layerComponents(graph, [first.id, second.id], 'react')

    expect(components.map((component) => component.name)).toEqual(['Card', 'Card2'])
  })
})

describe('layers as HTML and CSS', () => {
  test('markup is indented with a class per layer, styled by one stylesheet', async () => {
    const graph = new SceneGraph()
    const frame = card(graph, 'Pricing card')

    const { html, css } = await layerMarkup(graph, [frame.id])

    expect(html).toBe(
      '<div class="pricing-card">\n  <span class="pricing-card__title">Pro</span>\n</div>'
    )
    expect(css).toContain('.pricing-card {')
    expect(css).toContain('.pricing-card .pricing-card__title {')
  })

  test('styled with Tailwind, the markup carries utilities and there is no stylesheet', async () => {
    const graph = new SceneGraph()
    const frame = card(graph, 'Pricing card')

    const { html, css } = await layerMarkup(graph, [frame.id], { styling: 'tailwind' })

    expect(html).toMatch(/^<div class="[^"]*\bflex flex-col\b[^"]*\bgap-2\b[^"]*bg-white/)
    expect(html).toContain('\n  <span class="')
    expect(css).toBe('')
  })

  test('layers named alike keep their rules apart', async () => {
    const graph = new SceneGraph()
    const first = card(graph, 'Card')
    const second = card(graph, 'Card')

    const { html } = await layerMarkup(graph, [first.id, second.id])

    expect(html).toContain('<div class="card">')
    expect(html).toContain('<div class="card-2">')
  })

  test('images are files the markup points at, not inline data', async () => {
    const graph = new SceneGraph()
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    const hash = 'a'.repeat(40)
    graph.images.set(hash, bytes)
    const photo = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      name: 'Photo',
      width: 80,
      height: 60,
      fills: [
        {
          type: 'IMAGE',
          imageHash: hash,
          imageScaleMode: 'FILL',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })

    const { html, images } = await layerMarkup(graph, [photo.id], { assetBasePath: 'card.assets' })

    expect(html).toContain('src="card.assets/images/image-1.png"')
    expect(html).not.toContain('data:image')
    expect(images.map((image) => image.content)).toEqual([bytes])
  })
})
