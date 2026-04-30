import type { SceneNode, Stroke } from '@open-pencil/core/scene-graph'
import type { Editor } from '@open-pencil/core/editor'
import type { Ref } from 'vue'

export type StrokeSides = 'ALL' | 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' | 'CUSTOM'

export const SIDE_OPTIONS: { value: StrokeSides; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'TOP', label: 'Top' },
  { value: 'BOTTOM', label: 'Bottom' },
  { value: 'LEFT', label: 'Left' },
  { value: 'RIGHT', label: 'Right' },
  { value: 'CUSTOM', label: 'Custom' }
]

export const BORDER_SIDES = ['top', 'right', 'bottom', 'left'] as const
export const DEFAULT_STROKE: Stroke = {
  color: { r: 0, g: 0, b: 0, a: 1 },
  weight: 1,
  opacity: 1,
  visible: true,
  align: 'CENTER'
}

export function updateAlign(editor: Editor, align: Stroke['align'], activeNode: SceneNode) {
  const strokes = activeNode.strokes.map((s) => ({ ...s, align }))
  editor.updateNodeWithUndo(activeNode.id, { strokes }, 'Change stroke align')
}

export function currentAlign(activeNode: SceneNode | null): Stroke['align'] {
  if (!activeNode || activeNode.strokes.length === 0) return 'CENTER'
  return activeNode.strokes[0].align
}

export function currentSides(activeNode: SceneNode | null): StrokeSides {
  if (!activeNode?.independentStrokeWeights) return 'ALL'
  const { borderTopWeight: t, borderRightWeight: r, borderBottomWeight: b, borderLeftWeight: l } = activeNode
  const active = [t > 0, r > 0, b > 0, l > 0]
  const count = active.filter(Boolean).length
  if (count === 4 && t === r && r === b && b === l) return 'ALL'
  if (count === 1) {
    if (t > 0) return 'TOP'
    if (b > 0) return 'BOTTOM'
    if (l > 0) return 'LEFT'
    if (r > 0) return 'RIGHT'
  }
  return 'CUSTOM'
}

export function createStrokeSideActions(editor: Editor, sideMenuOpen: Ref<boolean>) {
  function selectSide(side: StrokeSides, activeNode: SceneNode) {
    const weight = activeNode.strokes.length > 0 ? activeNode.strokes[0].weight : 1
    if (side === 'ALL') {
      editor.updateNodeWithUndo(
        activeNode.id,
        {
          independentStrokeWeights: false,
          borderTopWeight: 0,
          borderRightWeight: 0,
          borderBottomWeight: 0,
          borderLeftWeight: 0
        } as Partial<SceneNode>,
        'Stroke all sides'
      )
    } else if (side === 'CUSTOM') {
      const w = activeNode.independentStrokeWeights
        ? {
            top: activeNode.borderTopWeight,
            right: activeNode.borderRightWeight,
            bottom: activeNode.borderBottomWeight,
            left: activeNode.borderLeftWeight
          }
        : { top: weight, right: weight, bottom: weight, left: weight }
      editor.updateNodeWithUndo(
        activeNode.id,
        {
          independentStrokeWeights: true,
          borderTopWeight: w.top,
          borderRightWeight: w.right,
          borderBottomWeight: w.bottom,
          borderLeftWeight: w.left
        } as Partial<SceneNode>,
        'Custom stroke sides'
      )
    } else {
      editor.updateNodeWithUndo(
        activeNode.id,
        {
          independentStrokeWeights: true,
          borderTopWeight: side === 'TOP' ? weight : 0,
          borderRightWeight: side === 'RIGHT' ? weight : 0,
          borderBottomWeight: side === 'BOTTOM' ? weight : 0,
          borderLeftWeight: side === 'LEFT' ? weight : 0
        } as Partial<SceneNode>,
        `Stroke ${side.toLowerCase()} only`
      )
    }
    sideMenuOpen.value = false
  }

  function updateBorderWeight(side: (typeof BORDER_SIDES)[number], value: number, activeNode: SceneNode) {
    const key = `border${side[0].toUpperCase()}${side.slice(1)}Weight` as keyof SceneNode
    editor.updateNodeWithUndo(activeNode.id, { [key]: value } as Partial<SceneNode>, 'Change stroke weight')
  }

  return { selectSide, updateBorderWeight }
}
