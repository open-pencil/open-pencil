import { useFileDialog } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core'
import { isSVGFile } from '@open-pencil/scene-graph/images'

import {
  createImagePreviewURL,
  isAttachableImageFile,
  rasterizeSVGAttachment,
  revokeImagePreviewURL,
  validateImageAttachmentFile
} from '@/app/ai/attachment/image/prepare'
import { MAX_IMAGE_ATTACHMENTS, type ImageAttachmentDraft } from '@/app/ai/attachment/image/types'
import { resolveReferencedNodes } from '@/app/ai/chat/context'
import { referenceLink } from '@/app/ai/chat/references/link'
import { mentionedNodes } from '@/app/ai/chat/references/nodes'
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
  const canMentionSelection = computed(() => options.selectedIds.value.size > 0)
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

  /** The selected layers as references, to insert into the message where the caret is. */
  function selectionMentions(): string {
    return resolveReferencedNodes(options.editor.graph, [...options.selectedIds.value])
      .map((node) => `${referenceLink({ kind: 'node', id: node.id, label: node.name })} `)
      .join('')
  }

  function handlePaste(event: ClipboardEvent): void {
    const files = event.clipboardData?.files
    const pastedImages = files ? [...files].filter(isAttachableImageFile) : []
    if (pastedImages.length === 0) return
    event.preventDefault()
    void addFiles(pastedImages)
  }

  /**
   * The message as sent. The layers it mentions go along as attachments, whose previews the
   * history shows; the references in the text already tell the model their IDs.
   */
  function takeSubmission(text: string): ChatSubmission {
    draftGeneration++
    const submittedImages = images.value
    images.value = []
    resetImageDialog()
    return {
      modelText: text,
      displayText: text,
      images: submittedImages,
      nodes: mentionedNodes(options.editor.graph, text)
    }
  }

  /** Takes back a submission that was not sent, ahead of anything attached since. */
  function restoreSubmission(submission: ChatSubmission): void {
    images.value = [...submission.images, ...images.value]
  }

  function clear(): void {
    draftGeneration++
    for (const image of images.value) revokeImagePreviewURL(image.previewURL)
    images.value = []
    resetImageDialog()
  }

  onImageChange((files) => {
    if (files) void addFiles([...files])
  })
  onBeforeUnmount(clear)

  return {
    images,
    canMentionSelection,
    selectionMentions,
    openImageDialog,
    addFiles,
    removeImage,
    handlePaste,
    takeSubmission,
    restoreSubmission
  }
}
