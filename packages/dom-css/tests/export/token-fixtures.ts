import { SceneGraph, type Fill, type Variable, type VariableValue } from '@open-pencil/scene-graph'

export const BLUE_500 = { r: 0.23, g: 0.51, b: 0.96, a: 1 }
export const BLUE_300 = { r: 0.58, g: 0.77, b: 0.99, a: 1 }

function addVariable(
  graph: SceneGraph,
  collectionId: string,
  id: string,
  name: string,
  type: Variable['type'],
  valuesByMode: Record<string, VariableValue>,
  extra: Partial<Variable> = {}
) {
  graph.addVariable({
    id,
    name,
    type,
    collectionId,
    valuesByMode,
    description: '',
    hiddenFromPublishing: false,
    ...extra
  })
}

/** Primitives, a Theme with Light, Dark and a media-query Contrast mode, and spacing tokens. */
export function designSystem(): SceneGraph {
  const graph = new SceneGraph()
  graph.addCollection({
    id: 'primitives',
    name: 'Primitives',
    modes: [{ modeId: 'base', name: 'Base' }],
    defaultModeId: 'base',
    variableIds: []
  })
  addVariable(graph, 'primitives', 'blue-500', 'Blue/500', 'COLOR', { base: BLUE_500 })
  addVariable(graph, 'primitives', 'blue-300', 'Blue/300', 'COLOR', { base: BLUE_300 })
  graph.addCollection({
    id: 'theme',
    name: 'Theme',
    modes: [
      { modeId: 'light', name: 'Light' },
      { modeId: 'dark', name: 'Dark' },
      { modeId: 'contrast', name: 'Contrast', condition: '@media (prefers-contrast: more)' }
    ],
    defaultModeId: 'light',
    variableIds: []
  })
  addVariable(graph, 'theme', 'primary', 'Primary', 'COLOR', {
    light: { aliasId: 'blue-500' },
    dark: { aliasId: 'blue-300' },
    contrast: { aliasId: 'blue-300' }
  })
  graph.addCollection({
    id: 'space',
    name: 'Space',
    modes: [{ modeId: 'one', name: 'One' }],
    defaultModeId: 'one',
    variableIds: []
  })
  addVariable(graph, 'space', 'gutter', 'Gutter', 'FLOAT', { one: 24 }, { scopes: ['GAP'] })
  addVariable(graph, 'space', 'count', 'Count', 'FLOAT', { one: 24 }, { unit: 'none' })
  return graph
}

function solid(color: typeof BLUE_500): Fill {
  return { type: 'SOLID', visible: true, opacity: color.a, color }
}

/** A frame filled with Primary and padded with Gutter, as the canvas resolves them. */
export function card(graph: SceneGraph, parentId: string, fill: typeof BLUE_500, extra = {}) {
  return graph.createNode('FRAME', parentId, {
    width: 100,
    height: 50,
    fills: [solid(fill)],
    layoutMode: 'VERTICAL',
    paddingTop: 24,
    paddingRight: 24,
    paddingBottom: 24,
    paddingLeft: 24,
    boundVariables: {
      'fills/0/color': 'primary',
      paddingTop: 'gutter',
      paddingRight: 'gutter',
      paddingBottom: 'gutter',
      paddingLeft: 'gutter'
    },
    ...extra
  })
}
