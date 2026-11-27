/**
 * Runs inside the kit's module graph, as `mark.ts` does: wraps a kit component so each use of it
 * marks the instance of the page's component it is.
 */
import { createElement, forwardRef, type ElementType } from 'react'

import { variantName, type KitInstance } from '../kit'

/** The attributes an instance is marked with: what it is an instance of, and which variant. */
export interface InstanceAttributes {
  instance: string
  variant: string
}

/**
 * `Component`, marking each use the instance `instanceOf` its props say it is; a use that is
 * none, such as a size the page's set does not draw, renders as it is.
 */
export function markInstance(
  Component: ElementType,
  instanceOf: (props: Record<string, unknown>) => KitInstance | null,
  attributes: InstanceAttributes
) {
  return forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    const instance = instanceOf(props)
    const marks = instance
      ? {
          [attributes.instance]: instance.of,
          ...(instance.variant ? { [attributes.variant]: variantName(instance.variant) } : {})
        }
      : {}
    return createElement(Component, { ...props, ref, ...marks })
  })
}
