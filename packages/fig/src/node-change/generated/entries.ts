import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneNode } from '@open-pencil/scene-graph'

import { cloneRecord } from '../clone'
import { createFillPaints } from '../export/context'
import type { KiwiNodeChange, SceneNodeToKiwiContext } from '../export/context'
import { serializeText } from '../export/text'
import { generatedSlotPath, type GeneratedEntry } from './records'

/**
 * A sublayer as a whole record of `type`: what the user set on it, placed and shaped as Figma
 * derived it, for the reader to turn into a layer.
 */
export function sublayerRecord(
  type: string,
  entry: GeneratedEntry | undefined,
  derived: GeneratedEntry | undefined
): NodeChange {
  const { guidPath: _set, ...fields } = cloneRecord(entry ?? {})
  const record: NodeChange = { ...fields, type }
  if (derived?.size) record.size = cloneRecord(derived.size)
  if (derived?.transform) record.transform = cloneRecord(derived.transform)
  if (derived?.vectorData) record.vectorData = cloneRecord(derived.vectorData)
  if (derived?.derivedTextData) record.derivedTextData = cloneRecord(derived.derivedTextData)
  return record
}

/** A sublayer's size and place in its frame, as a derived entry gives them. */
export function placement(
  node: Pick<SceneNode, 'width' | 'height' | 'x' | 'y'>
): Pick<GeneratedEntry, 'size' | 'transform'> {
  return {
    size: { x: node.width, y: node.height },
    transform: { m00: 1, m01: 0, m02: node.x, m10: 0, m11: 1, m12: node.y }
  }
}

/** A text sublayer's entry, and its placement and glyphs as Figma would derive them. */
export function textSublayer(
  context: SceneNodeToKiwiContext,
  slot: number,
  node: SceneNode
): { entry: GeneratedEntry; derived: GeneratedEntry } {
  const fields: KiwiNodeChange = {}
  serializeText(context, node, fields)
  const { derivedTextData, ...text } = fields
  const entry: GeneratedEntry = {
    ...text,
    guidPath: generatedSlotPath(slot),
    visible: node.visible,
    fillPaints: createFillPaints(context, node)
  }
  const derived: GeneratedEntry = { guidPath: generatedSlotPath(slot), ...placement(node) }
  if (derivedTextData) derived.derivedTextData = derivedTextData
  return { entry, derived }
}

/** Whether a sublayer's derived text can stand in for Figma's: shaped, unless it has no text. */
export function shaped(node: SceneNode, derived: GeneratedEntry): boolean {
  return node.text === '' || (derived.derivedTextData?.glyphs?.length ?? 0) > 0
}
