import type { createComponentActions } from '#core/editor/components'
import type { createPageActions } from '#core/editor/pages'
import type { createSelectionActions } from '#core/editor/selection'
import type { createStructureActions } from '#core/editor/structure'

type ComponentActions = ReturnType<typeof createComponentActions>
type PageActions = ReturnType<typeof createPageActions>
type SelectionActions = ReturnType<typeof createSelectionActions>
type StructureActions = ReturnType<typeof createStructureActions>

export function createComponentBridge(
  components: ComponentActions,
  selection: SelectionActions,
  structure: StructureActions,
  pages: PageActions
) {
  return {
    createComponentFromSelection: () =>
      components.createComponentFromSelection(
        selection.getSelectedNodes(),
        structure.wrapSelectionInContainer
      ),
    createComponentSetFromComponents: () =>
      components.createComponentSetFromComponents(
        selection.getSelectedNodes(),
        structure.wrapSelectionInContainer
      ),
    createInstanceFromComponent: components.createInstanceFromComponent,
    detachInstance: () => components.detachInstance(selection.getSelectedNode()),
    goToMainComponent: () =>
      components.goToMainComponent(selection.getSelectedNode(), pages.switchPage)
  }
}
