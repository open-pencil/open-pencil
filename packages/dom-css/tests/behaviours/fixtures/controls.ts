import { SceneGraph } from '@open-pencil/scene-graph'
import { emptyBehaviour } from '@open-pencil/scene-graph/behaviours'
import { withIcon } from '@open-pencil/scene-graph/icons'

import { COLORS, componentSet, slot, withTextProperty } from './sets'

/** A switch on and off, hovered and disabled, its thumb in a slot. */
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

/**
 * A checkbox as the shadcn/ui kit draws one: one State property for focus, disabled, and
 * invalid, which shows a red border.
 */
export function invalidCheckboxSet() {
  return componentSet(
    'Checkbox',
    { Checked: ['Off', 'On'], State: ['Default', 'Focus', 'Disabled', 'Invalid'] },
    {
      ...emptyBehaviour('checkbox'),
      booleans: { value: { propertyId: 'checked', on: 'On', off: 'Off' } },
      states: {
        propertyId: 'state',
        rest: 'Default',
        focus: 'Focus',
        disabled: 'Disabled',
        invalid: 'Invalid'
      }
    },
    (graph, variant, { Checked, State }) => {
      const border = { Focus: COLORS.hover, Invalid: COLORS.error }[State] ?? COLORS.off
      graph.updateNode(variant, {
        fills: Checked === 'On' ? COLORS.on : COLORS.white,
        strokes: border.map((paint) => ({ ...paint, weight: 1, align: 'INSIDE' as const })),
        opacity: State === 'Disabled' ? 0.5 : 1
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
  return withTextProperty(fixture.graph, fixture.set, {
    id: 'label',
    name: 'Label',
    defaultValue: 'Save'
  })
}

/** A switch set in `graph`, and its variant drawn on at rest, which other sets instance. */
function switchDrawnOn(graph: SceneGraph) {
  const toggle = switchSet(graph)
  const on = graph
    .getChildren(toggle.set.id)
    .find((variant) => variant.name === 'State=On, Interaction=Default')
  if (!on) throw new Error('Expected the switch drawn on')
  return { toggle, on }
}

/**
 * A collapsible section whose trigger holds an icon and a label and whose content, shown only
 * when open, holds a switch drawn on, with the switch's own set in the same document, so the
 * section's component can use the switch's rather than draw it.
 */
export function settingsSectionSet() {
  const graph = new SceneGraph()
  const { toggle, on } = switchDrawnOn(graph)
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
  const { on } = switchDrawnOn(graph)
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

/** A collapsible whose content shows only when open. */
export function collapsibleSet(graph?: SceneGraph) {
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
