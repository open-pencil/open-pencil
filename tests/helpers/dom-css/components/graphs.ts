import { SceneGraph, type ComponentPropertyReference } from '@open-pencil/scene-graph'
import { emptyBehaviour, withBehaviour, type Behaviour } from '@open-pencil/scene-graph/behaviours'

const fill = (r: number, g: number, b: number) => [
  { type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }
]
const slot = (propertyId: string): ComponentPropertyReference[] => [
  { propertyId, field: 'SLOT_CONTENT' }
]

/** A set with a variant per value of one property, drawn by `draw`, and a behaviour. */
function controlSet(
  name: string,
  property: { name: string; values: string[] },
  behaviour: Behaviour,
  draw: (graph: SceneGraph, variantId: string, value: string) => void,
  graph = new SceneGraph()
): SceneGraph {
  const set = graph.createNode('COMPONENT_SET', graph.getPages()[0].id, {
    name,
    componentPropertyDefinitions: [
      {
        id: 'value',
        name: property.name,
        type: 'VARIANT',
        defaultValue: property.values[0] ?? '',
        variantOptions: property.values
      }
    ]
  })
  for (const value of property.values) {
    const variant = graph.createNode('COMPONENT', set.id, {
      name: `${property.name}=${value}`,
      componentPropertyValues: { [property.name]: value },
      width: 40,
      height: 22
    })
    draw(graph, variant.id, value)
  }
  graph.updateNode(set.id, { pluginData: withBehaviour(set, behaviour) })
  return graph
}

export function switchGraph(graph?: SceneGraph): SceneGraph {
  return controlSet(
    'Switch',
    { name: 'State', values: ['Off', 'On'] },
    {
      ...emptyBehaviour('switch'),
      booleans: { value: { propertyId: 'value', on: 'On', off: 'Off' } },
      parts: { thumb: 'thumb' }
    },
    (graph, variantId, value) => {
      graph.updateNode(variantId, {
        fills: value === 'On' ? fill(0.3, 0.27, 0.9) : fill(0.8, 0.84, 0.88)
      })
      graph.createNode('FRAME', variantId, {
        name: 'Thumb',
        componentPropertyReferences: slot('thumb'),
        x: value === 'On' ? 20 : 2,
        y: 2,
        width: 18,
        height: 18,
        fills: fill(1, 1, 1)
      })
    },
    graph
  )
}

/** A radio group of two radios, each labelled through the radio's text property, the first chosen. */
export function radioGroupGraph(): SceneGraph {
  const graph = controlSet(
    'Radio',
    { name: 'Checked', values: ['Off', 'On'] },
    {
      ...emptyBehaviour('radio'),
      booleans: { value: { propertyId: 'value', on: 'On', off: 'Off' } }
    },
    (graph, variantId, value) => {
      graph.updateNode(variantId, {
        width: 100,
        height: 20,
        fills: value === 'On' ? fill(0.3, 0.27, 0.9) : fill(0.8, 0.84, 0.88)
      })
      graph.createNode('TEXT', variantId, {
        name: 'Label',
        text: 'Option',
        componentPropertyReferences: [{ propertyId: 'label', field: 'TEXT' }]
      })
    }
  )
  const radio = [...graph.getAllNodes()].find((node) => node.type === 'COMPONENT_SET')
  if (!radio) throw new Error('Expected the radio set')
  graph.updateNode(radio.id, {
    componentPropertyDefinitions: [
      ...radio.componentPropertyDefinitions,
      { id: 'label', name: 'Label', type: 'TEXT', defaultValue: 'Option' }
    ]
  })
  const variant = (value: string) =>
    graph.getChildren(radio.id).find((child) => child.name === `Checked=${value}`)
  const group = graph.createNode('COMPONENT', graph.getPages()[0].id, { name: 'Plan' })
  const items = graph.createNode('FRAME', group.id, {
    name: 'Items',
    componentPropertyReferences: slot('items'),
    width: 100,
    height: 50
  })
  for (const [index, label] of ['Basic', 'Pro'].entries()) {
    const main = variant(index === 0 ? 'On' : 'Off')
    if (!main) throw new Error('Expected the radio drawn on and off')
    const item = graph.createInstance(main.id, items.id, { name: 'Item', y: index * 25 })
    if (!item) throw new Error('Expected the item placed')
    graph.updateNode(item.id, {
      componentPropertyAssignments: { ...item.componentPropertyAssignments, label }
    })
  }
  graph.updateNode(group.id, {
    pluginData: withBehaviour(group, { ...emptyBehaviour('radioGroup'), parts: { items: 'items' } })
  })
  return graph
}

/** Tabs whose list holds a trigger and whose panels a panel per tab. */
export function tabsGraph(): SceneGraph {
  const graph = new SceneGraph()
  const tabs = graph.createNode('COMPONENT', graph.getPages()[0].id, { name: 'Settings' })
  const list = graph.createNode('FRAME', tabs.id, {
    name: 'List',
    componentPropertyReferences: slot('list'),
    width: 160,
    height: 20
  })
  const panels = graph.createNode('FRAME', tabs.id, {
    name: 'Panels',
    componentPropertyReferences: slot('panels'),
    y: 24,
    width: 160,
    height: 40
  })
  for (const label of ['Account', 'Password']) {
    const trigger = graph.createNode('FRAME', list.id, { name: 'Trigger', width: 70, height: 20 })
    graph.createNode('TEXT', trigger.id, { name: 'Label', text: label })
    const panel = graph.createNode('FRAME', panels.id, { name: 'Panel', width: 160, height: 40 })
    graph.createNode('TEXT', panel.id, { name: 'Body', text: `${label} settings` })
  }
  graph.updateNode(tabs.id, {
    pluginData: withBehaviour(tabs, {
      ...emptyBehaviour('tabs'),
      parts: { list: 'list', panels: 'panels' }
    })
  })
  return graph
}

/** A collapsible set, open in its `Open=Yes` variant, whose trigger and content `draw` draws. */
function collapsibleSet(
  name: string,
  draw: (graph: SceneGraph, variantId: string, value: string) => void,
  graph?: SceneGraph
): SceneGraph {
  return controlSet(
    name,
    { name: 'Open', values: ['No', 'Yes'] },
    {
      ...emptyBehaviour('collapsible'),
      booleans: { open: { propertyId: 'value', on: 'Yes', off: 'No' } },
      parts: { trigger: 'trigger', content: 'content' }
    },
    draw,
    graph
  )
}

/** A collapsible section whose content holds a switch drawn on, with the switch's set beside it. */
export function sectionGraph(): SceneGraph {
  const graph = switchGraph()
  const on = [...graph.getAllNodes()].find((node) => node.name === 'State=On')
  if (!on) throw new Error('Expected the switch drawn on')
  return collapsibleSet(
    'Section',
    (graph, variantId, value) => {
      graph.updateNode(variantId, { width: 120, height: 60 })
      graph.createNode('FRAME', variantId, {
        name: 'Trigger',
        componentPropertyReferences: slot('trigger'),
        width: 120,
        height: 20
      })
      if (value !== 'Yes') return
      const content = graph.createNode('FRAME', variantId, {
        name: 'Content',
        componentPropertyReferences: slot('content'),
        y: 24,
        width: 120,
        height: 30
      })
      graph.createInstance(on.id, content.id, { name: 'Switch' })
    },
    graph
  )
}

export function disclosureGraph(): SceneGraph {
  return collapsibleSet('Disclosure', (graph, variantId, value) => {
    graph.createNode('FRAME', variantId, {
      name: 'Trigger',
      componentPropertyReferences: slot('trigger'),
      width: 40,
      height: 10
    })
    if (value === 'Yes')
      graph.createNode('FRAME', variantId, {
        name: 'Content',
        componentPropertyReferences: slot('content'),
        y: 12,
        width: 40,
        height: 10,
        fills: fill(0.3, 0.27, 0.9)
      })
  })
}

/** A standalone component with a behaviour, drawn by `draw`. */
function controlComponent(
  name: string,
  behaviour: Behaviour,
  draw: (graph: SceneGraph, componentId: string) => void,
  size: { width: number; height: number }
): SceneGraph {
  const graph = new SceneGraph()
  const component = graph.createNode('COMPONENT', graph.getPages()[0].id, { name, ...size })
  draw(graph, component.id)
  graph.updateNode(component.id, { pluginData: withBehaviour(component, behaviour) })
  return graph
}

/** A slider at 60 of 0 to 100 in steps of 5. */
export function sliderGraph(): SceneGraph {
  return controlComponent(
    'Volume',
    {
      ...emptyBehaviour('slider'),
      parts: { track: 'track-slot', range: 'range-slot', thumb: 'thumb-slot' },
      numbers: { value: { min: 0, max: 100, step: 5, default: 60 } }
    },
    (graph, id) => {
      const track = graph.createNode('FRAME', id, {
        name: 'Track',
        componentPropertyReferences: slot('track-slot'),
        y: 8,
        width: 200,
        height: 4,
        fills: fill(0.8, 0.84, 0.88)
      })
      graph.createNode('FRAME', track.id, {
        name: 'Range',
        componentPropertyReferences: slot('range-slot'),
        width: 120,
        height: 4,
        fills: fill(0.31, 0.27, 0.9)
      })
      graph.createNode('FRAME', id, {
        name: 'Thumb',
        componentPropertyReferences: slot('thumb-slot'),
        x: 110,
        width: 20,
        height: 20,
        fills: fill(1, 1, 1)
      })
    },
    { width: 200, height: 20 }
  )
}

/** A number field at 9 of 1 to 10, between its steppers. */
export function numberFieldGraph(): SceneGraph {
  const graph = controlComponent(
    'Quantity',
    {
      ...emptyBehaviour('numberField'),
      texts: { text: { propertyId: 'count' } },
      parts: { decrement: 'decrement-slot', increment: 'increment-slot' },
      numbers: { value: { min: 1, max: 10, step: 1, default: 9 } }
    },
    (graph, id) => {
      graph.updateNode(id, {
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
        itemSpacing: 8
      })
      const stepper = (name: string, property: string) =>
        graph.createNode('FRAME', id, {
          name,
          componentPropertyReferences: slot(property),
          width: 24,
          height: 24,
          fills: fill(0.8, 0.84, 0.88)
        })
      stepper('Decrement', 'decrement-slot')
      graph.createNode('TEXT', id, {
        name: 'Count',
        text: '9',
        textAutoResize: 'WIDTH_AND_HEIGHT',
        width: 16,
        height: 20,
        componentPropertyReferences: [{ propertyId: 'count', field: 'TEXT' }]
      })
      stepper('Increment', 'increment-slot')
    },
    { width: 100, height: 24 }
  )
  const component = graph.getChildren(graph.getPages()[0].id)[0]
  if (component)
    graph.updateNode(component.id, {
      componentPropertyDefinitions: [
        { id: 'count', name: 'Count', type: 'TEXT', defaultValue: '9' }
      ]
    })
  return graph
}

/** A text field drawn white while empty and grey once filled, its placeholder `Email`. */
export function textFieldGraph(): SceneGraph {
  const graph = controlSet(
    'Email',
    { name: 'Filled', values: ['No', 'Yes'] },
    {
      ...emptyBehaviour('textField'),
      texts: { value: { propertyId: 'email' } },
      booleans: { filled: { propertyId: 'value', on: 'Yes', off: 'No' } }
    },
    (graph, variantId, value) => {
      graph.updateNode(variantId, {
        width: 200,
        height: 32,
        fills: value === 'Yes' ? fill(0.95, 0.96, 0.97) : fill(1, 1, 1)
      })
      graph.createNode('TEXT', variantId, {
        name: 'Value',
        text: value === 'Yes' ? 'ada@example.com' : 'Email',
        componentPropertyReferences: [{ propertyId: 'email', field: 'TEXT' }]
      })
    }
  )
  const set = graph.getChildren(graph.getPages()[0].id)[0]
  if (set)
    graph.updateNode(set.id, {
      componentPropertyDefinitions: [
        ...set.componentPropertyDefinitions,
        { id: 'email', name: 'Email', type: 'TEXT', defaultValue: 'Email' }
      ]
    })
  return graph
}
