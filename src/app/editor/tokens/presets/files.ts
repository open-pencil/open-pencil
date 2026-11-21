import type { DesignTokenSourceFile } from '@open-pencil/core/io/formats/design-tokens'

import { bootstrapTokenFiles } from './bootstrap/index'
import type { TokenPreset } from './index'
import { tailwindTokenFiles } from './tailwind/index'

const PRESET_FILES: Record<TokenPreset, () => DesignTokenSourceFile[]> = {
  tailwind: tailwindTokenFiles,
  bootstrap: bootstrapTokenFiles
}

/** A preset as the design token files an import reads. */
export function tokenPresetFiles(preset: TokenPreset): DesignTokenSourceFile[] {
  return PRESET_FILES[preset]()
}
