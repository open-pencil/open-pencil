export function documentNameFromFigPath(path: string): string {
  return (
    path
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.(fig|deck)$/i, '') ?? 'Untitled'
  )
}

export function downloadNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? 'Untitled.fig'
}

/** Keep native extension for fig/deck; rewrite other imports to `.fig` for save-as. */
export function figDownloadName(fileName: string, sourceFormat: string): string {
  if (sourceFormat === 'fig' || sourceFormat === 'deck') return fileName
  return fileName.replace(/\.[^.]+$/i, '.fig')
}

export function isNativeDocumentFormat(sourceFormat: string): boolean {
  return sourceFormat === 'fig' || sourceFormat === 'deck'
}
