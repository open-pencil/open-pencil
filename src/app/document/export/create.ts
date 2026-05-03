import {
  createExportTargetActions,
  getExportBaseName,
  getExportBytes,
  getExportFileName,
  getExportOptions,
  saveExportedFile
} from '@/app/document/export/files'

import type { Editor, EditorState } from '@open-pencil/core/editor'
import type { ExportRequest, IORegistry } from '@open-pencil/core/io'

type ExportOptions = {
  scale?: number
  quality?: number
  jsxFormat?: 'openpencil' | 'tailwind'
}

type DownloadBlob = (data: Uint8Array, filename: string, mime: string) => void

export function createDocumentExportActions(
  editor: Editor,
  state: EditorState,
  io: IORegistry,
  downloadBlob: DownloadBlob
) {
  const { renderExportImage, getSelectionExportTarget, listSelectionExportFormats } =
    createExportTargetActions(editor, state, io)

  async function exportTarget(
    target: ExportRequest['target'],
    formatId: string,
    options?: ExportOptions
  ) {
    const format = io.getFormat(formatId)
    if (!format) throw new Error(`Unknown export format: ${formatId}`)

    const exportOptions = getExportOptions(formatId, options)

    const result = await io.exportContent(
      formatId,
      { graph: editor.graph, target },
      exportOptions,
      editor.renderer ? { canvasKit: editor.renderer.ck, renderer: editor.renderer } : undefined
    )

    const baseName = getExportBaseName(editor.graph, target)
    const fileName = getExportFileName(baseName, formatId, result.extension, options)
    const bytes = getExportBytes(result.data)

    await saveExportedFile(
      bytes,
      fileName,
      format.label,
      `.${result.extension}`,
      result.mimeType,
      downloadBlob
    )
  }

  async function exportSelection(
    scale: number,
    formatId: 'png' | 'jpg' | 'webp' | 'svg' | 'pdf' | 'fig'
  ) {
    await exportTarget(getSelectionExportTarget(), formatId, { scale })
  }

  return {
    renderExportImage,
    listSelectionExportFormats,
    exportTarget,
    exportSelection
  }
}
