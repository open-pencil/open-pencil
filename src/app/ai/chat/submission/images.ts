import { analyzeAttachedImages } from '@/app/ai/attachment/image/analyze'
import { prepareImageAttachment } from '@/app/ai/attachment/image/prepare'
import type { ImageAttachmentDraft } from '@/app/ai/attachment/image/types'
import type { EditorStore } from '@/app/editor/active-store'

/** Prepares a message's images for the model and what the vision model found in them. */
export async function prepareSubmittedImages(
  editor: EditorStore,
  text: string,
  images: ImageAttachmentDraft[]
) {
  const prepared = await Promise.all(images.map((image) => prepareImageAttachment(image.file)))
  const findings = await analyzeAttachedImages(editor, text, prepared)
  return { prepared, findings }
}
