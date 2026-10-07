import { node, type BaseProps, type TreeNode } from '../tree'
import { REKA_ELEMENTS, type BindingProp, type RekaNamespaces } from './index'

/** Props of a Reka element: a frame's, plus the behaviour a root binds and a group item's component. */
export interface RekaProps extends BaseProps {
  modelValue?: BindingProp
  open?: BindingProp
  disabled?: BindingProp
  filled?: BindingProp
  /** The variant property whose values draw rest, hover, pressed, focus, and disabled. */
  states?: string
  min?: number
  max?: number
  step?: number
  defaultValue?: number
  /** For a group's item: the component or set it is an instance of. */
  of?: string
}

type Child = TreeNode | string
export type RekaElement = (props?: RekaProps, ...children: Child[]) => TreeNode

/** One Reka namespace as element functions, such as `Switch.Root` and `Switch.Thumb`. */
function namespace<N extends keyof RekaNamespaces>(name: N) {
  const element =
    (part: string): RekaElement =>
    (props = {}, ...children) =>
      node(`${name}.${part}`, children.length > 0 ? { ...props, children } : props)
  return Object.fromEntries(
    Object.keys(REKA_ELEMENTS[name]).map((part) => [part, element(part)])
  ) as { [P in keyof RekaNamespaces[N]]: RekaElement }
}

export const Button = namespace('Button')
export const Toggle = namespace('Toggle')
export const Switch = namespace('Switch')
export const Checkbox = namespace('Checkbox')
export const RadioGroup = namespace('RadioGroup')
export const ToggleGroup = namespace('ToggleGroup')
export const Slider = namespace('Slider')
export const Progress = namespace('Progress')
export const Tabs = namespace('Tabs')
export const Collapsible = namespace('Collapsible')
export const Accordion = namespace('Accordion')
export const NumberField = namespace('NumberField')
export const TextField = namespace('TextField')
export const Textarea = namespace('Textarea')
