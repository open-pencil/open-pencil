import type { Editor, EditorState } from '@open-pencil/core'
import type { BuiltinIOFormatId, ExportRequest, IORegistry } from '@open-pencil/core/io'

import {
  bundleExportFiles,
  createExportTargetActions,
  getExportBaseName,
  getExportBytes,
  getExportFileName,
  getExportOptions,
  saveExportedFile,
  type ExportedFile
} from '@/app/document/export/files'
import type { ExportOptions } from '@/app/document/export/types'
import { trackDocumentFormat } from '@/app/telemetry'

type DownloadBlob = (data: Uint8Array, filename: string, mime: string) => void

export interface ExportTargetRequest {
  target: ExportRequest['target']
  formatId: string
  options?: ExportOptions
}

export function createDocumentExportActions(
  editor: Editor,
  state: EditorState,
  io: IORegistry,
  downloadBlob: DownloadBlob
) {
  const { renderExportImage, getSelectionExportTarget, listSelectionExportFormats } =
    createExportTargetActions(editor, state, io)

  async function renderExportFile(
    target: ExportRequest['target'],
    formatId: string,
    options?: ExportOptions
  ): Promise<ExportedFile> {
    const format = io.getFormat(formatId)
    if (!format) throw new Error(`Unknown export format: ${formatId}`)

    const exportOptions = getExportOptions(format, options)

    const result = await io.exportContent(
      formatId,
      { graph: editor.graph, target },
      exportOptions,
      editor.renderer ? { canvasKit: editor.renderer.ck, renderer: editor.renderer } : undefined
    )

    const baseName = getExportBaseName(editor.graph, target)
    return {
      bytes: getExportBytes(result.data),
      fileName: getExportFileName(baseName, format, result.extension, options),
      format: format.label,
      ext: `.${result.extension}`,
      mime: result.mimeType
    }
  }

  function saveExportFile(file: ExportedFile): Promise<boolean> {
    return saveExportedFile(
      file.bytes,
      file.fileName,
      file.format,
      file.ext,
      file.mime,
      downloadBlob
    )
  }

  async function exportTarget(
    target: ExportRequest['target'],
    formatId: string,
    options?: ExportOptions
  ) {
    if (await saveExportFile(await renderExportFile(target, formatId, options))) {
      trackDocumentFormat('document_exported', formatId)
    }
  }

  // Export a batch of targets. A single file downloads directly; multiple files
  // are bundled into one zip so the user gets a single download.
  async function exportTargets(requests: ExportTargetRequest[]) {
    if (requests.length === 0) return

    const files: ExportedFile[] = []
    for (const request of requests) {
      files.push(await renderExportFile(request.target, request.formatId, request.options))
    }

    const baseNames = new Set(requests.map((r) => getExportBaseName(editor.graph, r.target)))
    const zipBaseName = baseNames.size === 1 ? [...baseNames][0] : 'export'
    const saved =
      files.length === 1
        ? await saveExportFile(files[0])
        : await saveExportedFile(
            bundleExportFiles(files),
            `${zipBaseName}.zip`,
            'ZIP',
            '.zip',
            'application/zip',
            downloadBlob
          )
    // Counted once delivered, so a failed render or a cancelled save is not an export.
    if (saved)
      for (const { formatId } of requests) trackDocumentFormat('document_exported', formatId)
  }

  async function exportSelection(scale: number, formatId: BuiltinIOFormatId) {
    await exportTarget(getSelectionExportTarget(), formatId, { scale })
  }

  return {
    renderExportImage,
    listSelectionExportFormats,
    exportTarget,
    exportTargets,
    exportSelection
  }
}
