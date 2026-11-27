/**
 * Runs inside the kit's own module graph, beside its React, so it imports nothing else: the
 * plugin in `radix.ts` passes it the parts to mark and the attributes to write.
 */
import { createContext, createElement, forwardRef, useContext, type ElementType } from 'react'

/** The attributes a marked part writes: the element it is, and the one that opts a root in. */
export interface MarkAttributes {
  reka: string
  behaviour: string
}

type Props = Record<string, unknown>
type Namespace = Record<string, unknown>

/** The Radix namespace of the marked root a part renders inside, if any. */
const MarkedRoot = createContext<string | null>(null)

/**
 * A Radix part that writes the Reka UI element it is, `Switch.Thumb`. A root writes it when the
 * kit gives it a behaviour to bind, and its parts inside it then follow; the same primitives used
 * anywhere else render as they are.
 */
function markedPart(namespace: string, part: string, Original: ElementType, marks: MarkAttributes) {
  const type = `${namespace}.${part}`
  return forwardRef<unknown, Props>((props, ref) => {
    const inside = useContext(MarkedRoot)
    if (part === 'Root') {
      const marked = marks.behaviour in props
      const root = createElement(Original, {
        ...props,
        ref,
        ...(marked ? { [marks.reka]: type } : {})
      })
      return createElement(MarkedRoot.Provider, { value: marked ? namespace : null }, root)
    }
    const own = inside === namespace ? { [marks.reka]: type } : {}
    return createElement(Original, { ...props, ref, ...own })
  })
}

function isNamespace(value: unknown): value is Namespace {
  return typeof value === 'object' && value !== null
}

/** Radix's namespaces with each listed part marked; namespaces Radix lacks are left out. */
export function markRadix(
  radix: Record<string, unknown>,
  parts: Record<string, readonly string[]>,
  marks: MarkAttributes
): Record<string, Namespace> {
  const marked: Record<string, Namespace> = {}
  for (const [name, names] of Object.entries(parts)) {
    const namespace = radix[name]
    if (!isNamespace(namespace)) continue
    marked[name] = { ...namespace }
    for (const part of names) {
      const Original = namespace[part]
      if (Original) marked[name][part] = markedPart(name, part, Original as ElementType, marks)
    }
  }
  return marked
}
