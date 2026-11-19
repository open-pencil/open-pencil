/** Whether opening a recent file stopped because its tab was closed. */
export function isRecentFileOpenCancellation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  )
}
