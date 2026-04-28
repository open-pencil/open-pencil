export function documentNameFromFigPath(path: string): string {
  return path
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.fig$/i, '') ?? 'Untitled'
}

export function downloadNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? 'Untitled.fig'
}

export function figDownloadName(fileName: string, sourceFormat: string): string {
  return sourceFormat === 'fig' ? fileName : fileName.replace(/\.[^.]+$/i, '.fig')
}
