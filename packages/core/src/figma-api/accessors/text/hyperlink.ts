import type { HyperlinkTarget, NodeType, SceneGraph } from '@open-pencil/scene-graph'

import { invalid, invalidOption, noneMatched, received } from './messages'

const HYPERLINK_TYPES = new Set(['URL', 'NODE'])

/**
 * URLs Figma links to: web addresses with a host, in lower case and without surrounding space,
 * and mail and phone links. Measured in live Figma (2026-10-11).
 */
const LINK_URL = /^(?:https?:\/\/[^\s/?#]+\S*|mailto:\S+|tel:\S+)$/

/** Layers a link may lead to, which Figma frames in view: containers and pages. */
const LINK_TARGETS = new Set<NodeType>([
  'CANVAS',
  'FRAME',
  'SECTION',
  'GROUP',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])

/**
 * A link Figma takes: a URL it supports or a layer it can show, or `null` to remove one. An
 * empty URL removes the link, as in Figma. Figma names the value `hyperlink` in the range
 * method's messages and `value` in the node setter's.
 */
export function hyperlinkTarget(
  method: string,
  value: unknown,
  graph: SceneGraph,
  property: string
): HyperlinkTarget | null {
  if (value === null) return null
  // Figma checks a link against a target and against null, and reports both.
  const refuse: (problem: string) => never = (problem) => {
    throw invalid(
      method,
      noneMatched([problem, `Expected null, received ${received(value)}`]),
      property
    )
  }
  if (typeof value !== 'object' || Array.isArray(value))
    refuse(`Expected object, received ${received(value)}`)
  const target = value as Partial<Record<keyof HyperlinkTarget, unknown>>
  if (!HYPERLINK_TYPES.has(target.type as string))
    refuse(invalidOption(HYPERLINK_TYPES, ' at .type'))
  if (typeof target.value !== 'string') {
    refuse(`Expected string, received ${received(target.value)} at .value`)
  }
  if (target.type === 'URL') {
    if (target.value === '') return null
    if (!LINK_URL.test(target.value)) {
      throw new Error(`in ${method}: Unsupported or invalid hyperlink url`)
    }
    return { type: 'URL', value: target.value }
  }
  const layer = graph.getNode(target.value)
  if (!layer || !LINK_TARGETS.has(layer.type)) {
    throw new Error(`in ${method}: Invalid hyperlink target node specified`)
  }
  return { type: 'NODE', value: target.value }
}
