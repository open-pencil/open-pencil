import type { ComponentType, ReactNode } from 'react'

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

/** Where a kit's sources are once installed, as its own CLI or package manager lays them out. */
export interface KitSources {
  /** The installed project, whose packages the kit's modules import. */
  root: string
  /** The kit's stylesheet, compiled with Tailwind for the classes the page uses. */
  stylesheet: string
  /** Each of the kit's modules the page draws with, by name, as files under `root`. */
  modules: Record<string, string>
  /** Import aliases the kit's modules use, such as a project's `@`, as folders. */
  aliases: Record<string, string>
  /** What installed them, such as `shadcn@4.23.1`, which the document records. */
  installer: string
}

/** The kit's modules as the page receives them: each module's exports, by module name. */
export type KitModules = Readonly<Record<string, Readonly<Record<string, unknown>>>>

/** A UI kit the runner draws: its components rendered to a page, styled, and imported. */
export interface KitDefinition {
  /** The document's name. */
  name: string
  /** The module whose default export draws the page: `(marks, modules) => element`. */
  page: string
  /** The ways the page is styled, each a mode of the kit's variables, as its themes switch. */
  modes: readonly ReadHTMLMode[]
  /** Installs the kit's sources, or finds them installed. */
  sources: () => Promise<KitSources>
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

/** The props the page gives a kit component: its children, classes, and anything it takes. */
export interface KitComponentProps {
  children?: ReactNode
  className?: string
  [prop: string]: unknown
}

/** A component the page draws with: the export `name` of the kit's module `module`. */
export function kitComponent(
  modules: KitModules,
  module: string,
  name: string
): ComponentType<KitComponentProps> {
  const component = modules[module]?.[name]
  // React components are functions, or objects such as `forwardRef` and `memo` return.
  if (typeof component !== 'function' && (typeof component !== 'object' || component === null))
    throw new Error(`The kit's ${module} has no component ${name}`)
  return component as ComponentType<KitComponentProps>
}
