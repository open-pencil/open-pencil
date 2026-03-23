import { ref } from 'vue'

import { useEditor } from '../context/editorContext'

import type { SceneNode, Stroke } from '@open-pencil/core'

type StrokeSides = 'ALL' | 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' | 'CUSTOM'

const ALIGN_OPTIONS: { value: Stroke['align']; label: string }[] = [
  { value: 'INSIDE', label: 'Inside' },
  { value: 'CENTER', label: 'Center' },
  { value: 'OUTSIDE', label: 'Outside' }
]

const SIDE_OPTIONS: { value: StrokeSides; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'TOP', label: 'Top' },
  { value: 'BOTTOM', label: 'Bottom' },
  { value: 'LEFT', label: 'Left' },
  { value: 'RIGHT', label: 'Right' },
  { value: 'CUSTOM', label: 'Custom' }
]

const BORDER_SIDES = ['top', 'right', 'bottom', 'left'] as const
const DEFAULT_STROKE: Stroke = {
  color: { r: 0, g: 0, b: 0, a: 1 },
  weight: 1,
  opacity: 1,
  visible: true,
  align: 'CENTER'
}

export function useStrokeControls() {
  const store = useEditor()
  const sideMenuOpen = ref(false)

  function updateAlign(align: Stroke['align'], activeNode: SceneNode) {
    const strokes = activeNode.strokes.map((s) => ({ ...s, align }))
    store.updateNodeWithUndo(activeNode.id, { strokes }, 'Change stroke align')
  }

  function currentAlign(activeNode: SceneNode | null): Stroke['align'] {
    if (!activeNode || activeNode.strokes.length === 0) return 'CENTER'
    return activeNode.strokes[0].align
  }

  function currentSides(activeNode: SceneNode | null): StrokeSides {
    if (!activeNode?.independentStrokeWeights) return 'ALL'
    const {
      borderTopWeight: t,
      borderRightWeight: r,
      borderBottomWeight: b,
      borderLeftWeight: l
    } = activeNode
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

  function selectSide(side: StrokeSides, activeNode: SceneNode) {
    const weight = activeNode.strokes.length > 0 ? activeNode.strokes[0].weight : 1
    if (side === 'ALL') {
      store.updateNodeWithUndo(
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
      store.updateNodeWithUndo(
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
      store.updateNodeWithUndo(
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

  function updateBorderWeight(
    side: (typeof BORDER_SIDES)[number],
    value: number,
    activeNode: SceneNode
  ) {
    const key = `border${side[0].toUpperCase()}${side.slice(1)}Weight` as keyof SceneNode
    store.updateNodeWithUndo(
      activeNode.id,
      { [key]: value } as Partial<SceneNode>,
      'Change stroke weight'
    )
  }

  return {
    alignOptions: ALIGN_OPTIONS,
    sideOptions: SIDE_OPTIONS,
    borderSides: BORDER_SIDES,
    sideMenuOpen,
    defaultStroke: DEFAULT_STROKE,
    updateAlign,
    currentAlign,
    currentSides,
    selectSide,
    updateBorderWeight
  }
}
