import { createShaderPaint, SceneGraph, withShaderPaints } from '@open-pencil/scene-graph'

/** The preset the hero plays: an aurora with a few props, and film grain over it. */
export const HERO_PRESET = {
  components: [
    { type: 'Aurora', props: { colorA: '#ff3300', curtainCount: 2, center: { x: 0.5, y: 0 } } },
    { type: 'FilmGrain' }
  ]
}

/** A plain component whose root fills with a shader behind its title. */
export function shaderHeroSet() {
  const graph = new SceneGraph()
  const set = graph.createNode('COMPONENT_SET', graph.getPages()[0].id, {
    name: 'Hero',
    componentPropertyDefinitions: [
      {
        id: 'size',
        name: 'Size',
        type: 'VARIANT',
        defaultValue: 'Large',
        variantOptions: ['Large']
      }
    ]
  })
  const { paint, shader } = createShaderPaint(HERO_PRESET)
  const variant = graph.createNode('COMPONENT', set.id, {
    name: 'Size=Large',
    componentPropertyValues: { Size: 'Large' },
    width: 320,
    height: 160,
    cornerRadius: 16,
    fills: [paint]
  })
  graph.updateNode(variant.id, { pluginData: withShaderPaints(variant, [paint], [shader]) })
  graph.createNode('TEXT', variant.id, { name: 'Title', text: 'Northern lights' })
  return { graph, set: graph.getNode(set.id) ?? set }
}

/** A plain component whose shader fills a child layer with nothing in it, a backdrop. */
export function shaderBackdropSet() {
  const graph = new SceneGraph()
  const set = graph.createNode('COMPONENT_SET', graph.getPages()[0].id, {
    name: 'Card',
    componentPropertyDefinitions: [
      {
        id: 'size',
        name: 'Size',
        type: 'VARIANT',
        defaultValue: 'Large',
        variantOptions: ['Large']
      }
    ]
  })
  const variant = graph.createNode('COMPONENT', set.id, {
    name: 'Size=Large',
    componentPropertyValues: { Size: 'Large' },
    width: 240,
    height: 120
  })
  const { paint, shader } = createShaderPaint(HERO_PRESET)
  graph.images.set(shader.image, new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))
  const backdrop = graph.createNode('RECTANGLE', variant.id, {
    name: 'Backdrop',
    width: 240,
    height: 120,
    fills: [paint]
  })
  graph.updateNode(backdrop.id, { pluginData: withShaderPaints(backdrop, [paint], [shader]) })
  return { graph, set: graph.getNode(set.id) ?? set }
}
