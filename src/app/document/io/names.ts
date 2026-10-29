import { basename } from 'pathe'
import { filename } from 'pathe/utils'

export function documentNameFromFigPath(path: string): string {
  return filename(path) || 'Untitled'
}

export function downloadNameFromPath(path: string): string {
  return basename(path) || 'Untitled.fig'
}

export function figDownloadName(fileName: string, sourceFormat: string): string {
  return sourceFormat === 'fig' ? fileName : `${filename(fileName) ?? fileName}.fig`
}
