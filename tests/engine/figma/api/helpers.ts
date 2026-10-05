import { FigmaAPI, SceneGraph } from '@open-pencil/core'
import type { FigmaNodeProxy } from '@open-pencil/core'
import type { Color, Fill, Stroke } from '@open-pencil/scene-graph'

export function createAPI(): FigmaAPI {
  return new FigmaAPI(new SceneGraph())
}

/**
 * Reads a proxy through Figma's `InstanceNode` surface. The proxy installs the instance accessors
 * on its prototype but only the node types in `figma-api/node-types` spell them out, so a proxy
 * handed back by `createInstance()` or `wrapNode()` needs the node type naming them.
 */
export function asInstanceNode(node: FigmaNodeProxy): FigmaNodeProxy & InstanceNode {
  return node as FigmaNodeProxy & InstanceNode
}

/** The text counterpart of {@link asInstanceNode}. */
export function asTextNode(node: FigmaNodeProxy): FigmaNodeProxy & TextNode {
  return node as FigmaNodeProxy & TextNode
}

/**
 * The component counterpart of {@link asInstanceNode}, which also names the node a rejection path
 * is handed when the runtime guard, not the type, is what the test exercises.
 */
export function asComponentNode(node: FigmaNodeProxy): FigmaNodeProxy & ComponentNode {
  return node as FigmaNodeProxy & ComponentNode
}

/**
 * Names `api.currentPage` as a page. The boolean-operation entry points only take Figma's node
 * types, while the current-page proxy is typed by its selection alone.
 */
export function asPageNode(
  page: FigmaNodeProxy & { selection: FigmaNodeProxy[] }
): FigmaNodeProxy & PageNode {
  return page as FigmaNodeProxy & PageNode
}

/**
 * A solid paint that satisfies both the OpenPencil `Fill` and the Figma `SolidPaint` shape, as the
 * node proxies expose the intersection of the two.
 */
export function solidFill(
  color: Color,
  overrides: { opacity?: number; visible?: boolean } = {}
): Fill & SolidPaint {
  return {
    type: 'SOLID',
    color,
    opacity: overrides.opacity ?? 1,
    visible: overrides.visible ?? true
  }
}

/** The stroke counterpart of {@link solidFill}. */
export function solidStroke(
  color: Color,
  stroke: { weight: number; align: Stroke['align']; opacity?: number; visible?: boolean }
): Stroke & SolidPaint {
  return {
    ...solidFill(color, stroke),
    weight: stroke.weight,
    align: stroke.align
  }
}
