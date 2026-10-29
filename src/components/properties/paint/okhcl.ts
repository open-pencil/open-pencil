import type { SceneNode } from '@open-pencil/scene-graph'
import type { useOkHCL } from '@open-pencil/vue/controls/okhcl'

type OkhclControls = ReturnType<typeof useOkHCL>
type ColorFieldFormat = Parameters<OkhclControls['setFillFieldFormat']>[2]
type OkhclValue = Parameters<OkhclControls['updateFillOkHCL']>[2]

export function createFillOkhclAdapter(
  okhcl: OkhclControls,
  activeNode: SceneNode | null | undefined,
  index: number
) {
  if (!activeNode) return null
  return {
    fieldFormat: okhcl.getFieldFormat(activeNode, index, 'fill'),
    fieldOptions: okhcl.fieldOptions,
    okhcl: okhcl.getFillOkHCLColor(activeNode, index),
    ...okhcl.getFillPreviewInfo(activeNode, index),
    setFieldFormat: (format: ColorFieldFormat) =>
      okhcl.setFillFieldFormat(activeNode, index, format),
    updateOkHCL: (value: OkhclValue) => okhcl.updateFillOkHCL(activeNode, index, value)
  }
}

export function createStrokeOkhclAdapter(
  okhcl: OkhclControls,
  activeNode: SceneNode | null | undefined,
  index: number
) {
  if (!activeNode) return null
  return {
    fieldFormat: okhcl.getFieldFormat(activeNode, index, 'stroke'),
    fieldOptions: okhcl.fieldOptions,
    okhcl: okhcl.getStrokeOkHCLColor(activeNode, index),
    ...okhcl.getStrokePreviewInfo(activeNode, index),
    setFieldFormat: (format: ColorFieldFormat) =>
      okhcl.setStrokeFieldFormat(activeNode, index, format),
    updateOkHCL: (value: OkhclValue) => okhcl.updateStrokeOkHCL(activeNode, index, value)
  }
}
