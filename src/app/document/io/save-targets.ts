export async function chooseTauriFigSavePath() {
  const { save } = await import('@tauri-apps/plugin-dialog')
  return save({
    defaultPath: 'Untitled.fig',
    filters: [{ name: 'Figma file', extensions: ['fig'] }]
  })
}

export async function chooseBrowserFigSaveHandle() {
  if (!window.showSaveFilePicker) return null
  try {
    return await window.showSaveFilePicker({
      suggestedName: 'Untitled.fig',
      types: [
        {
          description: 'Figma file',
          accept: { 'application/octet-stream': ['.fig'] }
        }
      ]
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') return null
    throw error
  }
}
