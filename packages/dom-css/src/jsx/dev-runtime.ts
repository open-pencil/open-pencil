import { jsx, type JSXElementProps, type JSXTag } from './runtime'

export { Fragment } from './runtime'
export type * from './runtime'

export function jsxDEV(tag: JSXTag, props: JSXElementProps = {}) {
  return jsx(tag, props)
}
