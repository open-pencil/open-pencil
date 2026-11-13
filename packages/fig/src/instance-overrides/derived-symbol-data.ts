import type { InstanceOccurrence } from './occurrence/types'
import type { DerivedSymbolOverride } from './types'

/** Copy one saved occurrence-derived record onto its target; a cache, not a claim. */
export function applyDerivedEntry(target: InstanceOccurrence, entry: DerivedSymbolOverride): void {
  const props = target.properties
  if (entry.derivedTextData) props.derivedTextData = structuredClone(entry.derivedTextData)
  if (entry.fontSize !== undefined) props.fontSize = entry.fontSize
  if (entry.lineHeight !== undefined) props.lineHeight = structuredClone(entry.lineHeight)
  if (entry.letterSpacing !== undefined) props.letterSpacing = structuredClone(entry.letterSpacing)
  if (entry.size) {
    props.size = structuredClone(entry.size)
    target.derivedSize = structuredClone(entry.size)
  }
  if (entry.transform) props.transform = structuredClone(entry.transform)
  // These are Kiwi geometry records with blob indexes, not SceneGraph geometry arrays.
  const { fillGeometry, strokeGeometry, vectorData } = entry
  if (fillGeometry) {
    props.fillGeometry = structuredClone(fillGeometry)
    if (target.inheritedOutlineScale) target.inheritedOutlineScale.fill = { x: 1, y: 1 }
  }
  if (strokeGeometry) {
    props.strokeGeometry = structuredClone(strokeGeometry)
    if (target.inheritedOutlineScale) target.inheritedOutlineScale.stroke = { x: 1, y: 1 }
  }
  if (vectorData) props.vectorData = structuredClone(vectorData)
}
