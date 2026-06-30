import type { Color } from '@open-pencil/scene-graph/primitives'

export interface ColorUsageEntry {
  hex: string
  color: Color
  count: number
  variableName: string | null
}
