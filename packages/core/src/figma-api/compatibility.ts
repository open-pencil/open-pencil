/// <reference types="@figma/plugin-typings" />

import type { FigmaAPI } from './index'
import type { FigmaComponentNode, FigmaComponentSetNode } from './node-types'
import type { FigmaNodeProxy } from './proxy'

type Expect<T extends true> = T

type IncompatibleKeys<Actual, Expected> = {
  [K in keyof Expected]: K extends keyof Actual ? (Actual[K] extends Expected[K] ? never : K) : K
}[keyof Expected]

export type SupportedPluginAPI = Pick<
  PluginAPI,
  | 'base64Decode'
  | 'base64Encode'
  | 'loadFontAsync'
  | 'notify'
  | 'createComponent'
  | 'createEllipse'
  | 'createFrame'
  | 'createLine'
  | 'createPolygon'
  | 'createRectangle'
  | 'createSection'
  | 'createStar'
  | 'createText'
  | 'createVector'
  | 'exclude'
  | 'flatten'
  | 'group'
  | 'intersect'
  | 'subtract'
  | 'ungroup'
  | 'union'
>

export type FigmaAPIIncompatibleKeys = IncompatibleKeys<FigmaAPI, SupportedPluginAPI>
export type FigmaAPICompatibility = Expect<FigmaAPIIncompatibleKeys extends never ? true : false>

type Extends<Actual, Expected> = Actual extends Expected ? true : false

type Equal<Actual, Expected> = [Actual] extends [Expected]
  ? [Expected] extends [Actual]
    ? true
    : false
  : false

type ComponentPropertyDefinitionsMatch = Expect<
  Equal<FigmaComponentNode['componentPropertyDefinitions'], ComponentPropertyDefinitions>
>
const _componentPropertyDefinitionsMatch: ComponentPropertyDefinitionsMatch = true

type ComponentPropertyMethodsMatch = Expect<
  Extends<FigmaComponentNode['addComponentProperty'], ComponentNode['addComponentProperty']>
>
const _componentPropertyMethodsMatch: ComponentPropertyMethodsMatch = true

type ComponentSetPropertyMethodsMatch = Expect<
  Extends<FigmaComponentSetNode['editComponentProperty'], ComponentSetNode['editComponentProperty']>
>
const _componentSetPropertyMethodsMatch: ComponentSetPropertyMethodsMatch = true

type InstancePropertySurfaceMatch = Expect<
  Extends<
    Pick<
      FigmaNodeProxy & InstanceNode,
      | 'componentProperties'
      | 'componentPropertyReferences'
      | 'setProperties'
      | 'isExposedInstance'
      | 'exposedInstances'
      | 'getMainComponentAsync'
      | 'detachInstance'
      | 'swapComponent'
    >,
    Pick<
      InstanceNode,
      | 'componentProperties'
      | 'componentPropertyReferences'
      | 'setProperties'
      | 'isExposedInstance'
      | 'exposedInstances'
      | 'getMainComponentAsync'
      | 'detachInstance'
      | 'swapComponent'
    >
  >
>

const _instancePropertySurfaceMatch: InstancePropertySurfaceMatch = true

// `Effect` here is Figma's plugin-typings union; OpenPencil reads and writes a subset of it.
type EffectShapeMatch = Expect<Extends<FigmaNodeProxy['effects'][number], Effect>>
const _effectShapeMatch: EffectShapeMatch = true
