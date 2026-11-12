import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { withBehaviour, type Behaviour } from '@open-pencil/scene-graph/behaviours'

/** A visible, opaque solid fill in unit RGB. */
export const solid = (r: number, g: number, b: number) => [
  { type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }
]

/** The fills the fixtures draw with: off and on, hovered, white, and an error red. */
export const COLORS = {
  off: solid(0.8, 0.84, 0.88),
  on: solid(0.31, 0.27, 0.9),
  hover: solid(0.72, 0.77, 0.84),
  white: solid(1, 1, 1),
  error: solid(0.86, 0.15, 0.15)
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

/** A layer reference that puts it in the slot `propertyId`. */
export const slot = (propertyId: string) => [{ propertyId, field: 'SLOT_CONTENT' as const }]

/** A standalone component with a behaviour, its layers drawn by `draw`. */
export function standalone(
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

/**
 * Adds a text property to a component or set's definitions, returning the fixture with the
 * set as the graph now holds it.
 */
export function withTextProperty(
  graph: SceneGraph,
  set: SceneNode,
  property: { id: string; name: string; defaultValue: string }
) {
  graph.updateNode(set.id, {
    componentPropertyDefinitions: [
      ...set.componentPropertyDefinitions,
      { ...property, type: 'TEXT' }
    ]
  })
  return { graph, set: graph.getNode(set.id) ?? set }
}
