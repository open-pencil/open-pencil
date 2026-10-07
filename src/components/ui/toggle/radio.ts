import type { ComponentUI } from '@/components/ui/types'
import type { RadioGroupTheme } from '@/theme/toggle/radio'

export type AppRadioGroupUI = ComponentUI<RadioGroupTheme>

export interface AppRadioOption<TValue extends string | number> {
  value: TValue
  label: string
  description?: string
  disabled?: boolean
}
