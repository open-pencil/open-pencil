import type {
  LayoutAlign,
  LayoutCounterAlign,
  LayoutMode,
  LayoutSizing,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'
import { parseAutoLayoutDirection } from '@open-pencil/scene-graph/layout'

import type { PenNode, PenNumber } from './schema'
import { bindIfVar, isVarRef, resolveNumber, type VarContext } from './variables'

const CORNERS = [
  'topLeftRadius',
  'topRightRadius',
  'bottomRightRadius',
  'bottomLeftRadius'
] as const
const PADDING = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const

export function applyCornerRadius(
  node: SceneNode,
  radius: PenNode['cornerRadius'],
  ctx: VarContext
): void {
  if (radius === undefined) return
  if (Array.isArray(radius)) {
    node.independentCorners = true
    for (const [index, field] of CORNERS.entries()) {
      node[field] = resolveNumber(radius[index], ctx)
      bindIfVar(node, field, radius[index], ctx)
    }
    return
  }
  node.cornerRadius = resolveNumber(radius, ctx)
  bindIfVar(node, 'cornerRadius', radius, ctx)
}

/** pen.dev padding: one value, vertical and horizontal, or top, right, bottom, and left. */
function paddingSides(padding: NonNullable<PenNode['padding']>): PenNumber[] {
  if (!Array.isArray(padding)) return [padding, padding, padding, padding]
  if (padding.length === 2) return [padding[0], padding[1], padding[0], padding[1]]
  return padding
}

export function applyPadding(node: SceneNode, padding: PenNode['padding'], ctx: VarContext): void {
  if (padding === undefined) return
  const sides = paddingSides(padding)
  for (const [index, field] of PADDING.entries()) {
    node[field] = resolveNumber(sides[index], ctx)
    bindIfVar(node, field, sides[index], ctx)
  }
}

interface ParsedSize {
  value: number
  sizing: LayoutSizing
  /** Fallback used only when fit_content(N) has no children. */
  fitContentFallback?: number
}

function parseParameterizedFallback(value: string, behavior: string): number | undefined {
  const prefix = `${behavior}(`
  if (!value.startsWith(prefix) || !value.endsWith(')')) return undefined

  const rawFallback = value.slice(prefix.length, -1).trim()
  if (rawFallback === '') return undefined

  const parsedFallback = Number(rawFallback)
  return Number.isFinite(parsedFallback) ? parsedFallback : undefined
}

function parseSizingBehavior(value: string, fallback: number): ParsedSize | undefined {
  if (value === 'fill_container') return { value: fallback, sizing: 'FILL' }
  if (value === 'fit_content') return { value: fallback, sizing: 'HUG' }

  // Older generated .pen files used hug_content as an alias for fit_content.
  if (value === 'hug_content') return { value: fallback, sizing: 'HUG' }

  const fillFallback = parseParameterizedFallback(value, 'fill_container')
  if (fillFallback !== undefined) return { value: fillFallback, sizing: 'FILL' }

  const fitFallback =
    parseParameterizedFallback(value, 'fit_content') ??
    parseParameterizedFallback(value, 'hug_content')
  if (fitFallback !== undefined) {
    return { value: fitFallback, sizing: 'HUG', fitContentFallback: fitFallback }
  }
  return undefined
}

export function parseSize(
  value: number | string | undefined,
  fallback: number,
  ctx?: VarContext
): ParsedSize {
  if (value === undefined) return { value: fallback, sizing: 'FIXED' }
  if (typeof value === 'number') return { value, sizing: 'FIXED' }

  const behavior = parseSizingBehavior(value, fallback)
  if (behavior) return behavior

  if (isVarRef(value) && ctx) return { value: ctx.resolveNumber(value), sizing: 'FIXED' }
  const parsed = Number(value)
  return { value: Number.isFinite(parsed) ? parsed : fallback, sizing: 'FIXED' }
}

export function mapLayoutMode(pen: PenNode): LayoutMode {
  const direction = parseAutoLayoutDirection(pen.layout)
  if (direction) return direction
  return pen.type === 'frame' && pen.layout === undefined ? 'HORIZONTAL' : 'NONE'
}

/** pen.dev's main axis alignments; `space_around` lays out as `start` until {@link spreadAround}. */
const JUSTIFY_CONTENT: Partial<Record<string, LayoutAlign>> = {
  start: 'MIN',
  center: 'CENTER',
  end: 'MAX',
  space_between: 'SPACE_BETWEEN'
}

const ALIGN_ITEMS: Partial<Record<string, LayoutCounterAlign>> = {
  start: 'MIN',
  center: 'CENTER',
  end: 'MAX'
}

export function mapJustifyContent(value: string | undefined): LayoutAlign {
  return JUSTIFY_CONTENT[value ?? 'start'] ?? 'MIN'
}

export function mapAlignItems(value: string | undefined): LayoutCounterAlign {
  return ALIGN_ITEMS[value ?? 'start'] ?? 'MIN'
}

function flowChildren(graph: SceneGraph, frame: SceneNode): SceneNode[] {
  return graph
    .getChildren(frame.id)
    .filter((child) => child.visible && child.layoutPositioning !== 'ABSOLUTE')
}

/**
 * Auto layout has no `space_around`, which gives every child an equal share of the free space,
 * half of it on each side. Once laid out, the share goes into the gap and half of it into the
 * padding at both ends, which draws the same. Returns whether any frame changed.
 */
export function spreadAround(graph: SceneGraph, frameIds: readonly string[]): boolean {
  let changed = false
  for (const id of frameIds) {
    const frame = graph.getNode(id)
    if (!frame || frame.layoutMode === 'NONE' || frame.primaryAxisSizing !== 'FIXED') continue
    const children = flowChildren(graph, frame)
    if (children.length === 0) continue
    const horizontal = frame.layoutMode === 'HORIZONTAL'
    const used = children.reduce(
      (sum, child) => sum + (horizontal ? child.width : child.height),
      frame.itemSpacing * (children.length - 1)
    )
    const free = horizontal
      ? frame.width - frame.paddingLeft - frame.paddingRight - used
      : frame.height - frame.paddingTop - frame.paddingBottom - used
    if (free <= 0) continue
    const share = free / children.length
    if (horizontal) {
      graph.updateNode(frame.id, {
        itemSpacing: frame.itemSpacing + share,
        paddingLeft: frame.paddingLeft + share / 2,
        paddingRight: frame.paddingRight + share / 2
      })
    } else {
      graph.updateNode(frame.id, {
        itemSpacing: frame.itemSpacing + share,
        paddingTop: frame.paddingTop + share / 2,
        paddingBottom: frame.paddingBottom + share / 2
      })
    }
    changed = true
  }
  return changed
}
