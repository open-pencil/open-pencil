import {
  angularGradient,
  backgroundBlur,
  diamondGradient,
  dropShadow,
  foregroundBlur,
  gradient,
  innerShadow,
  layerBlur,
  linearGradient,
  radialGradient,
  solid,
  type TreeNode
} from '@open-pencil/core/design-jsx'

import type { DesignJSXHelperDescriptor } from '@/app/code/sandbox/types'

const HELPERS = {
  solid,
  gradient,
  linearGradient,
  radialGradient,
  angularGradient,
  diamondGradient,
  dropShadow,
  innerShadow,
  layerBlur,
  backgroundBlur,
  foregroundBlur
}

type HelperName = keyof typeof HELPERS

type PlainRecord = { [key: string]: unknown }

function isRecord(value: unknown): value is PlainRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isHelper(value: unknown): value is DesignJSXHelperDescriptor {
  return (
    isRecord(value) && typeof value.__openPencilHelper === 'string' && Array.isArray(value.args)
  )
}

function convertValue(value: unknown): unknown {
  if (isHelper(value)) {
    if (!(value.__openPencilHelper in HELPERS)) {
      throw new Error(`Unknown Design JSX helper "${value.__openPencilHelper}".`)
    }
    const helper = HELPERS[value.__openPencilHelper as HelperName] as (
      ...args: unknown[]
    ) => unknown
    return helper(...value.args.map(convertValue))
  }
  if (Array.isArray(value)) return value.map(convertValue)
  if (isRecord(value))
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convertValue(v)]))
  return value
}

function convertTree(value: unknown): TreeNode {
  if (!isRecord(value) || typeof value.type !== 'string' || !isRecord(value.props)) {
    throw new Error('Design JSX must return an OpenPencil element.')
  }
  if (!Array.isArray(value.children))
    throw new Error('Design JSX element children must be an array.')
  const children = value.children.map((child): TreeNode | string => {
    if (typeof child === 'string') return child
    if (typeof child === 'number') return String(child)
    return convertTree(child)
  })
  return { type: value.type, props: convertValue(value.props) as PlainRecord, children }
}

export function convertDesignJSXRoots(values: unknown[]): TreeNode[] {
  return values.map(convertTree)
}
