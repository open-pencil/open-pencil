export type ComponentType = (props: Record<string, unknown>) => ReactNode

export type ReactElement = {
  type: string | ComponentType
  props: Record<string, unknown> & { children?: ReactNode[] }
}

export type ReactNode = ReactElement | string | number | null | undefined | ReactNode[]

export type FC<P = Record<string, unknown>> = (props: P) => ReactElement

export function createElement(
  type: string | ComponentType,
  props: Record<string, unknown> | null,
  ...children: ReactNode[]
): ReactElement {
  const flatChildren = children.flat()
  return {
    type,
    props: {
      ...props,
      children: flatChildren.length > 0 ? flatChildren : undefined
    }
  }
}

export default { createElement }
