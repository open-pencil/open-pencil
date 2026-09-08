import {
  buttonTheme,
  type ButtonColor,
  type ButtonShape,
  type ButtonSize,
  type ButtonVariant
} from '@open-pencil/ui'

export type AppButtonColor = ButtonColor
export type AppButtonVariant = ButtonVariant
export type AppButtonSize = ButtonSize
export type AppButtonShape = ButtonShape

export function useAppButtonUI(options?: {
  color?: AppButtonColor
  variant?: AppButtonVariant
  size?: AppButtonSize
  shape?: AppButtonShape
  ui?: { base?: string; icon?: string }
}) {
  const styles = buttonTheme(options)
  return {
    base: styles.base({ class: options?.ui?.base }),
    icon: styles.icon({ class: options?.ui?.icon })
  }
}
