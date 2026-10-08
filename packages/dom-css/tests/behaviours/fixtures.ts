import { emptyBehaviour, SceneGraph, withBehaviour, type Behaviour } from '@open-pencil/scene-graph'

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
  skip: (values: Record<string, string>) => boolean = () => false
) {
  const graph = new SceneGraph()
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

export function switchSet() {
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
    }
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
export function toggleSet() {
  return componentSet(
    'Toggle',
    { Pressed: ['No', 'Yes'] },
    {
      ...emptyBehaviour('toggle'),
      booleans: { value: { propertyId: 'pressed', on: 'Yes', off: 'No' } }
    },
    (graph, variant, { Pressed }) => {
      graph.createNode('TEXT', variant, { name: 'Label', text: Pressed === 'Yes' ? 'On' : 'Off' })
    }
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

/** A collapsible whose content shows only when open. */
export function collapsibleSet() {
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
    }
  )
}
