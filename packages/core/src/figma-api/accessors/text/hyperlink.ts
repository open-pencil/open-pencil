import * as v from 'valibot'

import type { HyperlinkTarget, NodeType, SceneGraph } from '@open-pencil/scene-graph'

import { parseFigma } from '#core/figma-api/validation'

/** Figma's `HyperlinkTarget`, or null to remove a link; Figma checks a value against both. */
const hyperlinkSchema = v.union([
  v.strictObject({ type: v.picklist(['URL', 'NODE']), value: v.string() }),
  v.null()
])

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
  const target = parseFigma(hyperlinkSchema, value, method, property)
  if (target === null) return null
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
