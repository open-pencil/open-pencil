import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import {
  nodeId,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import type { FigmaFontName } from '#core/figma-api/fonts'
import { getFontName, setFontName } from '#core/figma-api/text'

function graph(target: ProxyThis, internals: NodeProxyInternals): SceneGraph {
  return target[internals.graph] as SceneGraph
}

/** Getter/setter pair for a text property stored verbatim on the node. */
function field<Field extends keyof SceneNode>(internals: NodeProxyInternals, name: Field) {
  return {
    get(this: ProxyThis): SceneNode[Field] {
      return raw(this, internals)[name]
    },
    set(this: ProxyThis, value: SceneNode[Field]) {
      updateNode(this, internals, { [name]: value } as Partial<SceneNode>)
    }
  }
}

export function installTextNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals
): void {
  Object.defineProperties(prototype, {
    characters: {
      get(this: ProxyThis): string {
        return raw(this, internals).text
      },
      set(this: ProxyThis, value: string) {
        updateNode(this, internals, { text: value })
      }
    },
    fontName: {
      get(this: ProxyThis): FigmaFontName {
        return getFontName(raw(this, internals))
      },
      set(this: ProxyThis, value: FigmaFontName) {
        setFontName(graph(this, internals), nodeId(this, internals), value)
      }
    },
    fontSize: field(internals, 'fontSize'),
    fontWeight: field(internals, 'fontWeight'),
    textAlignHorizontal: field(internals, 'textAlignHorizontal'),
    textAlignVertical: field(internals, 'textAlignVertical'),
    textDirection: field(internals, 'textDirection'),
    textAutoResize: field(internals, 'textAutoResize'),
    letterSpacing: field(internals, 'letterSpacing'),
    lineHeight: field(internals, 'lineHeight'),
    textCase: field(internals, 'textCase'),
    textDecoration: field(internals, 'textDecoration'),
    maxLines: field(internals, 'maxLines'),
    textTruncation: field(internals, 'textTruncation'),
    autoRename: field(internals, 'autoRename')
  })
}
