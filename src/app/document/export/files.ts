import { save } from '@tauri-apps/plugin-dialog'
import { writeFile as tauriWrite } from '@tauri-apps/plugin-fs'

import type { Editor, EditorState } from '@open-pencil/core'
import {
  findPageId,
  type ExportRequest,
  type IOFormatAdapter,
  type IORegistry
} from '@open-pencil/core/io'
import {
  headlessRenderNodes,
  type RasterExportFormat,
  renderNodesToImage
} from '@open-pencil/core/io/formats/raster'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { ExportOptions } from '@/app/document/export/types'
import { pickBrowserSaveFile, supportsFileSystemAccess } from '@/app/document/io/capability'
import { isTauri } from '@/app/tauri/env'

type ExportData = string | ArrayBuffer | Uint8Array

type DownloadBlob = (data: Uint8Array, filename: string, mime: string) => void

export interface ExportedFile {
  bytes: Uint8Array
  fileName: string
  format: string
  ext: string
  mime: string
}

export function getExportBaseName(graph: SceneGraph, target: ExportRequest['target']): string {
  if (target.scope === 'node') return graph.getNode(target.nodeId)?.name ?? 'Export'
  if (target.scope === 'selection' && target.nodeIds.length === 1) {
    return graph.getNode(target.nodeIds[0])?.name ?? 'Export'
  }
  if (target.scope === 'page') return graph.getNode(target.pageId)?.name ?? 'Page'
  return 'Export'
}

export function getExportOptions(format: IOFormatAdapter, options?: ExportOptions): unknown {
  if (format.exportOptions?.scale) {
    return { scale: options?.scale ?? 1, quality: options?.quality }
  }
  return undefined
}

export function getExportFileName(
  baseName: string,
  format: IOFormatAdapter,
  extension: string,
  options?: ExportOptions
): string {
  return format.exportOptions?.scale
    ? `${baseName}@${options?.scale ?? 1}x.${extension}`
    : `${baseName}.${extension}`
}

export function getExportBytes(data: ExportData): Uint8Array {
  return typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
}

export function createExportTargetActions(editor: Editor, state: EditorState, io: IORegistry) {
  /**
   * Renders `nodeIds` on the page that holds them, which need not be the page on screen;
   * without IDs, renders every layer of `pageId`. A document whose canvas is not on screen,
   * such as one in a background tab, draws with the headless renderer, as file exports do.
   */
  async function renderExportImage(
    nodeIds: string[],
    scale: number,
    format: RasterExportFormat,
    pageId = state.currentPageId,
    { useAbsoluteBounds = false }: { useAbsoluteBounds?: boolean } = {}
  ): Promise<Uint8Array<ArrayBuffer> | null> {
    const ids = nodeIds.length > 0 ? nodeIds : editor.graph.getChildren(pageId).map((n) => n.id)
    if (ids.length === 0) return null
    const ownerPageId = findPageId(editor.graph, ids[0]) ?? pageId
    const options = { scale, format, useAbsoluteBounds }
    const renderer = editor.renderer
    if (!renderer) return headlessRenderNodes(editor.graph, ownerPageId, ids, options)
    return renderNodesToImage(renderer.ck, renderer, editor.graph, ownerPageId, ids, options)
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
  return save({
    defaultPath: fileName,
    filters: [{ name: format, extensions: [ext.slice(1)] }]
  })
}

export async function writeTauriExportFile(path: string, data: Uint8Array) {
  await tauriWrite(path, data)
}

/** Saves an exported file and reports whether it was saved; `false` means the person cancelled. */
export async function saveExportedFile(
  data: Uint8Array,
  fileName: string,
  format: string,
  ext: string,
  mime: string,
  downloadBlob: DownloadBlob
): Promise<boolean> {
  if (isTauri()) {
    const path = await chooseTauriExportPath(fileName, format, ext)
    if (!path) return false
    await writeTauriExportFile(path, data)
    return true
  }

  if (supportsFileSystemAccess()) {
    try {
      const handle = await pickBrowserSaveFile({
        suggestedName: fileName,
        types: [
          {
            description: `${format} file`,
            accept: { [mime]: [ext] }
          }
        ]
      })
      if (!handle) return false
      const writable = await handle.createWritable()
      await writable.write(new Uint8Array(data))
      await writable.close()
      return true
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false
    }
  }

  downloadBlob(data, fileName, mime)
  return true
}
