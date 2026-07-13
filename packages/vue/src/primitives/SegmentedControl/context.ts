import { createContext } from '#vue/internal/create-context'
import type { SegmentedControlContext } from '#vue/primitives/SegmentedControl/types'

export const [useSegmentedControl, provideSegmentedControl] =
  createContext<SegmentedControlContext>('SegmentedControl')
