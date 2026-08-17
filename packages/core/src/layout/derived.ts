import type { SceneNode } from '@open-pencil/scene-graph'

export function usesDetachedDerivedLayout(child: SceneNode): boolean {
  const derived = child.derivedLayout
  if (!derived || child.layoutMode === 'NONE' || child.layoutGrow > 0) return false
  const isRow = child.layoutMode === 'HORIZONTAL'
  const widthSizing = isRow ? child.primaryAxisSizing : child.counterAxisSizing
  const heightSizing = isRow ? child.counterAxisSizing : child.primaryAxisSizing
  return (
    (widthSizing === 'HUG' && derived.width !== undefined) ||
    (heightSizing === 'HUG' && derived.height !== undefined)
  )
}
