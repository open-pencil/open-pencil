import { useFileDialog } from '@vueuse/core'
import { uniq } from 'es-toolkit'
import { computed, onBeforeUnmount, ref, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

import {
  createImagePreviewURL,
  isAttachableImageFile,
  isSVGFile,
  rasterizeSVGAttachment,
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
  /** Advances when a message is sent or the draft is cleared, so late images skip it. */
  let draftGeneration = 0
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
    accept: 'image/png,image/jpeg,image/webp,image/svg+xml',
    multiple: true,
    reset: true
  })

  /**
   * Attaches images chosen, pasted, or dropped, up to the limit: SVGs are drawn as PNGs first,
   * and each file that cannot be attached says why.
   */
  async function addFiles(files: File[]): Promise<void> {
    const draft = draftGeneration
    const limitMessage = `You can attach up to ${MAX_IMAGE_ATTACHMENTS} images.`
    if (images.value.length >= MAX_IMAGE_ATTACHMENTS) {
      options.reportError(limitMessage)
      resetImageDialog()
      return
    }
    for (const file of files) {
      try {
        const image = isSVGFile(file) ? await rasterizeSVGAttachment(file) : file
        // The message was sent or cleared while the SVG was drawn: it belongs to no draft now.
        if (draft !== draftGeneration) return
        // Checked after the await, since another drop may have filled the slots meanwhile.
        if (images.value.length >= MAX_IMAGE_ATTACHMENTS) {
          options.reportError(limitMessage)
          break
        }
        const validationError = validateImageAttachmentFile(image)
        if (validationError) {
          options.reportError(validationError)
          continue
        }
        images.value.push({ file: image, previewURL: createImagePreviewURL(image) })
      } catch (error) {
        options.reportError(error instanceof Error ? error.message : String(error))
      }
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
    const pastedImages = files ? [...files].filter(isAttachableImageFile) : []
    if (pastedImages.length === 0) return
    event.preventDefault()
    void addFiles(pastedImages)
  }

  function takeSubmission(text: string): ChatSubmission {
    draftGeneration++
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

  /** Takes back a submission that was not sent, ahead of anything attached since. */
  function restoreSubmission(submission: ChatSubmission): void {
    images.value = [...submission.images, ...images.value]
    nodeIds.value = uniq([...submission.nodes.map((node) => node.id), ...nodeIds.value])
  }

  function clear(): void {
    draftGeneration++
    for (const image of images.value) revokeImagePreviewURL(image.previewURL)
    images.value = []
    nodeIds.value = []
    resetImageDialog()
  }

  onImageChange((files) => {
    if (files) void addFiles([...files])
  })
  onBeforeUnmount(clear)

  return {
    images,
    nodes,
    canToggleSelection,
    selectionActive,
    openImageDialog,
    addFiles,
    removeImage,
    removeNode,
    toggleSelection,
    handlePaste,
    takeSubmission,
    restoreSubmission
  }
}
