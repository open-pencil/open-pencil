import { node, type DesignVariable, type TreeNode } from '@open-pencil/design-jsx'

export interface IconProps {
  /** An Iconify name the demo bundles, such as `lucide:play`. */
  name: `lucide:${string}`
  size: number
  /** The variable the icon's paths are bound to, so the icon follows the tour's modes. */
  color: DesignVariable
  label?: string
}

/** An icon layer, as `<Icon>` in a design JSX string renders one, its paths bound to `color`. */
export function Icon(props: IconProps): TreeNode {
  return node('icon', { ...props })
}
