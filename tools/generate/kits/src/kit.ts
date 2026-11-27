import type { ReadHTMLMode } from '@open-pencil/core/io/formats/html/import'

/** An interaction state a variant is drawn in, as the behaviour's states name them. */
export type KitState = 'Default' | 'Hover' | 'Pressed' | 'Focus' | 'Disabled'

/** How the HTML engine puts an element in each state, as a pointer or the keyboard would. */
const FORCED: Partial<Record<KitState, string>> = {
  Hover: 'hover',
  Pressed: 'active',
  Focus: 'focus-visible'
}

/** The control a set's variants are, bound as the `set_behaviour` tool takes it without kind. */
export interface KitBehaviour {
  values?: Record<string, string | { property: string; on?: string; off?: string }>
  numbers?: Record<string, { min?: number; max?: number; step?: number; default?: number }>
  states?: string
}

/** The props a kit component takes to be drawn as one variant of a set. */
export type VariantProps = Record<string, string | boolean>

/** The props of the element that holds a set's variants, side by side. */
export interface SetProps {
  style: Record<string, string>
  [attribute: string]: string | Record<string, string>
}

/**
 * What a kit's page marks its components with, handed to it by the runner so the page imports
 * nothing but the kit: props for the attributes the HTML import reads.
 */
export interface KitMarks {
  /** Props for the element that holds a component set's variants, named `name`. */
  set: (name: string) => SetProps
  /**
   * Props that make a component a variant with these properties, in `state` when it is one of
   * them, behaving as the control its Radix root is when `behaviour` binds it.
   */
  variant: (
    properties: Readonly<Record<string, string>>,
    options?: { state?: KitState; behaviour?: KitBehaviour }
  ) => VariantProps
}

/** A UI kit the runner draws: its components rendered to a page, styled, and imported. */
export interface KitDefinition {
  /** The document's and its page's name. */
  name: string
  /** The folder the kit's modules and packages resolve from. */
  root: string
  /** The module, under `root`, whose default export draws the page: `(marks) => element`. */
  page: string
  /** The kit's stylesheet, compiled with Tailwind for the classes the page uses. */
  stylesheet: string
  /** The ways the page is styled, each a mode of the kit's variables, as its themes switch. */
  modes: readonly ReadHTMLMode[]
}

export function createKitMarks(attributes: {
  set: string
  component: string
  behaviour: string
}): KitMarks {
  return {
    set: (name) => ({
      [attributes.set]: name,
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: '16px',
        padding: '16px'
      }
    }),
    variant(properties, { state, behaviour } = {}) {
      const name = Object.entries(properties)
        .map(([property, value]) => `${property}=${value}`)
        .join(', ')
      const props: VariantProps = { [attributes.component]: name }
      const forced = state && FORCED[state]
      if (forced) props['data-force-state'] = forced
      if (state === 'Disabled') props.disabled = true
      if (behaviour) props[attributes.behaviour] = JSON.stringify(behaviour)
      return props
    }
  }
}
