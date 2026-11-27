/**
 * How shadcn/ui's props read as the variants of the kit's sets, which the page draws its sets
 * with and the kit's examples mark their instances with, so both name a variant alike.
 */
import type { KitInstance, KitInstances, KitState } from '../kit'

export const STATES: KitState[] = ['Default', 'Hover', 'Focus', 'Disabled']
export const OFF_ON = ['Off', 'On'] as const

/** shadcn's prop values as the variants' values read: `sm` is Small, `ghost` is Ghost. */
const NAMES: Record<string, string> = { sm: 'Small', lg: 'Large' }
export const named = (value: string) => NAMES[value] ?? `${value[0].toUpperCase()}${value.slice(1)}`

export const BUTTON_STYLES = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link']
export const BUTTON_SIZES = ['default', 'sm', 'lg']
export const TOGGLE_STYLES = ['default', 'outline']
export const BADGE_STYLES = ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link']
export const AVATAR_SIZES = ['sm', 'default', 'lg']
export const ALERT_STYLES = ['default', 'destructive']

type Props = Record<string, unknown>

/** A prop that is one of `values`, or `fallback` when the use leaves it out; null otherwise. */
function oneOf(props: Props, prop: string, values: readonly string[], fallback = 'default') {
  const value = props[prop] ?? fallback
  return typeof value === 'string' && values.includes(value) ? value : null
}

/** The state a use is drawn in: Disabled when it is disabled, else at rest. */
const state = (props: Props): KitState => (props.disabled === true ? 'Disabled' : 'Default')

/** Whether a use is on: checked or pressed, as a value or as it starts. */
const on = (props: Props, value: string, initial: string) =>
  (props[value] ?? props[initial]) === true ? 'On' : 'Off'

/** A use the set draws no variant of: invalid, or composed with a child of its own. */
const unlike = (props: Props) => props['aria-invalid'] === true || props.asChild === true

function instance(of: string, variant: Record<string, string> | null): KitInstance | null {
  return variant ? { of, variant } : null
}

export const INSTANCES: KitInstances = {
  button: {
    Button: (props) => {
      const style = oneOf(props, 'variant', BUTTON_STYLES)
      const size = oneOf(props, 'size', BUTTON_SIZES)
      if (!style || !size || unlike(props)) return null
      return instance('Button', { Variant: named(style), Size: named(size), State: state(props) })
    }
  },
  badge: {
    Badge: (props) => {
      const style = oneOf(props, 'variant', BADGE_STYLES)
      return style && !unlike(props) ? instance('Badge', { Variant: named(style) }) : null
    }
  },
  switch: {
    Switch: (props) =>
      oneOf(props, 'size', ['default']) && !unlike(props)
        ? instance('Switch', {
            Checked: on(props, 'checked', 'defaultChecked'),
            State: state(props)
          })
        : null
  },
  checkbox: {
    Checkbox: (props) =>
      unlike(props)
        ? null
        : instance('Checkbox', {
            Checked: on(props, 'checked', 'defaultChecked'),
            State: state(props)
          })
  },
  toggle: {
    Toggle: (props) => {
      const style = oneOf(props, 'variant', TOGGLE_STYLES)
      if (!style || !oneOf(props, 'size', ['default']) || unlike(props)) return null
      return instance('Toggle', {
        Variant: named(style),
        Pressed: on(props, 'pressed', 'defaultPressed'),
        State: state(props)
      })
    }
  },
  input: {
    Input: (props) =>
      oneOf(props, 'type', ['text', 'email', 'password', 'search'], 'text') && !unlike(props)
        ? instance('Input', { State: state(props) })
        : null
  },
  textarea: {
    Textarea: (props) => (unlike(props) ? null : instance('Textarea', { State: state(props) }))
  },
  label: { Label: () => instance('Label', { Type: 'Default' }) },
  kbd: { Kbd: () => instance('Kbd', { Type: 'Default' }) },
  avatar: {
    Avatar: (props) => {
      const size = oneOf(props, 'size', AVATAR_SIZES)
      return size ? instance('Avatar', { Size: named(size) }) : null
    }
  },
  alert: {
    Alert: (props) => {
      const style = oneOf(props, 'variant', ALERT_STYLES)
      return style ? instance('Alert', { Variant: named(style) }) : null
    }
  }
}
