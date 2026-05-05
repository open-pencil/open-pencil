import { isTauri } from '@/app/tauri/env'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'

import type { Editor, EditorState } from '@open-pencil/core/editor'
import type {
  ExportRequest,
  IOFormatAdapter,
  IORegistry,
  RasterExportFormat
} from '@open-pencil/core/io'
import type { SceneGraph } from '@open-pencil/core/scene-graph'

type ExportOptions = {
  scale?: number
  quality?: number
  jsxFormat?: 'openpencil' | 'tailwind'
}

type ExportData = string | ArrayBuffer | Uint8Array

type DownloadBlob = (data: Uint8Array, filename: string, mime: string) => void

export function getExportBaseName(graph: SceneGraph, target: ExportRequest['target']): string {
  if (target.scope === 'node') return graph.getNode(target.nodeId)?.name ?? 'Export'
  if (target.scope === 'selection' && target.nodeIds.length === 1) {
    return graph.getNode(target.nodeIds[0])?.name ?? 'Export'
  }
  if (target.scope === 'page') return graph.getNode(target.pageId)?.name ?? 'Page'
  return 'Export'
}

export function getExportOptions(formatId: string, options?: ExportOptions): unknown {
  if (formatId === 'png' || formatId === 'jpg' || formatId === 'webp') {
    return {
      format: formatId.toUpperCase(),
      scale: options?.scale ?? 1,
      quality: options?.quality
    }
  }
  if (formatId === 'jsx') return { format: options?.jsxFormat ?? 'openpencil' }
  return undefined
}

export function getExportFileName(
  baseName: string,
  formatId: string,
  extension: string,
  options?: ExportOptions
): string {
  return formatId === 'png' || formatId === 'jpg' || formatId === 'webp'
    ? `${baseName}@${options?.scale ?? 1}x.${extension}`
    : `${baseName}.${extension}`
}

export function getExportBytes(data: ExportData): Uint8Array {
  return typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
}

export function createExportTargetActions(editor: Editor, state: EditorState, io: IORegistry) {
  async function renderExportImage(
    nodeIds: string[],
    scale: number,
    format: RasterExportFormat
  ): Promise<Uint8Array | null> {
    const renderer = editor.renderer
    if (!renderer) return null
    const ids =
      nodeIds.length > 0 ? nodeIds : editor.graph.getChildren(state.currentPageId).map((n) => n.id)
    if (ids.length === 0) return null
    return renderNodesToImage(renderer.ck, renderer, editor.graph, state.currentPageId, ids, {
      scale,
      format
    })
  }

  function getSelectionExportTarget(): ExportRequest['target'] {
    const ids = [...state.selectedIds]
    if (ids.length > 0) return { scope: 'selection', nodeIds: ids }
    return { scope: 'page', pageId: state.currentPageId }
  }

  function listSelectionExportFormats(): IOFormatAdapter[] {
    return io.listExportFormats(state.selectedIds.size > 0 ? 'selection' : 'page')
  }

  return { renderExportImage, getSelectionExportTarget, listSelectionExportFormats }
}

export async function chooseTauriExportPath(fileName: string, format: string, ext: string) {
  const { save } = await import('@tauri-apps/plugin-dialog')
  return save({
    defaultPath: fileName,
    filters: [{ name: format, extensions: [ext.slice(1)] }]
  })
}

export async function writeTauriExportFile(path: string, data: Uint8Array) {
  const { writeFile: tauriWrite } = await import('@tauri-apps/plugin-fs')
  await tauriWrite(path, data)
}

export async function saveExportedFile(
  data: Uint8Array,
  fileName: string,
  format: string,
  ext: string,
  mime: string,
  downloadBlob: DownloadBlob
) {
  if (isTauri()) {
    const path = await chooseTauriExportPath(fileName, format, ext)
    if (!path) return
    await writeTauriExportFile(path, data)
    return
  }

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: `${format} file`,
            accept: { [mime]: [ext] }
          }
        ]
      })
      const writable = await handle.createWritable()
      await writable.write(new Uint8Array(data))
      await writable.close()
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }

  downloadBlob(data, fileName, mime)
}
