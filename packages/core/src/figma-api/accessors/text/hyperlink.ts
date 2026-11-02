import type { HyperlinkTarget, NodeType, SceneGraph } from '@lawha/scene-graph'

import { invalid, received } from './messages'

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
 * empty URL removes the link, as in Figma.
 */
export function hyperlinkTarget(
  method: string,
  value: unknown,
  graph: SceneGraph
): HyperlinkTarget | null {
  if (value === null) return null
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw invalid(method, `Expected object, received ${received(value)}`)
  }
  const target = value as Partial<Record<keyof HyperlinkTarget, unknown>>
  if (!HYPERLINK_TYPES.has(target.type as string)) {
    throw invalid(
      method,
      `Invalid enum value. Expected 'URL' | 'NODE', received '${String(target.type)}' at .type`
    )
  }
  if (typeof target.value !== 'string') {
    throw invalid(method, `Expected string, received ${received(target.value)} at .value`)
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
