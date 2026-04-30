import {
  BLACK,
  BLUE,
  GRAY_100,
  GRAY_200,
  GRAY_50,
  GRAY_500,
  GREEN,
  RED,
  WHITE
} from '@/app/demo/colors'

import type { EditorStore } from '@/app/editor/session'
import type { Color } from '@open-pencil/core/scene-graph'

export function createDemoVariables(store: EditorStore) {
  const { graph } = store

  graph.addCollection({
    id: 'col-primitives',
    name: 'Primitives',
    modes: [
      { modeId: 'light', name: 'Light' },
      { modeId: 'dark', name: 'Dark' }
    ],
    defaultModeId: 'light',
    variableIds: []
  })

  const primitiveColors: Array<{
    id: string
    name: string
    light: Color
    dark: Color
  }> = [
    { id: 'var-white', name: 'White', light: WHITE, dark: { r: 0.12, g: 0.12, b: 0.13, a: 1 } },
    { id: 'var-black', name: 'Black', light: BLACK, dark: WHITE },
    {
      id: 'var-gray-50',
      name: 'Gray/50',
      light: GRAY_50,
      dark: { r: 0.1, g: 0.1, b: 0.11, a: 1 }
    },
    {
      id: 'var-gray-100',
      name: 'Gray/100',
      light: GRAY_100,
      dark: { r: 0.14, g: 0.14, b: 0.16, a: 1 }
    },
    {
      id: 'var-gray-200',
      name: 'Gray/200',
      light: GRAY_200,
      dark: { r: 0.22, g: 0.22, b: 0.24, a: 1 }
    },
    {
      id: 'var-gray-500',
      name: 'Gray/500',
      light: GRAY_500,
      dark: { r: 0.65, g: 0.65, b: 0.68, a: 1 }
    },
    { id: 'var-blue', name: 'Blue', light: BLUE, dark: { r: 0.33, g: 0.61, b: 1, a: 1 } },
    {
      id: 'var-green',
      name: 'Green',
      light: GREEN,
      dark: { r: 0.23, g: 0.87, b: 0.52, a: 1 }
    },
    { id: 'var-red', name: 'Red', light: RED, dark: { r: 1, g: 0.32, b: 0.32, a: 1 } }
  ]

  for (const c of primitiveColors) {
    graph.addVariable({
      id: c.id,
      name: c.name,
      type: 'COLOR',
      collectionId: 'col-primitives',
      valuesByMode: { light: c.light, dark: c.dark },
      description: '',
      hiddenFromPublishing: false
    })
  }

  graph.addCollection({
    id: 'col-semantic',
    name: 'Semantic',
    modes: [{ modeId: 'default', name: 'Default' }],
    defaultModeId: 'default',
    variableIds: []
  })

  const semanticVars: Array<{ id: string; name: string; aliasId: string }> = [
    { id: 'var-bg', name: 'Background', aliasId: 'var-white' },
    { id: 'var-bg-secondary', name: 'Background/Secondary', aliasId: 'var-gray-50' },
    { id: 'var-text-primary', name: 'Text/Primary', aliasId: 'var-black' },
    { id: 'var-text-secondary', name: 'Text/Secondary', aliasId: 'var-gray-500' },
    { id: 'var-border', name: 'Border', aliasId: 'var-gray-200' },
    { id: 'var-accent', name: 'Accent', aliasId: 'var-blue' },
    { id: 'var-success', name: 'Success', aliasId: 'var-green' },
    { id: 'var-error', name: 'Error', aliasId: 'var-red' }
  ]

  for (const s of semanticVars) {
    graph.addVariable({
      id: s.id,
      name: s.name,
      type: 'COLOR',
      collectionId: 'col-semantic',
      valuesByMode: { default: { aliasId: s.aliasId } },
      description: '',
      hiddenFromPublishing: false
    })
  }

  graph.addCollection({
    id: 'col-spacing',
    name: 'Spacing',
    modes: [
      { modeId: 'default', name: 'Default' },
      { modeId: 'compact', name: 'Compact' }
    ],
    defaultModeId: 'default',
    variableIds: []
  })

  const spacingVars: Array<{ id: string; name: string; default: number; compact: number }> = [
    { id: 'var-space-xs', name: 'Space/XS', default: 4, compact: 2 },
    { id: 'var-space-sm', name: 'Space/SM', default: 8, compact: 4 },
    { id: 'var-space-md', name: 'Space/MD', default: 16, compact: 12 },
    { id: 'var-space-lg', name: 'Space/LG', default: 24, compact: 16 },
    { id: 'var-space-xl', name: 'Space/XL', default: 32, compact: 24 },
    { id: 'var-radius-sm', name: 'Radius/SM', default: 4, compact: 2 },
    { id: 'var-radius-md', name: 'Radius/MD', default: 8, compact: 6 },
    { id: 'var-radius-lg', name: 'Radius/LG', default: 16, compact: 12 }
  ]

  for (const s of spacingVars) {
    graph.addVariable({
      id: s.id,
      name: s.name,
      type: 'FLOAT',
      collectionId: 'col-spacing',
      valuesByMode: { default: s.default, compact: s.compact },
      description: '',
      hiddenFromPublishing: false
    })
  }
}
