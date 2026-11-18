import type { AppMenuGroupSchema } from './types'

/** The Arrange menu: alignment, distribution, and automatic arrangement. */
export const ARRANGE_MENU: AppMenuGroupSchema = {
  label: 'Arrange',
  feature: 'document',
  paletteIcon: 'layers',
  items: [
    {
      id: 'selection.wrapInAutoLayout',
      label: 'Wrap in Auto Layout',
      command: 'selection.wrapInAutoLayout'
    },
    { type: 'separator' },
    { id: 'arrange.align-left', label: 'Align Left', shortcut: 'Alt+A' },
    { id: 'arrange.align-center', label: 'Align Center', shortcut: 'Alt+H' },
    { id: 'arrange.align-right', label: 'Align Right', shortcut: 'Alt+D' },
    { type: 'separator' },
    { id: 'arrange.align-top', label: 'Align Top', shortcut: 'Alt+W' },
    { id: 'arrange.align-middle', label: 'Align Middle', shortcut: 'Alt+V' },
    { id: 'arrange.align-bottom', label: 'Align Bottom', shortcut: 'Alt+S' },
    { type: 'separator' },
    {
      id: 'selection.distributeHorizontal',
      label: 'Distribute Horizontal Spacing',
      command: 'selection.distributeHorizontal'
    },
    {
      id: 'selection.distributeVertical',
      label: 'Distribute Vertical Spacing',
      command: 'selection.distributeVertical'
    },
    { type: 'separator' },
    { id: 'selection.tidyUp', label: 'Tidy Up', command: 'selection.tidyUp' },
    {
      id: 'selection.packHorizontal',
      label: 'Pack Horizontal',
      command: 'selection.packHorizontal'
    },
    { id: 'selection.packVertical', label: 'Pack Vertical', command: 'selection.packVertical' },
    {
      id: 'arrange-layout',
      label: 'Auto Arrange',
      sub: [
        {
          id: 'selection.arrangeSpread',
          label: 'Spread Apart',
          command: 'selection.arrangeSpread'
        },
        {
          id: 'selection.arrangeCompact',
          label: 'Spread and Compact',
          command: 'selection.arrangeCompact'
        },
        {
          id: 'selection.arrangePack',
          label: 'Pack into Rows',
          command: 'selection.arrangePack'
        },
        { type: 'separator' },
        {
          id: 'selection.arrangeFlowDown',
          label: 'Flow, Top to Bottom',
          command: 'selection.arrangeFlowDown'
        },
        {
          id: 'selection.arrangeFlowRight',
          label: 'Flow, Left to Right',
          command: 'selection.arrangeFlowRight'
        },
        {
          id: 'selection.arrangeTreeDown',
          label: 'Tree, Top to Bottom',
          command: 'selection.arrangeTreeDown'
        },
        {
          id: 'selection.arrangeTreeRight',
          label: 'Tree, Left to Right',
          command: 'selection.arrangeTreeRight'
        },
        {
          id: 'selection.arrangeRadial',
          label: 'Radial Map',
          command: 'selection.arrangeRadial'
        },
        { id: 'selection.arrangeNetwork', label: 'Network', command: 'selection.arrangeNetwork' }
      ]
    }
  ]
}
