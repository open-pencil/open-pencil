export type NativeSaveFormat = 'fig' | 'deck'

function saveFormatFromName(name?: string | null): NativeSaveFormat {
  return name && /\.deck$/i.test(name) ? 'deck' : 'fig'
}

export async function chooseTauriFigSavePath(suggestedName?: string | null) {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const format = saveFormatFromName(suggestedName)
  const defaultPath = suggestedName?.trim() || (format === 'deck' ? 'Untitled.deck' : 'Untitled.fig')
  return save({
    defaultPath,
    filters:
      format === 'deck'
        ? [
            { name: 'Figma Slides', extensions: ['deck'] },
            { name: 'Figma Design', extensions: ['fig'] }
          ]
        : [
            { name: 'Figma Design', extensions: ['fig'] },
            { name: 'Figma Slides', extensions: ['deck'] }
          ]
  })
}

export async function chooseBrowserFigSaveHandle(suggestedName?: string | null) {
  if (!window.showSaveFilePicker) return null
  const format = saveFormatFromName(suggestedName)
  const name = suggestedName?.trim() || (format === 'deck' ? 'Untitled.deck' : 'Untitled.fig')
  try {
    return await window.showSaveFilePicker({
      suggestedName: name,
      types: [
        {
          description: format === 'deck' ? 'Figma Slides' : 'Figma Design',
          accept: {
            'application/octet-stream': format === 'deck' ? ['.deck'] : ['.fig']
          }
        },
        {
          description: format === 'deck' ? 'Figma Design' : 'Figma Slides',
          accept: {
            'application/octet-stream': format === 'deck' ? ['.fig'] : ['.deck']
          }
        }
      ]
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') return null
    throw error
  }
}
