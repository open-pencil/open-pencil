import { ref } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'

import { useColorSpaces } from '#vue/controls/color-model/space'
import type { ColorFieldFormat } from '#vue/controls/color-model/types'
import {
  OKHCL_FIELD_OPTIONS,
  createOkHCLActions,
  createOkHCLFieldFormats,
  createOkHCLPreviewHelpers,
  getFillOkHCLColor,
  getStrokeOkHCLColor
} from '#vue/controls/okhcl/helpers'
import { useEditor } from '#vue/editor/context'

export function useOkHCL() {
  const editor = useEditor()
  const fieldFormats = ref(new Map<string, ColorFieldFormat>())

  const { ensureFillOkHCL, ensureStrokeOkHCL, updateFillOkHCL, updateStrokeOkHCL } =
    createOkHCLActions(editor)
  const spaces = useColorSpaces()
  const { getFillPreviewInfo, getStrokePreviewInfo } = createOkHCLPreviewHelpers(
    editor,
    () => spaces.value.shown
  )
  // The document's own profile, which the paints are stored in whatever a subtree shows; reading
  // the provided spaces first makes a render that calls this follow a change of profile.
  const profile = () => {
    void spaces.value.stored
    return editor.graph.documentColorSpace
  }
  const { getFieldFormat, setFillFieldFormat, setStrokeFieldFormat } = createOkHCLFieldFormats(
    fieldFormats,
    ensureFillOkHCL,
    ensureStrokeOkHCL,
    profile
  )

  return {
    getFillOkHCLColor: (node: SceneNode | null, index: number) =>
      getFillOkHCLColor(node, index, profile()),
    getStrokeOkHCLColor: (node: SceneNode | null, index: number) =>
      getStrokeOkHCLColor(node, index, profile()),
    getFillPreviewInfo,
    getStrokePreviewInfo,
    getFieldFormat,
    setFillFieldFormat,
    setStrokeFieldFormat,
    updateFillOkHCL,
    updateStrokeOkHCL,
    fieldOptions: OKHCL_FIELD_OPTIONS
  }
}
