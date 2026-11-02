import { upperFirst } from 'es-toolkit/string'

import type { SceneNode, SharedStyleKind } from '@open-pencil/scene-graph'
import { sharedStyleRefKey } from '@open-pencil/scene-graph/shared-styles'

import {
  graph,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { invalid, received } from '#core/figma-api/accessors/text/messages'
import { STYLE_NOT_FOUND, styleChanges } from '#core/figma-api/styles/apply'
import { getTextStyle } from '#core/figma-api/text/style'

/** Layers with frames' layout guides, which a grid style gives. */
const GRID_STYLE_TYPES = new Set<SceneNode['type']>([
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])

/** The kinds of style a layer of `type` takes, as Figma's node types have them. */
function styleKinds(type: SceneNode['type'], isDocument: boolean): SharedStyleKind[] {
  if (isDocument || type === 'CANVAS') return []
  const kinds: SharedStyleKind[] = type === 'GROUP' ? [] : ['fill', 'stroke']
  kinds.push('effect')
  if (GRID_STYLE_TYPES.has(type)) kinds.push('grid')
  if (type === 'TEXT') kinds.push('text')
  return kinds
}

/** Gives `target` the style, or refuses it, as the setter named `method` does. */
function applyStyle(
  target: ProxyThis,
  internals: NodeProxyInternals,
  kind: SharedStyleKind,
  styleId: string,
  refusal: string
): void {
  const changes = styleChanges(graph(target, internals), raw(target, internals), kind, styleId)
  if (!changes) throw new Error(refusal)
  updateNode(target, internals, changes)
}

function styleMembers(internals: NodeProxyInternals, kind: SharedStyleKind, mixed: symbol) {
  const field = sharedStyleRefKey(kind)
  return {
    [field]: {
      get(this: ProxyThis): string | symbol {
        const node = raw(this, internals)
        // Characters of a text can each use a text or fill style of their own.
        if (node.type === 'TEXT' && (kind === 'text' || kind === 'fill')) {
          return getTextStyle(node, kind === 'text' ? 'textStyleId' : 'fillStyleId', mixed) as
            | string
            | symbol
        }
        return node[field] ?? ''
      },
      set(this: ProxyThis, value: unknown) {
        const method = `set_${field}`
        if (typeof value !== 'string') {
          throw invalid(method, `Expected string, received ${received(value)}`, field)
        }
        applyStyle(this, internals, kind, value, `in ${method}: ${STYLE_NOT_FOUND}`)
      }
    },
    // Figma takes anything but a string without a word, and rejects a style it cannot find.
    [`set${upperFirst(field)}Async`]: {
      async value(this: ProxyThis, value: unknown): Promise<void> {
        if (typeof value === 'string') applyStyle(this, internals, kind, value, STYLE_NOT_FOUND)
      }
    }
  }
}

/**
 * The style references of a layer: `fillStyleId`, `strokeStyleId`, `effectStyleId`,
 * `gridStyleId`, and `textStyleId`, each with its async setter, on the layers Figma has them on
 * (Figma desktop 126). Setting one gives the layer the style's values; an empty ID takes the
 * style off and keeps them.
 */
export function installStyleReferenceAccessors(
  target: object,
  internals: NodeProxyInternals,
  type: SceneNode['type'],
  isDocument: boolean,
  mixed: symbol
): void {
  for (const kind of styleKinds(type, isDocument))
    Object.defineProperties(target, styleMembers(internals, kind, mixed))
  if (isDocument || !GRID_STYLE_TYPES.has(type)) return
  // Figma's deprecated name for a frame's fill style.
  Object.defineProperty(target, 'backgroundStyleId', {
    get(this: ProxyThis): string {
      return raw(this, internals).fillStyleId ?? ''
    },
    set(this: ProxyThis, value: unknown) {
      const method = 'set_backgroundStyleId'
      if (typeof value !== 'string') {
        throw invalid(method, `Expected string, received ${received(value)}`, 'backgroundStyleId')
      }
      applyStyle(this, internals, 'fill', value, `in ${method}: ${STYLE_NOT_FOUND}`)
    }
  })
}
