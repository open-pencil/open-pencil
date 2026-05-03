import {
  BORDER_SIDES,
  DEFAULT_STROKE,
  SIDE_OPTIONS,
  createStrokeSideActions,
  currentAlign,
  currentSides,
  updateAlign
} from '#vue/controls/stroke/helpers'
import { useEditor } from '#vue/editor/context'
import { useI18n } from '#vue/i18n'
import { ref } from 'vue'

/**
 * Returns stroke-related helpers for property panels.
 *
 * This composable provides alignment options, side presets, a default stroke,
 * and helpers for per-side border weight editing.
 */
export function useStrokeControls() {
  const store = useEditor()
  const { panels } = useI18n()
  const sideMenuOpen = ref(false)
  const alignOptions = [
    { value: 'INSIDE' as const, label: panels.value.strokeAlignInside },
    { value: 'CENTER' as const, label: panels.value.strokeAlignCenter },
    { value: 'OUTSIDE' as const, label: panels.value.strokeAlignOutside }
  ]
  const { selectSide, updateBorderWeight } = createStrokeSideActions(store, sideMenuOpen)

  return {
    alignOptions,
    sideOptions: SIDE_OPTIONS,
    borderSides: BORDER_SIDES,
    sideMenuOpen,
    defaultStroke: DEFAULT_STROKE,
    updateAlign: updateAlign.bind(null, store),
    currentAlign,
    currentSides,
    selectSide,
    updateBorderWeight
  }
}
