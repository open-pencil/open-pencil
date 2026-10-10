import { ref } from 'vue'

import { newStrokeGeometry, type Stroke } from '@open-pencil/scene-graph'

import { useNodeProps } from '#vue/controls/node-props/use'
import {
  BORDER_SIDES,
  DEFAULT_STROKE,
  SIDE_OPTIONS,
  borderWeight,
  createStrokeGeometryActions,
  createStrokeGeometryState,
  createStrokeSideActions,
  currentAlign,
  currentSides,
  dashState,
  setDash,
  setGap,
  toggleDash,
  updateAlign,
  type StrokeSides
} from '#vue/controls/stroke/helpers'
import { useEditor } from '#vue/editor/context'
import { useI18n } from '#vue/i18n'

/**
 * Returns stroke-related helpers for property panels.
 *
 * This composable provides alignment and side helpers plus mixed-selection
 * state and undo-aware actions for caps, joins, and miter limits.
 */
export function useStrokeControls() {
  const store = useEditor()
  const { nodes, merged } = useNodeProps()
  const { panels } = useI18n()
  const sideMenuOpen = ref(false)
  const alignOptions = [
    { value: 'INSIDE' as const, label: panels.value.strokeAlignInside },
    { value: 'CENTER' as const, label: panels.value.strokeAlignCenter },
    { value: 'OUTSIDE' as const, label: panels.value.strokeAlignOutside }
  ]
  const capOptions = [
    { value: 'NONE' as const, label: panels.value.strokeCapButt },
    { value: 'ROUND' as const, label: panels.value.strokeCapRound },
    { value: 'SQUARE' as const, label: panels.value.strokeCapSquare },
    { value: 'ARROW_LINES' as const, label: panels.value.strokeCapArrowLines },
    { value: 'ARROW_EQUILATERAL' as const, label: panels.value.strokeCapArrowEquilateral }
  ]
  const joinOptions = [
    { value: 'MITER' as const, label: panels.value.strokeJoinMiter },
    { value: 'BEVEL' as const, label: panels.value.strokeJoinBevel },
    { value: 'ROUND' as const, label: panels.value.strokeJoinRound }
  ]
  const geometryState = createStrokeGeometryState({ nodes, merged })
  const geometryActions = createStrokeGeometryActions(store, nodes)
  const { selectSide, updateBorderWeight } = createStrokeSideActions(store, sideMenuOpen)

  return {
    alignOptions,
    capOptions,
    joinOptions,
    ...geometryState,
    ...geometryActions,
    sideOptions: SIDE_OPTIONS,
    borderSides: BORDER_SIDES,
    sideMenuOpen,
    /** A new stroke for the selection: black, with the weight and alignment its first node keeps. */
    get defaultStroke(): Stroke {
      const first = nodes.value.at(0)
      return { ...DEFAULT_STROKE, ...(first ? newStrokeGeometry(first) : {}) }
    },
    /** Aligns the strokes of every selected node. */
    updateAlign: (align: Stroke['align']) => updateAlign(store, nodes.value, align),
    /** The alignment the selected nodes share, or MIXED. */
    currentAlign: () => currentAlign(nodes.value),
    currentSides,
    dashState,
    toggleDash,
    setDash,
    setGap,
    /** One side's weight across the selection, or MIXED. */
    borderWeight: (side: (typeof BORDER_SIDES)[number]) => borderWeight(nodes.value, side),
    /** Strokes the chosen sides of every selected node. */
    selectSide: (side: StrokeSides) => selectSide(side, nodes.value),
    /** Changes one side's weight on every selected node. */
    updateBorderWeight: (side: (typeof BORDER_SIDES)[number], value: number) =>
      updateBorderWeight(side, value, nodes.value)
  }
}
