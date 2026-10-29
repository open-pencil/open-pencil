import { h, type VNode } from 'vue'

import {
  BUTTON_RESET,
  type ControlModel,
  type ControlRole,
  type DesignElement,
  type DesignNode
} from '@open-pencil/dom-css/export'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { layerPath } from '@open-pencil/scene-graph/behaviours'
import { shaderOfPaint } from '@open-pencil/scene-graph/shaders'

import { wrapRole } from './controls'
import IslandShader from './IslandShader.vue'
import type { IslandState } from './state'

export interface IslandRenderContext {
  /** The island's layers in their current states. */
  graph: SceneGraph
  rootId: string
  controls: ReadonlyMap<string, ControlModel>
  roles: ReadonlyMap<string, ControlRole>
  state: IslandState
}

/** How a role's wrapper changes the element it wraps. */
export interface ElementOverride {
  tag?: string
  style?: Record<string, string | undefined>
  props?: Record<string, unknown>
  /** Style properties the wrapping component sets itself, removed from the design's. */
  omit?: readonly string[]
  children?: () => (VNode | string)[]
}

/** The image a layer's shader fill shows: its first fill's, as the projection reads it. */
function shaderImage(element: DesignElement): string | undefined {
  const node = element.sourceSceneNode
  const fill = node?.fills.at(0)
  return node && fill ? (shaderOfPaint(node, fill)?.image ?? undefined) : undefined
}

/** Render an element as the design draws it, with a role's changes applied. */
export function renderElement(
  context: IslandRenderContext,
  element: DesignElement,
  path: string,
  override: ElementOverride = {}
): VNode {
  // Omitted properties are removed, not cleared: a Reka part that renders through this element
  // sets them, and an `undefined` here would override it.
  const omitted = new Set(override.omit)
  const style = Object.fromEntries(
    Object.entries({
      ...(override.tag === 'button' ? BUTTON_RESET : {}),
      ...element.inlineStyle,
      ...override.style
    }).filter(([key]) => !omitted.has(key))
  )
  const content =
    override.children ?? (() => element.children.map((child) => renderNode(context, child, path)))
  // A shader fill plays behind the content, whatever draws the content, from the canvas's own
  // player for the image its paint shows.
  const image = element.shader ? shaderImage(element) : undefined
  const children = () => [
    ...(image
      ? [h(IslandShader, { key: `${path}\0shader`, image, frame: element.shader?.frame })]
      : []),
    ...content()
  ]
  const { 'data-open-pencil-node-id': _id, ...attrs } = element.attrs
  return h(
    override.tag ?? element.tagName,
    { ...attrs, key: path, 'data-layer': path, style, ...override.props },
    children()
  )
}

/** Render a projected layer: as designed, or as the control it is part of. */
export function renderNode(
  context: IslandRenderContext,
  node: DesignNode,
  parentPath: string
): VNode | string {
  if (node.type === 'text') return node.text
  const path = node.sourceSceneNodeId
    ? layerPath(context.graph, context.rootId, node.sourceSceneNodeId)
    : parentPath
  const role = context.roles.get(path)
  const base = (override?: ElementOverride) => renderElement(context, node, path, override)
  return role ? wrapRole(context, role, node, base) : base()
}
