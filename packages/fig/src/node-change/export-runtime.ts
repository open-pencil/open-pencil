import type { OutlineCommand } from './path/commands'

export interface FigGlyphOutlineMetric {
  commands: OutlineCommand[]
  x: number
  advance: number
}

export interface FigNodeChangeExportRuntime {
  getGlyphOutlineMetrics(
    family: string,
    style: string,
    text: string,
    fontSize: number
  ): FigGlyphOutlineMetric[] | null
}

export const EMPTY_EXPORT_RUNTIME: FigNodeChangeExportRuntime = {
  getGlyphOutlineMetrics: () => null
}
