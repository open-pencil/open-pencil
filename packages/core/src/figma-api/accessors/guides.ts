import type { Guide } from '@figma/plugin-typings/plugin-api-standalone'

import type { SceneNode } from '@open-pencil/scene-graph'
import { newGuideId, type CanvasGuide } from '@open-pencil/scene-graph/guides'

import {
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { invalid, numberProblem, received } from '#core/figma-api/accessors/text/messages'

const METHOD = 'set_guides'

/** The layers Figma keeps guides for; installed on their proxies alone, as Figma has them. */
const GUIDE_OWNER_TYPES: ReadonlySet<SceneNode['type']> = new Set([
  'CANVAS',
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])

function parseGuide(value: unknown, index: number): Guide {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalid(
      METHOD,
      `Expected object, received ${received(value)} at index ${index}`,
      'guides'
    )
  }
  const { axis, offset } = value as { axis?: unknown; offset?: unknown }
  if (axis !== 'X' && axis !== 'Y') {
    throw invalid(METHOD, `Invalid option: expected one of "X"|"Y" at [${index}].axis`, 'guides')
  }
  const problem = numberProblem(offset, ` at [${index}].offset`)
  if (problem) throw invalid(METHOD, problem, 'guides')
  return { axis, offset: offset as number }
}

/**
 * `guides` on pages and frames, as Figma keeps them for each (Figma desktop 126). A guide set at
 * an index that had one keeps that guide's identity, so a saved file updates it in place.
 */
export function installGuideAccessors(
  target: object,
  internals: NodeProxyInternals,
  type: SceneNode['type']
): void {
  if (!GUIDE_OWNER_TYPES.has(type)) return
  Object.defineProperty(target, 'guides', {
    get(this: ProxyThis): readonly Guide[] {
      return Object.freeze(
        raw(this, internals).guides.map((guide) =>
          Object.freeze({ axis: guide.axis === 'x' ? 'X' : 'Y', offset: guide.position } as const)
        )
      )
    },
    set(this: ProxyThis, value: unknown) {
      if (!Array.isArray(value)) {
        throw invalid(METHOD, `Expected array, received ${received(value)}`, 'guides')
      }
      const parsed = value.map(parseGuide)
      const current = raw(this, internals).guides
      const guides = parsed.map(({ axis, offset }, index): CanvasGuide => {
        const { id, figGuid } = current.at(index) ?? { id: newGuideId() }
        return {
          id,
          axis: axis === 'X' ? 'x' : 'y',
          position: offset,
          ...(figGuid ? { figGuid } : {})
        }
      })
      updateNode(this, internals, { guides })
    }
  })
}
