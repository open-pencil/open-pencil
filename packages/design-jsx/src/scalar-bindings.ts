import type { SceneGraph } from '@open-pencil/scene-graph'

import { isVariable, resolveVariableId } from './vars'

// Shorthands precede their longhands, matching propsToOverrides precedence.
const PADDING_FIELDS = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
const SCALAR_PROPS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['w', ['width']],
  ['h', ['height']],
  ['p', PADDING_FIELDS],
  ['px', ['paddingLeft', 'paddingRight']],
  ['py', ['paddingTop', 'paddingBottom']],
  ['pt', ['paddingTop']],
  ['pr', ['paddingRight']],
  ['pb', ['paddingBottom']],
  ['pl', ['paddingLeft']],
  ['rounded', ['cornerRadius']],
  ['roundedTL', ['topLeftRadius']],
  ['roundedTR', ['topRightRadius']],
  ['roundedBL', ['bottomLeftRadius']],
  ['roundedBR', ['bottomRightRadius']],
  ['strokeWidth', ['strokeWeight']],
  ['opacity', ['opacity']]
]

/** Resolve numeric props before sizing inference; retain real graph bindings afterward. */
export function prepareScalarBindings(
  graph: SceneGraph,
  props: Record<string, unknown>,
  bindings: Record<string, string>,
  isText: boolean,
  parentId: string
): void {
  const entries = [...SCALAR_PROPS]
  const scalarBindings = new Map<string, string>()
  if (props.grid) {
    // Existing grid authoring gives gap precedence over the axis-specific props.
    entries.push(
      ['columnGap', ['gridColumnGap']],
      ['rowGap', ['gridRowGap']],
      ['gap', ['gridColumnGap', 'gridRowGap']]
    )
  } else {
    entries.push(['gap', ['itemSpacing']])
    if (props.wrap) entries.push(['rowGap', ['counterAxisSpacing']])
  }
  if (isText) {
    entries.push(
      [props.size !== undefined ? 'size' : 'fontSize', ['fontSize']],
      ['lineHeight', ['lineHeight']],
      ['letterSpacing', ['letterSpacing']]
    )
  }

  for (const [key, fields] of entries) {
    const value = props[key]
    if (value === undefined) continue
    // A literal longhand must also override a bound shorthand on that edge.
    for (const field of fields) scalarBindings.delete(field)
    if (!isVariable(value)) continue

    const variableId = resolveVariableId(graph, value)
    const variable = variableId ? graph.variables.get(variableId) : undefined
    if (variable?.type !== 'FLOAT') {
      throw new Error(`Expected a FLOAT variable for ${key}: ${value.name}`)
    }
    const resolved =
      graph.resolveNumberVariableForNode(parentId, variable.id) ??
      (typeof value.value === 'number' ? value.value : undefined)
    if (resolved === undefined || !Number.isFinite(resolved)) {
      throw new Error(`Cannot resolve numeric variable for ${key}: ${value.name}`)
    }
    props[key] = resolved
    for (const field of fields) scalarBindings.set(field, variable.id)
  }
  Object.assign(bindings, Object.fromEntries(scalarBindings))
}
