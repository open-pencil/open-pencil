import type { AppMenuGroupSchema } from './types'

/** The Object menu: grouping, masks, visibility, boolean operations, and components. */
export const OBJECT_MENU: AppMenuGroupSchema = {
  label: 'Object',
  feature: 'document',
  paletteIcon: 'layers',
  items: [
    {
      id: 'selection.group',
      label: 'Group Selection',
      command: 'selection.group'
    },
    {
      id: 'selection.frameSelection',
      label: 'Frame Selection',
      command: 'selection.frameSelection'
    },
    {
      id: 'selection.wrapInSection',
      label: 'Wrap in New Section',
      command: 'selection.wrapInSection'
    },
    {
      id: 'selection.ungroup',
      label: 'Ungroup Selection',
      command: 'selection.ungroup'
    },
    { type: 'separator' },
    {
      id: 'insert-icon',
      label: 'Insert Icon…',
      palette: { keywords: ['iconify', 'symbol', 'glyph', 'lucide'] }
    },
    { type: 'separator' },
    {
      id: 'selection.toggleMask',
      label: 'Use as Mask',
      command: 'selection.toggleMask'
    },
    {
      id: 'selection.toggleVisibility',
      label: 'Show/Hide',
      command: 'selection.toggleVisibility'
    },
    {
      id: 'selection.toggleLock',
      label: 'Lock/Unlock',
      command: 'selection.toggleLock'
    },
    { type: 'separator' },
    {
      id: 'selection.flipHorizontal',
      label: 'Flip Horizontal',
      command: 'selection.flipHorizontal'
    },
    {
      id: 'selection.flipVertical',
      label: 'Flip Vertical',
      command: 'selection.flipVertical'
    },
    { type: 'separator' },
    {
      id: 'selection.booleanUnion',
      label: 'Union selection',
      command: 'selection.booleanUnion'
    },
    {
      id: 'selection.booleanSubtract',
      label: 'Subtract selection',
      command: 'selection.booleanSubtract'
    },
    {
      id: 'selection.booleanIntersect',
      label: 'Intersect selection',
      command: 'selection.booleanIntersect'
    },
    {
      id: 'selection.booleanExclude',
      label: 'Exclude selection',
      command: 'selection.booleanExclude'
    },
    {
      id: 'selection.flatten',
      label: 'Flatten',
      command: 'selection.flatten'
    },
    {
      id: 'selection.outlineStroke',
      label: 'Outline stroke',
      command: 'selection.outlineStroke'
    },
    { type: 'separator' },
    {
      id: 'selection.createComponent',
      label: 'Create Component',
      command: 'selection.createComponent'
    },
    {
      id: 'selection.createComponentSet',
      label: 'Create Component Set',
      command: 'selection.createComponentSet'
    },
    {
      id: 'selection.createInstance',
      label: 'Create Instance',
      command: 'selection.createInstance'
    },
    {
      id: 'selection.createSlot',
      label: 'Create Slot',
      command: 'selection.createSlot'
    },
    {
      id: 'selection.goToMainComponent',
      label: 'Go to Main Component',
      command: 'selection.goToMainComponent'
    },
    {
      id: 'selection.detachInstance',
      label: 'Detach Instance',
      command: 'selection.detachInstance'
    },
    {
      id: 'selection.detachIcon',
      label: 'Detach Icon',
      command: 'selection.detachIcon'
    },
    { type: 'separator' },
    {
      id: 'selection.moveToPage',
      label: 'Move to Page',
      command: 'selection.moveToPage',
      target: 'browser'
    },
    {
      id: 'selection.bringForward',
      label: 'Bring Forward',
      command: 'selection.bringForward'
    },
    {
      id: 'selection.bringToFront',
      label: 'Bring to Front',
      command: 'selection.bringToFront'
    },
    {
      id: 'selection.sendBackward',
      label: 'Send Backward',
      command: 'selection.sendBackward'
    },
    {
      id: 'selection.sendToBack',
      label: 'Send to Back',
      command: 'selection.sendToBack'
    }
  ]
}
