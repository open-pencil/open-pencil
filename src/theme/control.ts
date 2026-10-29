export type ControlSize = 'xs' | 'sm' | 'md' | 'lg'

export const controlHeight = {
  xs: 'h-6',
  sm: 'h-7',
  md: 'h-8',
  lg: 'h-9'
} satisfies Record<ControlSize, string>

export const squareControlSize = {
  xs: 'size-6',
  sm: 'size-7',
  md: 'size-8',
  lg: 'size-9'
} satisfies Record<ControlSize, string>
