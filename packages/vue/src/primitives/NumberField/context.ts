import { createContext } from '#vue/internal/create-context'
import type { NumberFieldContext } from '#vue/primitives/NumberField/types'

export const [useNumberField, provideNumberField] = createContext<NumberFieldContext>('NumberField')
