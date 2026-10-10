import { describe, expect, test } from 'bun:test'

import { switchSet } from '#dom-css-tests/behaviours/fixtures'
import { fileText } from '#dom-css-tests/helpers'
import { layerComponents } from '#dom-css/export'

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

  test('layers with the same name get distinct component names', async () => {
    const graph = new SceneGraph()
    const first = card(graph, 'Card')
    const second = card(graph, 'Card')

    const components = await layerComponents(graph, [first.id, second.id], 'react')

    expect(components.map((component) => component.name)).toEqual(['Card', 'Card2'])
  })
})
