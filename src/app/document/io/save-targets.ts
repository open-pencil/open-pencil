import { pickBrowserSaveFile } from '@/app/document/io/capability'

/** A file type a save dialog offers. */
export type LocalFileType = { description: string; extension: string }

export const FIG_FILE_TYPE: LocalFileType = { description: 'Figma file', extension: 'fig' }
export const DECK_FILE_TYPE: LocalFileType = { description: 'Figma Slides file', extension: 'deck' }

export async function chooseTauriFigSavePath(
  defaultPath = 'Untitled.fig',
  type: LocalFileType = FIG_FILE_TYPE
) {
  const { save } = await import('@tauri-apps/plugin-dialog')
  return save({
    defaultPath,
    filters: [{ name: type.description, extensions: [type.extension] }]
  })
}

export async function chooseBrowserFigSaveHandle(
  suggestedName = 'Untitled.fig',
  type: LocalFileType = FIG_FILE_TYPE
) {
  try {
    return await pickBrowserSaveFile({
      suggestedName,
      types: [
        {
          description: type.description,
          accept: { 'application/octet-stream': [`.${type.extension}`] }
        }
      ]
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') return null
    throw error
  }
}
