import {
  angularGradient,
  backgroundBlur,
  designVar,
  defineVars,
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
  foregroundBlur,
  designVar,
  defineVars
}

type HelperName = keyof typeof HELPERS

type PlainRecord = { [key: string]: unknown }

type SerializedDesignJSXElement = {
  type: string
  props: PlainRecord
  children: unknown[]
}

function isRecord(value: unknown): value is PlainRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSerializedElement(value: unknown): value is SerializedDesignJSXElement {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    isRecord(value.props) &&
    Array.isArray(value.children)
  )
}

function isHelper(value: unknown): value is DesignJSXHelperDescriptor {
  return (
    isRecord(value) && typeof value.__openPencilHelper === 'string' && Array.isArray(value.args)
  )
}

function convertValue(value: unknown): unknown {
  if (isHelper(value)) {
    const helperName = value.__openPencilHelper
    const helper = Object.hasOwn(HELPERS, helperName)
      ? (HELPERS[helperName as HelperName] as (...args: unknown[]) => unknown)
      : undefined
    if (typeof helper !== 'function') {
      throw new TypeError(`Unknown Design JSX helper "${helperName}".`)
    }
    return helper(...value.args.map(convertValue))
  }
  if (Array.isArray(value)) return value.map(convertValue)
  if (isRecord(value))
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convertValue(v)]))
  return value
}

function convertTree(value: unknown): TreeNode {
  if (!isSerializedElement(value)) {
    throw new Error('Design JSX must return an OpenPencil element.')
  }
  const children = value.children.map((child): TreeNode | string => {
    if (typeof child === 'string') return child
    if (typeof child === 'number') return String(child)
    return convertTree(child)
  })
  return { type: value.type, props: convertValue(value.props) as PlainRecord, children }
}

export function convertDesignJSXRoots(values: unknown[]): TreeNode[] {
  // Call validateDesignJSXOutput first; it enforces the depth bound used by this recursion.
  return values.map(convertTree)
}
