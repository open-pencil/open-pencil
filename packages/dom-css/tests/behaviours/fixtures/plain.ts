import { SceneGraph } from '@open-pencil/scene-graph'

import { COLORS } from './sets'

/**
 * A component set without a behaviour: a badge in two tones with a label text property, an
 * icon a boolean property shows, hidden at rest, and a slot whose content defaults to a note.
 */
export function plainBadgeSet() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const set = graph.createNode('COMPONENT_SET', page, {
    name: 'Badge',
    componentPropertyDefinitions: [
      {
        id: 'tone',
        name: 'Tone',
        type: 'VARIANT',
        defaultValue: 'Neutral',
        variantOptions: ['Neutral', 'Danger']
      },
      { id: 'label', name: 'Label', type: 'TEXT', defaultValue: 'New' },
      { id: 'icon', name: 'Icon', type: 'BOOLEAN', defaultValue: 'false' },
      { id: 'extra', name: 'Extra', type: 'SLOT', defaultValue: '' }
    ]
  })
  for (const tone of ['Neutral', 'Danger']) {
    const variant = graph.createNode('COMPONENT', set.id, {
      name: `Tone=${tone}`,
      componentPropertyValues: { Tone: tone },
      width: 80,
      height: 24,
      fills: tone === 'Danger' ? COLORS.on : COLORS.off
    })
    graph.createNode('FRAME', variant.id, {
      name: 'Dot',
      width: 8,
      height: 8,
      visible: false,
      componentPropertyReferences: [{ propertyId: 'icon', field: 'VISIBLE' }]
    })
    graph.createNode('TEXT', variant.id, {
      name: 'Label',
      text: 'New',
      componentPropertyReferences: [{ propertyId: 'label', field: 'TEXT' }]
    })
    const extra = graph.createNode('FRAME', variant.id, {
      name: 'Extra',
      width: 20,
      height: 20,
      componentPropertyReferences: [{ propertyId: 'extra', field: 'SLOT_CONTENT' }]
    })
    graph.createNode('TEXT', extra.id, { name: 'Note', text: 'Note' })
  }
  return { graph, set: graph.getNode(set.id) ?? set }
}
