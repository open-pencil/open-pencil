import type { Guide } from '@figma/plugin-typings/plugin-api-standalone'
import * as v from 'valibot'

import type { SceneNode } from '@open-pencil/scene-graph'
import { newGuideId, type CanvasGuide } from '@open-pencil/scene-graph/guides'

import {
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { finiteNumberSchema } from '#core/figma-api/schema'
import { parseFigma } from '#core/figma-api/validation'

/** The layers Figma keeps guides for; installed on their proxies alone, as Figma has them. */
const GUIDE_OWNER_TYPES: ReadonlySet<SceneNode['type']> = new Set([
  'CANVAS',
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])

/** Figma's `Guide`: an axis and an offset along it. */
const guidesSchema = v.array(
  v.strictObject({ axis: v.picklist(['X', 'Y']), offset: finiteNumberSchema })
)

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
      const parsed = parseFigma(guidesSchema, value, 'set_guides', 'guides')
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
