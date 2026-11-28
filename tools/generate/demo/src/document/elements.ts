import { node, type DesignVariable, type TreeNode } from '@open-pencil/design-jsx'

export interface IconProps {
  /** An Iconify name the demo bundles, such as `lucide:play`. */
  name: `lucide:${string}`
  size: number
  /**
   * The icon's color: a variable its paths are bound to, so it follows the tour's modes, or a
   * color of its own, as the deck's icons on solid cards have.
   */
  color: DesignVariable | string
  label?: string
}

/** An icon layer, as `<Icon>` in a design JSX string renders one, its paths painted or bound by `color`. */
export function Icon(props: IconProps): TreeNode {
  return node('icon', { ...props })
}
