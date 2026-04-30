import {
  createGridTrackActions,
  createLayoutActions,
  createLayoutSelectionState,
  createPaddingActions,
  createTrackSizingOptions,
  trackLabel
} from '#vue/controls/layout/helpers'
import { useEditor } from '#vue/editor/context'
import { useI18n } from '#vue/i18n'

/**
 * Returns layout-related state and actions for the current selection.
 *
 * Use this composable to build auto-layout and grid panels that need sizing,
 * padding, alignment, and track editing behavior.
 */
export function useLayout() {
  const editor = useEditor()
  const { panels } = useI18n()

  const {
    node,
    layoutDirection,
    alignGrid,
    isInAutoLayout,
    isGrid,
    isFlex,
    widthSizing,
    heightSizing,
    widthSizingOptions,
    heightSizingOptions
  } = createLayoutSelectionState(editor, panels)

  const {
    showIndividualPadding,
    hasUniformPadding,
    setUniformPadding,
    commitUniformPadding,
    toggleIndividualPadding
  } = createPaddingActions(editor, node)

  const layoutActions = createLayoutActions({ editor, node, isFlex, isInAutoLayout })

  const { updateGridTrack, addTrack, removeTrack } = createGridTrackActions(editor, node)

  return {
    editor,
    node,
    layoutDirection,
    isInAutoLayout,
    isGrid,
    isFlex,
    widthSizing,
    heightSizing,
    widthSizingOptions,
    heightSizingOptions,
    alignGrid,
    showIndividualPadding,
    hasUniformPadding,
    trackSizingOptions: createTrackSizingOptions(panels.value),
    updateProp: layoutActions.updateProp,
    commitProp: layoutActions.commitProp,
    setWidthSizing: layoutActions.setWidthSizing,
    setHeightSizing: layoutActions.setHeightSizing,
    setUniformPadding,
    commitUniformPadding,
    setAlignment: layoutActions.setAlignment,
    setLayoutDirection: layoutActions.setLayoutDirection,
    updateGridTrack,
    addTrack,
    removeTrack,
    trackLabel,
    toggleIndividualPadding
  }
}
