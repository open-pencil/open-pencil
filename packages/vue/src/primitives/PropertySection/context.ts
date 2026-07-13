import { createContext } from '#vue/internal/create-context'
import type { PropertySectionContext } from '#vue/primitives/PropertySection/types'

export const [usePropertySection, providePropertySection] =
  createContext<PropertySectionContext>('PropertySection')
