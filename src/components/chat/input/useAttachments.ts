import { useFileDialog } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

import {
  createImagePreviewURL,
  revokeImagePreviewURL,
  validateImageAttachmentFile
} from '@/app/ai/attachment/image/prepare'
import { MAX_IMAGE_ATTACHMENTS, type ImageAttachmentDraft } from '@/app/ai/attachment/image/types'
import {
  appendReferencedNodeContext,
  MAX_REFERENCED_NODES,
  resolveReferencedNodes
} from '@/app/ai/chat/context'
import type { ChatSubmission } from '@/app/ai/chat/submission/types'

interface AttachmentDraftOptions {
  editor: Editor
  selectedIds: Ref<Set<string>>
  reportError: (message: string) => void
}

export function useAttachmentDrafts(options: AttachmentDraftOptions) {
  const images = ref<ImageAttachmentDraft[]>([])
  const nodeIds = ref<string[]>([])
  const nodes = computed(() => resolveReferencedNodes(options.editor.graph, nodeIds.value))
  const selectedNodeIds = computed(() =>
    [...options.selectedIds.value].filter((id) => nodeIds.value.includes(id))
  )
  const canToggleSelection = computed(
    () =>
      options.selectedIds.value.size > 0 &&
      (selectedNodeIds.value.length > 0 || nodes.value.length < MAX_REFERENCED_NODES)
  )
  const selectionActive = computed(
    () =>
      options.selectedIds.value.size > 0 &&
      selectedNodeIds.value.length === options.selectedIds.value.size
  )
  const {
    open: openImageDialog,
    reset: resetImageDialog,
    onChange: onImageChange
  } = useFileDialog({
    accept: 'image/png,image/jpeg,image/webp',
    multiple: true,
    reset: true
  })

  function addImages(files: File[]): void {
    const available = MAX_IMAGE_ATTACHMENTS - images.value.length
    if (available <= 0) {
      options.reportError(`You can attach up to ${MAX_IMAGE_ATTACHMENTS} images.`)
      resetImageDialog()
      return
    }
    for (const file of files.slice(0, available)) {
      const validationError = validateImageAttachmentFile(file)
      if (validationError) {
        options.reportError(validationError)
        continue
      }
      images.value.push({ file, previewURL: createImagePreviewURL(file) })
    }
    if (files.length > available) {
      options.reportError(`You can attach up to ${MAX_IMAGE_ATTACHMENTS} images.`)
    }
    resetImageDialog()
  }

  function removeImage(index: number): void {
    revokeImagePreviewURL(images.value[index].previewURL)
    images.value.splice(index, 1)
    resetImageDialog()
  }

  function removeNode(id: string): void {
    nodeIds.value = nodeIds.value.filter((candidate) => candidate !== id)
  }

  function toggleSelection(): void {
    if (selectedNodeIds.value.length > 0) {
      const selected = new Set(options.selectedIds.value)
      nodeIds.value = nodeIds.value.filter((id) => !selected.has(id))
      return
    }
    nodeIds.value = resolveReferencedNodes(options.editor.graph, [
      ...nodeIds.value,
      ...options.selectedIds.value
    ]).map((node) => node.id)
  }

  function handlePaste(event: ClipboardEvent): void {
    const files = event.clipboardData?.files
    const pastedImages = files ? [...files].filter((file) => file.type.startsWith('image/')) : []
    if (pastedImages.length === 0) return
    event.preventDefault()
    addImages(pastedImages)
  }

  function takeSubmission(text: string): ChatSubmission {
    const submittedImages = images.value
    const submittedNodes = nodes.value
    images.value = []
    nodeIds.value = []
    resetImageDialog()
    return {
      modelText: appendReferencedNodeContext(text, submittedNodes),
      displayText: text,
      images: submittedImages,
      nodes: submittedNodes
    }
  }

  function clear(): void {
    for (const image of images.value) revokeImagePreviewURL(image.previewURL)
    images.value = []
    nodeIds.value = []
    resetImageDialog()
  }

  onImageChange((files) => {
    if (files) addImages([...files])
  })
  onBeforeUnmount(clear)

  return {
    images,
    nodes,
    canToggleSelection,
    selectionActive,
    openImageDialog,
    addImages,
    removeImage,
    removeNode,
    toggleSelection,
    handlePaste,
    takeSubmission
  }
}
