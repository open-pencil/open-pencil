import type { SceneNode } from '@open-pencil/scene-graph'
import type { useOkHCL } from '@open-pencil/vue/controls/okhcl'

type OkhclControls = ReturnType<typeof useOkHCL>
type ColorFieldFormat = Parameters<OkhclControls['setFillFieldFormat']>[2]
type OkhclValue = Parameters<OkhclControls['updateFillOkHCL']>[2]
/** Runs a picker's change as part of its paint edit, so a drag's OkHCL changes are one step. */
type PaintEdit = (update: () => void) => void

export function createFillOkhclAdapter(
  okhcl: OkhclControls,
  activeNode: SceneNode | null | undefined,
  index: number,
  edit: PaintEdit
) {
  if (!activeNode) return null
  return {
    fieldFormat: okhcl.getFieldFormat(activeNode, index, 'fill'),
    fieldOptions: okhcl.fieldOptions,
    okhcl: okhcl.getFillOkHCLColor(activeNode, index),
    ...okhcl.getFillPreviewInfo(activeNode, index),
    setFieldFormat: (format: ColorFieldFormat) =>
      okhcl.setFillFieldFormat(activeNode, index, format),
    updateOkHCL: (value: OkhclValue) => edit(() => okhcl.updateFillOkHCL(activeNode, index, value))
  }
}

export function createStrokeOkhclAdapter(
  okhcl: OkhclControls,
  activeNode: SceneNode | null | undefined,
  index: number,
  edit: PaintEdit
) {
  if (!activeNode) return null
  return {
    fieldFormat: okhcl.getFieldFormat(activeNode, index, 'stroke'),
    fieldOptions: okhcl.fieldOptions,
    okhcl: okhcl.getStrokeOkHCLColor(activeNode, index),
    ...okhcl.getStrokePreviewInfo(activeNode, index),
    setFieldFormat: (format: ColorFieldFormat) =>
      okhcl.setStrokeFieldFormat(activeNode, index, format),
    updateOkHCL: (value: OkhclValue) =>
      edit(() => okhcl.updateStrokeOkHCL(activeNode, index, value))
  }
}
