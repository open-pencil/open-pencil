import {
  emptyBehaviour,
  SceneGraph,
  withBehaviour,
  withIcon,
  type Behaviour,
  type SceneNode
} from '@open-pencil/scene-graph'

const solid = (r: number, g: number, b: number) => [
  { type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }
]

export const COLORS = {
  off: solid(0.8, 0.84, 0.88),
  on: solid(0.31, 0.27, 0.9),
  hover: solid(0.72, 0.77, 0.84),
  white: solid(1, 1, 1)
}

/** A component set whose variants are built by `draw` for each combination of `axes`. */
export function componentSet(
  name: string,
  axes: Record<string, string[]>,
  behaviour: Behaviour,
  draw: (graph: SceneGraph, variant: string, values: Record<string, string>) => void,
  skip: (values: Record<string, string>) => boolean = () => false,
  graph = new SceneGraph()
) {
  const pageId = graph.getPages()[0].id
  const set = graph.createNode('COMPONENT_SET', pageId, {
    name,
    componentPropertyDefinitions: Object.entries(axes).map(([axis, options]) => ({
      id: axis.toLowerCase(),
      name: axis,
      type: 'VARIANT' as const,
      defaultValue: options[0] ?? '',
      variantOptions: options
    }))
  })
  const combos = Object.entries(axes).reduce<Record<string, string>[]>(
    (all, [axis, options]) =>
      all.flatMap((combo) => options.map((value) => ({ ...combo, [axis]: value }))),
    [{}]
  )
  for (const values of combos) {
    if (skip(values)) continue
    const variant = graph.createNode('COMPONENT', set.id, {
      name: Object.entries(values)
        .map(([axis, value]) => `${axis}=${value}`)
        .join(', '),
      componentPropertyValues: values,
      width: 40,
      height: 22
    })
    draw(graph, variant.id, values)
  }
  graph.updateNode(set.id, { pluginData: withBehaviour(set, behaviour) })
  return { graph, set: graph.getNode(set.id) ?? set }
}

export function switchSet(graph?: SceneGraph) {
  return componentSet(
    'Switch',
    { State: ['Off', 'On'], Interaction: ['Default', 'Hover', 'Disabled'] },
    {
      ...emptyBehaviour('switch'),
      booleans: { value: { propertyId: 'state', on: 'On', off: 'Off' } },
      states: { propertyId: 'interaction', rest: 'Default', hover: 'Hover', disabled: 'Disabled' },
      parts: { thumb: 'thumb-slot' }
    },
    (graph, variant, { State, Interaction }) => {
      const offFills = Interaction === 'Hover' ? COLORS.hover : COLORS.off
      const fills = State === 'On' ? COLORS.on : offFills
      graph.updateNode(variant, { fills, opacity: Interaction === 'Disabled' ? 0.5 : 1 })
      graph.createNode('FRAME', variant, {
        name: 'Thumb',
        componentPropertyReferences: [{ propertyId: 'thumb-slot', field: 'SLOT_CONTENT' }],
        x: State === 'On' ? 20 : 2,
        y: 2,
        width: 18,
        height: 18,
        fills: COLORS.white
      })
    },
    undefined,
    graph
  )
}

/** A checkbox whose indicator exists only when checked. */
export function checkboxSet() {
  return componentSet(
    'Checkbox',
    { Checked: ['Off', 'On'] },
    {
      ...emptyBehaviour('checkbox'),
      booleans: { value: { propertyId: 'checked', on: 'On', off: 'Off' } }
    },
    (graph, variant, { Checked }) => {
      graph.updateNode(variant, { fills: COLORS.white })
      if (Checked === 'On')
        graph.createNode('FRAME', variant, {
          name: 'Indicator',
          x: 4,
          y: 4,
          width: 10,
          height: 10,
          fills: COLORS.on
        })
    }
  )
}

/** A toggle whose label reads differently when pressed. */
export function toggleSet(graph?: SceneGraph) {
  return componentSet(
    'Toggle',
    { Pressed: ['No', 'Yes'] },
    {
      ...emptyBehaviour('toggle'),
      booleans: { value: { propertyId: 'pressed', on: 'Yes', off: 'No' } }
    },
    (graph, variant, { Pressed }) => {
      graph.createNode('TEXT', variant, { name: 'Label', text: Pressed === 'Yes' ? 'On' : 'Off' })
    },
    undefined,
    graph
  )
}

/** A button with sizes, drawn hovered only at its small size. */
export function buttonSet() {
  return componentSet(
    'Button',
    { Size: ['Small', 'Large'], Interaction: ['Default', 'Hover'] },
    {
      ...emptyBehaviour('button'),
      states: { propertyId: 'interaction', rest: 'Default', hover: 'Hover' }
    },
    (graph, variant, { Size, Interaction }) => {
      graph.updateNode(variant, {
        width: Size === 'Large' ? 160 : 80,
        fills: Interaction === 'Hover' ? COLORS.hover : COLORS.off
      })
    },
    ({ Size, Interaction }) => Size === 'Large' && Interaction === 'Hover'
  )
}

/** A button whose label is a text property, drawn by a text layer in every variant. */
export function labelledButtonSet() {
  const fixture = componentSet(
    'Action',
    { Interaction: ['Default', 'Hover'] },
    {
      ...emptyBehaviour('button'),
      states: { propertyId: 'interaction', rest: 'Default', hover: 'Hover' }
    },
    (graph, variant, { Interaction }) => {
      graph.updateNode(variant, { fills: Interaction === 'Hover' ? COLORS.hover : COLORS.off })
      graph.createNode('TEXT', variant, {
        name: 'Label',
        text: 'Save',
        componentPropertyReferences: [{ propertyId: 'label', field: 'TEXT' }]
      })
    }
  )
  const { graph, set } = fixture
  graph.updateNode(set.id, {
    componentPropertyDefinitions: [
      ...set.componentPropertyDefinitions,
      { id: 'label', name: 'Label', type: 'TEXT', defaultValue: 'Save' }
    ]
  })
  return { graph, set: graph.getNode(set.id) ?? set }
}

/**
 * A collapsible section whose trigger holds an icon and a label and whose content, shown only
 * when open, holds a switch drawn on, with the switch's own set in the same document, so the
 * section's component can use the switch's rather than draw it.
 */
export function settingsSectionSet() {
  const graph = new SceneGraph()
  const toggle = switchSet(graph)
  const on = graph
    .getChildren(toggle.set.id)
    .find((variant) => variant.name === 'State=On, Interaction=Default')
  if (!on) throw new Error('Expected the switch drawn on')
  const slot = (propertyId: string) => [{ propertyId, field: 'SLOT_CONTENT' as const }]
  const section = componentSet(
    'Section',
    { Open: ['No', 'Yes'] },
    {
      ...emptyBehaviour('collapsible'),
      booleans: { open: { propertyId: 'open', on: 'Yes', off: 'No' } },
      parts: { trigger: 'trigger-slot', content: 'content-slot' }
    },
    (graph, variant, { Open }) => {
      graph.updateNode(variant, { width: 160, height: 60 })
      const trigger = graph.createNode('FRAME', variant, {
        name: 'Trigger',
        componentPropertyReferences: slot('trigger-slot'),
        width: 160,
        height: 20
      })
      const icon = graph.createNode('FRAME', trigger.id, { name: 'bell', width: 16, height: 16 })
      graph.updateNode(icon.id, { pluginData: withIcon(icon, { name: 'lucide:bell' }) })
      graph.createNode('VECTOR', icon.id, { name: 'path', width: 16, height: 16 })
      graph.createNode('TEXT', trigger.id, { name: 'Title', text: 'Notifications', x: 20 })
      if (Open !== 'Yes') return
      const content = graph.createNode('FRAME', variant, {
        name: 'Content',
        componentPropertyReferences: slot('content-slot'),
        y: 24,
        width: 160,
        height: 30
      })
      graph.createInstance(on.id, content.id, { name: 'Switch' })
    },
    undefined,
    graph
  )
  return { graph, set: section.set, switchSet: toggle.set }
}

/**
 * A toggle that draws a plain badge while off and, at the same place and name, the switch drawn
 * on while pressed, with the switch's own set in the same document.
 */
export function badgeToggleSet() {
  const graph = new SceneGraph()
  const toggle = switchSet(graph)
  const on = graph
    .getChildren(toggle.set.id)
    .find((variant) => variant.name === 'State=On, Interaction=Default')
  if (!on) throw new Error('Expected the switch drawn on')
  const alert = componentSet(
    'Alert',
    { Pressed: ['No', 'Yes'] },
    {
      ...emptyBehaviour('toggle'),
      booleans: { value: { propertyId: 'pressed', on: 'Yes', off: 'No' } }
    },
    (graph, variant, { Pressed }) => {
      graph.updateNode(variant, { width: 80, height: 30 })
      if (Pressed === 'Yes') graph.createInstance(on.id, variant, { name: 'Badge' })
      else
        graph.createNode('FRAME', variant, {
          name: 'Badge',
          width: 20,
          height: 20,
          fills: COLORS.off
        })
    },
    undefined,
    graph
  )
  return { graph, set: alert.set }
}

/**
 * Tabs as a standalone component, as design JSX's `Tabs.Root` builds them: a list of triggers
 * and a panel per trigger, each labelled.
 */
export function tabsComponent() {
  const graph = new SceneGraph()
  const slot = (propertyId: string) => [{ propertyId, field: 'SLOT_CONTENT' as const }]
  const tabs = graph.createNode('COMPONENT', graph.getPages()[0].id, {
    name: 'Settings',
    width: 200,
    height: 120
  })
  const list = graph.createNode('FRAME', tabs.id, {
    name: 'List',
    componentPropertyReferences: slot('list-slot'),
    width: 200,
    height: 24
  })
  const panels = graph.createNode('FRAME', tabs.id, {
    name: 'Panels',
    componentPropertyReferences: slot('panels-slot'),
    y: 30,
    width: 200,
    height: 80
  })
  for (const [index, label] of ['Account', 'Password'].entries()) {
    const trigger = graph.createNode('FRAME', list.id, {
      name: 'Trigger',
      x: index * 90,
      width: 80,
      height: 24,
      fills: index === 0 ? COLORS.on : COLORS.off
    })
    graph.createNode('TEXT', trigger.id, { name: 'Label', text: label })
    // Only the first tab's panel shows as designed, as design JSX draws tabs.
    const panel = graph.createNode('FRAME', panels.id, {
      name: 'Panel',
      width: 200,
      height: 80,
      visible: index === 0
    })
    graph.createNode('TEXT', panel.id, { name: 'Body', text: `${label} settings` })
  }
  graph.updateNode(tabs.id, {
    pluginData: withBehaviour(tabs, {
      ...emptyBehaviour('tabs'),
      parts: { list: 'list-slot', panels: 'panels-slot' }
    })
  })
  return { graph, set: graph.getNode(tabs.id) ?? tabs }
}

/**
 * A group as design JSX builds one: a standalone component with the group's behaviour whose
 * items slot holds instances of `item`, each labelled through the item's text property, with
 * the item at `chosen` drawn on.
 */
function groupComponent(
  graph: SceneGraph,
  item: { set: SceneNode; on: string; off: string },
  kind: 'radioGroup' | 'toggleGroup' | 'accordion',
  labels: string[],
  chosen: number | null
) {
  const variant = (value: string) =>
    graph.getChildren(item.set.id).find((child) => child.name.includes(value))
  const on = variant(item.on)
  const off = variant(item.off)
  if (!on || !off) throw new Error('Expected the item drawn on and off')
  const group = graph.createNode('COMPONENT', graph.getPages()[0].id, {
    name: 'Plan',
    width: 200,
    height: 120
  })
  const items = graph.createNode('FRAME', group.id, {
    name: 'Items',
    componentPropertyReferences: [{ propertyId: 'items-slot', field: 'SLOT_CONTENT' }],
    width: 200,
    height: 120
  })
  for (const [index, label] of labels.entries()) {
    const instance = graph.createInstance(index === chosen ? on.id : off.id, items.id, {
      name: 'Item',
      y: index * 30
    })
    if (!instance) throw new Error('Expected the item placed')
    graph.updateNode(instance.id, {
      componentPropertyAssignments: { ...instance.componentPropertyAssignments, label }
    })
    const relabel = (id: string) => {
      for (const child of graph.getChildren(id)) {
        if (child.type === 'TEXT') graph.updateNode(child.id, { text: label })
        relabel(child.id)
      }
    }
    relabel(instance.id)
  }
  graph.updateNode(group.id, {
    pluginData: withBehaviour(group, { ...emptyBehaviour(kind), parts: { items: 'items-slot' } })
  })
  return { graph, set: graph.getNode(group.id) ?? group }
}

/** Gives a set a text property and a label layer in every variant bound to it. */
function labelled(graph: SceneGraph, set: SceneNode) {
  graph.updateNode(set.id, {
    componentPropertyDefinitions: [
      ...set.componentPropertyDefinitions,
      { id: 'label', name: 'Label', type: 'TEXT', defaultValue: 'Option' }
    ]
  })
  for (const variant of graph.getChildren(set.id))
    graph.createNode('TEXT', variant.id, {
      name: 'Label',
      text: 'Option',
      x: 24,
      componentPropertyReferences: [{ propertyId: 'label', field: 'TEXT' }]
    })
}

/** A radio group of three labelled radios, the second chosen. */
export function radioGroupComponent() {
  const graph = new SceneGraph()
  const radio = componentSet(
    'Radio',
    { Checked: ['Off', 'On'] },
    {
      ...emptyBehaviour('radio'),
      booleans: { value: { propertyId: 'checked', on: 'On', off: 'Off' } }
    },
    (graph, variant, { Checked }) => {
      graph.updateNode(variant, { width: 120, height: 20 })
      graph.createNode('FRAME', variant, {
        name: 'Dot',
        width: 16,
        height: 16,
        fills: Checked === 'On' ? COLORS.on : COLORS.off
      })
    },
    undefined,
    graph
  )
  labelled(graph, radio.set)
  return groupComponent(
    graph,
    { set: graph.getNode(radio.set.id) ?? radio.set, on: 'On', off: 'Off' },
    'radioGroup',
    ['Basic', 'Pro', 'Team'],
    1
  )
}

/**
 * A toggle group of the standalone toggle, which a document can also use on its own, the
 * first chosen.
 */
export function toggleGroupComponent() {
  const graph = new SceneGraph()
  const { set } = toggleSet(graph)
  labelled(graph, set)
  return groupComponent(
    graph,
    { set: graph.getNode(set.id) ?? set, on: 'Yes', off: 'No' },
    'toggleGroup',
    ['Left', 'Center'],
    0
  )
}

/** An accordion of two collapsible items, none open. */
export function accordionComponent() {
  const graph = new SceneGraph()
  const { set } = collapsibleSet(graph)
  labelled(graph, set)
  return groupComponent(
    graph,
    { set: graph.getNode(set.id) ?? set, on: 'Yes', off: 'No' },
    'accordion',
    ['Billing', 'Usage'],
    null
  )
}

/** A collapsible whose content shows only when open. */
export function collapsibleSet(graph?: SceneGraph) {
  const slot = (propertyId: string) => [{ propertyId, field: 'SLOT_CONTENT' as const }]
  return componentSet(
    'Disclosure',
    { Open: ['No', 'Yes'] },
    {
      ...emptyBehaviour('collapsible'),
      booleans: { open: { propertyId: 'open', on: 'Yes', off: 'No' } },
      parts: { trigger: 'trigger-slot', content: 'content-slot' }
    },
    (graph, variant, { Open }) => {
      const trigger = graph.createNode('FRAME', variant, {
        name: 'Trigger',
        componentPropertyReferences: slot('trigger-slot'),
        width: 40,
        height: 10
      })
      graph.createNode('TEXT', trigger.id, { name: 'Title', text: 'Details' })
      if (Open === 'Yes')
        graph.createNode('FRAME', variant, {
          name: 'Content',
          componentPropertyReferences: slot('content-slot'),
          y: 12,
          width: 40,
          height: 10
        })
    },
    undefined,
    graph
  )
}

const slot = (propertyId: string) => [{ propertyId, field: 'SLOT_CONTENT' as const }]

/** A standalone component with a behaviour, its layers drawn by `draw`. */
function standalone(
  name: string,
  behaviour: Behaviour,
  draw: (graph: SceneGraph, component: SceneNode) => void,
  size: { width: number; height: number }
) {
  const graph = new SceneGraph()
  const component = graph.createNode('COMPONENT', graph.getPages()[0].id, { name, ...size })
  draw(graph, component)
  graph.updateNode(component.id, { pluginData: withBehaviour(component, behaviour) })
  return { graph, set: graph.getNode(component.id) ?? component }
}

/** A slider at 60 of 0 to 100 in steps of 5: a track holding its range, and a thumb. */
export function sliderComponent() {
  return standalone(
    'Volume',
    {
      ...emptyBehaviour('slider'),
      parts: { track: 'track-slot', range: 'range-slot', thumb: 'thumb-slot' },
      numbers: { value: { min: 0, max: 100, step: 5, default: 60 } }
    },
    (graph, slider) => {
      const track = graph.createNode('FRAME', slider.id, {
        name: 'Track',
        componentPropertyReferences: slot('track-slot'),
        y: 8,
        width: 200,
        height: 4,
        fills: COLORS.off
      })
      graph.createNode('FRAME', track.id, {
        name: 'Range',
        componentPropertyReferences: slot('range-slot'),
        width: 120,
        height: 4,
        fills: COLORS.on
      })
      graph.createNode('FRAME', slider.id, {
        name: 'Thumb',
        componentPropertyReferences: slot('thumb-slot'),
        x: 110,
        width: 20,
        height: 20,
        fills: COLORS.white
      })
    },
    { width: 200, height: 20 }
  )
}

/** A progress bar at 50 of 0 to 200, its indicator inside its track. */
export function progressComponent() {
  return standalone(
    'Upload',
    {
      ...emptyBehaviour('progress'),
      parts: { track: 'track-slot', indicator: 'indicator-slot' },
      numbers: { value: { min: 0, max: 200, step: 1, default: 50 } }
    },
    (graph, progress) => {
      const track = graph.createNode('FRAME', progress.id, {
        name: 'Track',
        componentPropertyReferences: slot('track-slot'),
        width: 200,
        height: 8,
        fills: COLORS.off
      })
      graph.createNode('FRAME', track.id, {
        name: 'Indicator',
        componentPropertyReferences: slot('indicator-slot'),
        width: 50,
        height: 8,
        fills: COLORS.on
      })
    },
    { width: 200, height: 8 }
  )
}

/** A number field at 2 of 1 to 10 between its decrement and increment, hugging them. */
export function numberFieldComponent() {
  const fixture = standalone(
    'Quantity',
    {
      ...emptyBehaviour('numberField'),
      texts: { text: { propertyId: 'count' } },
      parts: { decrement: 'decrement-slot', increment: 'increment-slot' },
      numbers: { value: { min: 1, max: 10, step: 1, default: 2 } }
    },
    (graph, field) => {
      graph.updateNode(field.id, {
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
        itemSpacing: 8
      })
      const stepper = (name: string, property: string) =>
        graph.createNode('FRAME', field.id, {
          name,
          componentPropertyReferences: slot(property),
          width: 24,
          height: 24,
          fills: COLORS.off
        })
      stepper('Decrement', 'decrement-slot')
      graph.createNode('TEXT', field.id, {
        name: 'Count',
        text: '2',
        componentPropertyReferences: [{ propertyId: 'count', field: 'TEXT' }]
      })
      stepper('Increment', 'increment-slot')
    },
    { width: 80, height: 24 }
  )
  fixture.graph.updateNode(fixture.set.id, {
    componentPropertyDefinitions: [{ id: 'count', name: 'Count', type: 'TEXT', defaultValue: '2' }]
  })
  return { graph: fixture.graph, set: fixture.graph.getNode(fixture.set.id) ?? fixture.set }
}

const INK = solid(0.07, 0.09, 0.15)
const MUTED = solid(0.61, 0.64, 0.69)

/**
 * A text field drawn empty, its placeholder in a muted color, and filled, its words in ink, its
 * text bound to an Email property whose words are the placeholder.
 */
export function textFieldSet() {
  const fixture = componentSet(
    'Email',
    { Filled: ['No', 'Yes'] },
    {
      ...emptyBehaviour('textField'),
      texts: { value: { propertyId: 'email' } },
      booleans: { filled: { propertyId: 'filled', on: 'Yes', off: 'No' } }
    },
    (graph, variant, { Filled }) => {
      graph.updateNode(variant, { width: 240, height: 36, strokes: [] })
      graph.createNode('TEXT', variant, {
        name: 'Value',
        text: Filled === 'Yes' ? 'ada@example.com' : 'Email',
        fills: Filled === 'Yes' ? INK : MUTED,
        componentPropertyReferences: [{ propertyId: 'email', field: 'TEXT' }]
      })
    }
  )
  const { graph, set } = fixture
  graph.updateNode(set.id, {
    componentPropertyDefinitions: [
      ...set.componentPropertyDefinitions,
      { id: 'email', name: 'Email', type: 'TEXT', defaultValue: 'Email' }
    ]
  })
  return { graph, set: graph.getNode(set.id) ?? set }
}

/** A textarea starting with its words, with nothing drawn empty. */
export function textareaComponent() {
  const fixture = standalone(
    'Message',
    { ...emptyBehaviour('textarea'), texts: { value: { propertyId: 'message' } } },
    (graph, field) => {
      graph.createNode('TEXT', field.id, {
        name: 'Value',
        text: 'Tell us more',
        componentPropertyReferences: [{ propertyId: 'message', field: 'TEXT' }]
      })
    },
    { width: 240, height: 80 }
  )
  fixture.graph.updateNode(fixture.set.id, {
    componentPropertyDefinitions: [
      { id: 'message', name: 'Message', type: 'TEXT', defaultValue: 'Tell us more' }
    ]
  })
  return { graph: fixture.graph, set: fixture.graph.getNode(fixture.set.id) ?? fixture.set }
}
