import type { createSelectionActions } from '#core/editor/selection'
import type { createStructureActions } from '#core/editor/structure'

type SelectionActions = ReturnType<typeof createSelectionActions>
type StructureActions = ReturnType<typeof createStructureActions>

export function createStructureBridge(structure: StructureActions, selection: SelectionActions) {
  return {
    wrapInAutoLayout: () => structure.wrapInAutoLayout(selection.getSelectedNodes()),
    groupSelected: () => structure.groupSelected(selection.getSelectedNodes()),
    ungroupSelected: () => structure.ungroupSelected(selection.getSelectedNode())
  }
}
