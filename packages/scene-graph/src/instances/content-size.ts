import { isEqual } from 'es-toolkit/predicate'

import { TEXT_METRIC_FIELDS, TEXT_SHAPING_FIELDS } from '../fields/text'
import type { SceneGraph } from '../graph'
import { layoutSizing } from '../layout/sizing'
import type { Rect } from '../primitives'
import { resizedChildRect } from '../resize'
import type { SceneNode } from '../types'

const METRIC_FIELDS: ReadonlySet<string> = new Set(TEXT_METRIC_FIELDS)

/**
 * The axes along which a copy sizes itself to its own content rather than to its component,
 * judged by the state the copy is about to have.
 */
function contentSizedAxes(
  graph: SceneGraph,
  current: SceneNode,
  source: SceneNode,
  updates: Partial<SceneNode>
): { width: boolean; height: boolean } {
  const copy: SceneNode = { ...current, ...updates }
  // Text measures its own characters and their style, set on the copy or by a property of an
  // instance around it; a copy styled as its component takes the component's measure.
  if (copy.type === 'TEXT') {
    if (TEXT_SHAPING_FIELDS.every((field) => isEqual(copy[field], source[field])))
      return { width: false, height: false }
    const mode = copy.textAutoResize
    return {
      width: mode === 'WIDTH_AND_HEIGHT',
      height: mode === 'WIDTH_AND_HEIGHT' || mode === 'HEIGHT'
    }
  }
  // Auto layout hugs the copy's own layers, which may show or size differently, and a layer
  // that fills its parent takes the size layout gives it there.
  const laidOut = (axis: 'HORIZONTAL' | 'VERTICAL') => {
    const sizing = layoutSizing(graph, copy, axis)
    return sizing === 'FILL' || (sizing === 'HUG' && copy.layoutMode !== 'NONE')
  }
  return { width: laidOut('HORIZONTAL'), height: laidOut('VERTICAL') }
}

/**
 * Keeps a copy's own size along the axes it sizes to its own content, as Figma sizes a badge to
 * its count and the layers it shows rather than to the component's placeholder. Layout measures
 * those axes; the component's size there would be stale.
 */
/** Where synchronization placed a copy, and on which axes the copy keeps that place itself. */
export interface SyncedPlacement {
  placed: Rect
  x: boolean
  y: boolean
}

export function keepOwnContentSize(
  graph: SceneGraph,
  updates: Partial<SceneNode>,
  copy: SceneNode,
  source: SceneNode,
  placement?: SyncedPlacement
): void {
  const axes = contentSizedAxes(graph, copy, source, updates)
  if (axes.width) Reflect.deleteProperty(updates, 'width')
  if (axes.height) Reflect.deleteProperty(updates, 'height')
  if (!placement) return // An instance root keeps its own position.
  const final = { ...copy, ...updates }
  const anchored = resizedChildRect(
    placement.placed,
    final,
    final.horizontalConstraint,
    final.verticalConstraint
  )
  if (placement.x && final.width !== placement.placed.width) updates.x = anchored.x
  if (placement.y && final.height !== placement.placed.height) updates.y = anchored.y
}

/**
 * Drops the size a text copy kept from the file once a metric reaches it from the component, so
 * layout measures its characters again instead of trusting the size Figma saved for the old style.
 */
export function remeasureChangedText(updates: Partial<SceneNode>, copy: SceneNode): void {
  if (copy.type !== 'TEXT' || !copy.derivedLayout) return
  if (Object.keys(updates).some((key) => METRIC_FIELDS.has(key))) updates.derivedLayout = null
}
