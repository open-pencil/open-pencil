import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { emptyBehaviour, withBehaviour } from '@open-pencil/scene-graph/behaviours'

import { collapsibleSet, toggleSet } from './controls'
import { COLORS, componentSet, slot, withTextProperty } from './sets'

/** A Settings component holding a list slot above a panels slot, as tabs draw them. */
function tabsLayout(graph: SceneGraph, { y, width }: { y: number; width: number }) {
  const tabs = graph.createNode('COMPONENT', graph.getPages()[0].id, {
    name: 'Settings',
    y,
    width,
    height: 120
  })
  const list = graph.createNode('FRAME', tabs.id, {
    name: 'List',
    componentPropertyReferences: slot('list-slot'),
    width,
    height: 24
  })
  const panels = graph.createNode('FRAME', tabs.id, {
    name: 'Panels',
    componentPropertyReferences: slot('panels-slot'),
    y: 30,
    width,
    height: 80
  })
  return { tabs, list, panels }
}

/** Gives `tabs` the tabs behaviour over its list and panels, returning it as the graph has it. */
function asTabs(graph: SceneGraph, tabs: SceneNode) {
  graph.updateNode(tabs.id, {
    pluginData: withBehaviour(tabs, {
      ...emptyBehaviour('tabs'),
      parts: { list: 'list-slot', panels: 'panels-slot' }
    })
  })
  return graph.getNode(tabs.id) ?? tabs
}

/**
 * Tabs as a standalone component, as design JSX's `Tabs.Root` builds them: a list of triggers
 * and a panel per trigger, each labelled.
 */
export function tabsComponent() {
  const graph = new SceneGraph()
  const { tabs, list, panels } = tabsLayout(graph, { y: 0, width: 200 })
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
  return { graph, set: asTabs(graph, tabs) }
}

/**
 * Tabs whose triggers are instances of a Tab set, as the shadcn/ui kit draws them: the set
 * draws Selected On and Off and a disabled look, and the list holds Account (selected),
 * Password, and Billing (drawn disabled), each with a panel.
 */
export function tabsOfTabSets() {
  const graph = new SceneGraph()
  const { set: tab } = componentSet(
    'Tab',
    { Selected: ['Off', 'On'], State: ['Default', 'Disabled'] },
    {
      ...emptyBehaviour('tab'),
      booleans: { value: { propertyId: 'selected', on: 'On', off: 'Off' } },
      states: { propertyId: 'state', rest: 'Default', disabled: 'Disabled' }
    },
    (graph, variant, { Selected, State }) =>
      graph.updateNode(variant, {
        width: 80,
        height: 24,
        fills: Selected === 'On' ? COLORS.on : COLORS.off,
        opacity: State === 'Disabled' ? 0.5 : 1
      }),
    ({ Selected, State }) => Selected === 'On' && State === 'Disabled',
    graph
  )
  const variant = (values: string) =>
    graph.getChildren(tab.id).find((child) => child.name === values)
  const { tabs, list, panels } = tabsLayout(graph, { y: 100, width: 260 })
  const triggers = [
    ['Account', 'Selected=On, State=Default'],
    ['Password', 'Selected=Off, State=Default'],
    ['Billing', 'Selected=Off, State=Disabled']
  ] as const
  for (const [index, [label, values]] of triggers.entries()) {
    const main = variant(values)
    if (!main) throw new Error(`No ${values} variant`)
    graph.createInstance(main.id, list.id, { name: label, x: index * 86 })
    graph.createNode('FRAME', panels.id, {
      name: `${label} panel`,
      width: 260,
      height: 80,
      visible: index === 0
    })
  }
  return { graph, tab: graph.getNode(tab.id) ?? tab, set: asTabs(graph, tabs) }
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
  withTextProperty(graph, set, { id: 'label', name: 'Label', defaultValue: 'Option' })
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
