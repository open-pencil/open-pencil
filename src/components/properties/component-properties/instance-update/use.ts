import { ref, watch, type Ref } from 'vue'

import { libraryAssetKeyForComponent } from '@open-pencil/core/library'
import type { SceneNode } from '@open-pencil/scene-graph'

import type { EditorStore } from '@/app/editor/session'
import { notificationMessages } from '@/app/i18n/notifications'
import type { LibraryService } from '@/app/libraries'
import { toast } from '@/app/shell/ui'

export function useInstanceUpdate(
  node: Ref<SceneNode | null | undefined>,
  editor: EditorStore,
  service: LibraryService
) {
  const available = ref(false)
  const updating = ref(false)
  let requestId = 0

  async function checkAvailability() {
    const request = ++requestId
    const instance = node.value
    if (instance?.type !== 'INSTANCE' || !instance.componentId) {
      available.value = false
      return
    }
    const component = editor.graph.getNode(instance.componentId)
    const identity = component?.librarySource?.identity
    const assetKey = component ? libraryAssetKeyForComponent(editor.graph, component.id) : null
    const summary = identity
      ? service.summaries.value.find((item) => item.libraryId === identity.libraryId)
      : null
    if (request === requestId) {
      available.value = !!assetKey && !!summary && summary.latestRevisionId !== identity?.revisionId
    }
  }

  async function updateSelectedInstance() {
    const instance = node.value
    if (instance?.type !== 'INSTANCE') return
    updating.value = true
    try {
      await service.applyInstanceUpdate(editor, instance.id)
      available.value = false
    } catch (cause) {
      toast.error(
        notificationMessages.get().operationFailed({
          error: cause instanceof Error ? cause.message : String(cause)
        })
      )
    } finally {
      updating.value = false
    }
  }

  watch(
    () => [node.value?.id, editor.state.sceneVersion, service.summaries.value] as const,
    () => void checkAvailability(),
    { immediate: true }
  )

  return { available, updating, updateSelectedInstance }
}
