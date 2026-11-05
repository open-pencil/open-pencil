import type { ShadrPosition, ShadrRounding, ShadrSize } from './document'

export type ShadrElementType =
  | 'block'
  | 'block_rounded'
  | 'circle'
  | 'gradient'
  | 'blur'
  | 'progress'
  | 'block_sdf'
  | 'text'
  | 'item'
  | 'shader'
  | 'image'
  | 'video'
  | 'hitbox'
  | 'text_input'
  | 'toggle'
  | 'slider'
  | 'grid_block'
  | 'component'

export interface ShadrElement {
  type: ShadrElementType
  id: string
  layer?: number
  position?: ShadrPosition
  size?: ShadrSize
  color?: string
  opacity?: number
  rounding?: ShadrRounding
  interactive?: boolean
  hoverEffect?: string
  clickEffect?: string
  onClickAction?: string[]
  text?: string
  font?: string
  textAlign?: 'left' | 'center' | 'right'
  lineWidth?: number
  direction?: 'row' | 'column'
  gap?: number
  children?: ShadrElement[]
  component?: string
  params?: Record<string, unknown>
  image?: string
  fit?: 'contain' | 'cover' | 'fill'
  outline?: { size: number; color: string }
}

export interface ShadrNodeData {
  blockId?: string
  layer?: number
  interactive?: boolean
  hoverEffect?: string
  clickEffect?: string
  onClickAction?: string[]
  componentName?: string
  componentParams?: Record<string, unknown>
  customFont?: string
}
