const PINNED_BOARDS_KEY = 'inkly:pinned-boards'

function readSet(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(PINNED_BOARDS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

function writeSet(ids: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PINNED_BOARDS_KEY, JSON.stringify([...ids]))
  } catch (error) {
    console.warn('[boards] failed to persist pinned boards:', error)
  }
}

export function readPinnedBoardIds(): string[] {
  return [...readSet()]
}

export function isBoardPinned(boardId: string): boolean {
  return readSet().has(boardId)
}

export function togglePinnedBoard(boardId: string): boolean {
  const set = readSet()
  if (set.has(boardId)) {
    set.delete(boardId)
    writeSet(set)
    return false
  }
  set.add(boardId)
  writeSet(set)
  return true
}

export function clearPinnedBoards() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PINNED_BOARDS_KEY)
}
