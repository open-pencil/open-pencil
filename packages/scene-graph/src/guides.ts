import type { GUID } from './primitives'

export interface CanvasGuide {
  id: string
  axis: 'x' | 'y'
  position: number
  figGuid?: GUID
}
