import type { ClipboardImageResolution, Editor } from '@open-pencil/core/editor'

import { toast } from '@/app/shell/ui'

function imageCount(count: number) {
  return `${count} image${count === 1 ? '' : 's'}`
}

export function notifyClipboardImageResolution({
  total,
  missing,
  fetchAttempted
}: ClipboardImageResolution) {
  if (!fetchAttempted) {
    toast.warning(
      `Pasted design includes ${imageCount(total)} that cannot be loaded in the web app. Use the desktop app to include ${total === 1 ? 'it' : 'them'}.`
    )
    return
  }

  toast.error(
    `Failed to fetch ${imageCount(missing)} from Figma. Check that the source file is accessible and try again.`
  )
}

export function bindClipboardNotifications(editor: Editor) {
  return editor.onEditorEvent('clipboard:images-missing', notifyClipboardImageResolution)
}
