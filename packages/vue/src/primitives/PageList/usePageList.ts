import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'
import { computed } from 'vue'

/**
 * Returns reactive page state and page-management actions.
 *
 * Use this composable to build page switchers, page lists, or navigation
 * panels without manually reading the graph in each component.
 */
export function usePageList() {
  const editor = useEditor()

  const pages = useSceneComputed(() => editor.graph.getPages())
  const currentPageId = computed(() => editor.state.currentPageId)

  return {
    editor,
    pages,
    currentPageId,
    switchPage: editor.switchPage,
    addPage: editor.addPage,
    deletePage: editor.deletePage,
    renamePage: editor.renamePage
  }
}
