const BOARD_PREVIEW_PREFIX = 'inkly:board-preview:'

function previewKey(boardId: string) {
  return `${BOARD_PREVIEW_PREFIX}${boardId}`
}

export function readBoardPreview(boardId: string): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(previewKey(boardId))
}

export function writeBoardPreview(boardId: string, dataUrl: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(previewKey(boardId), dataUrl)
  } catch (error) {
    console.warn('[boards] failed to persist board preview:', error)
  }
}
