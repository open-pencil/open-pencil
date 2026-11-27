import { basename, dirname, join } from 'pathe'
import { filename } from 'pathe/utils'

import { DOCUMENT_EXTENSIONS } from '@open-pencil/core/io'
import type { DocumentKind } from '@open-pencil/scene-graph'

/** Whether a file is a Figma archive: a design's `.fig`, a FigJam board's `.jam`, or a Slides `.deck`. */
export function isFigArchiveName(name: string): boolean {
  const lower = name.toLowerCase()
  return Object.values(DOCUMENT_EXTENSIONS).some((extension) => lower.endsWith(`.${extension}`))
}

/** The file name a document of this kind saves under: `.fig` for a design, `.jam` for a board, `.deck` for slides. */
export function documentFileName(name: string, kind: DocumentKind): string {
  return `${name}.${DOCUMENT_EXTENSIONS[kind]}`
}

/** The same path with the extension a document of this kind saves under, for `notes.pen` → `notes.fig`. */
export function documentPathFor(path: string, kind: DocumentKind): string {
  return join(dirname(path), documentFileName(filename(path) || 'Untitled', kind))
}

export function documentNameFromFigPath(path: string): string {
  return filename(path) || 'Untitled'
}

export function downloadNameFromPath(path: string): string {
  return basename(path) || 'Untitled.fig'
}

export function figDownloadName(fileName: string, sourceFormat: string): string {
  return sourceFormat === 'fig' ? fileName : `${filename(fileName) ?? fileName}.fig`
}
