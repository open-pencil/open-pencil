import type { SceneNode } from '@open-pencil/core/scene-graph'
import type { useOkHCL } from '@open-pencil/vue'

type OkhclControls = ReturnType<typeof useOkHCL>
type FillFieldFormat = Parameters<OkhclControls['setFillFieldFormat']>[2]
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
    setFieldFormat: (format: FillFieldFormat) =>
      okhcl.setFillFieldFormat(activeNode, index, format),
    updateOkHCL: (value: OkhclValue) => okhcl.updateFillOkHCL(activeNode, index, value)
  }
}
