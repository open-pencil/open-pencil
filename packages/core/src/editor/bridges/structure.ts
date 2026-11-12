import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { createSelectionActions } from '#core/editor/selection'
import type { createStructureActions } from '#core/editor/structure'
import type { LayerType } from '#core/editor/structure/layer-type'

type SelectionActions = ReturnType<typeof createSelectionActions>
type StructureActions = ReturnType<typeof createStructureActions>

export function createStructureBridge(structure: StructureActions, selection: SelectionActions) {
  return {
    wrapInAutoLayout: () => structure.wrapInAutoLayout(selection.getSelectedNodes()),
    groupSelected: () => structure.groupSelected(selection.getSelectedNodes()),
    frameSelection: () => structure.frameSelection(selection.getSelectedNodes()),
    /** Wraps the selection in a new section with room around it, as FigJam's toolbar does. */
    wrapSelectionInSection: () => structure.wrapInSection(selection.getSelectedNodes()),
    canWrapSelectionInSection: () => structure.canWrapInSection(selection.getSelectedNodes()),
    booleanOperationSelected: (operation: 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE') =>
      structure.booleanOperationSelected(selection.getSelectedNodes(), operation),
    flattenSelected: () => structure.flattenSelected(selection.getSelectedNodes()),
    outlineTextSelected: () => structure.outlineTextSelected(selection.getSelectedNodes()),
    outlineStrokeSelected: () => structure.outlineStrokeSelected(selection.getSelectedNodes()),
    /** Scales the selection evenly about a canvas point, as Figma's Scale tool does. */
    scaleSelected: (scale: number, anchor: Vector) =>
      structure.scaleLayers(selection.getSelectedNodes(), scale, anchor),
    ungroupSelected: () => structure.ungroupSelected(selection.getSelectedNodes()),
    canUngroupSelection: () => structure.canUngroup(selection.getSelectedNodes()),
    /** Switches a layer to another type in place, as Figma's layer type menu does. */
    convertLayerType: (nodeId: string, type: LayerType) => structure.convertLayerType(nodeId, type)
  }
}
