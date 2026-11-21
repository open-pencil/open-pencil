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
  const profile = () => editor.graph.documentColorSpace
  const { getFieldFormat, setFillFieldFormat, setStrokeFieldFormat } = createOkHCLFieldFormats(
    fieldFormats,
    ensureFillOkHCL,
    ensureStrokeOkHCL
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
