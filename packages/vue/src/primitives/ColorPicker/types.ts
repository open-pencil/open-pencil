import type { OkHCLColor, RenderColorSpace } from '@open-pencil/core/color'

export type ColorFieldFormat = 'rgb' | 'hsl' | 'hsb' | 'okhcl'

export interface ColorFieldOption {
  value: ColorFieldFormat
  label: string
}

export interface OkHCLControls {
  fieldFormat: ColorFieldFormat
  fieldOptions: ColorFieldOption[]
  okhcl: OkHCLColor | null
  previewColorSpace?: RenderColorSpace
  clipped?: boolean
  setFieldFormat: (format: ColorFieldFormat) => void
  updateOkHCL: (patch: Partial<OkHCLColor>) => void
}
