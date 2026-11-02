import { IS_BROWSER } from '@/constants'

/**
 * File System Access is Chromium-only today; other browsers download instead. This module is
 * the one place that touches the API, so callers cannot drift on the availability check.
 */
export function supportsFileSystemAccess(): boolean {
  return IS_BROWSER && typeof window.showSaveFilePicker === 'function'
}

/**
 * Whether a write failed because the browser refuses to write to a file it handed out, as embedded
 * browsers and sandboxed frames do: the picker works but `createWritable` throws. Callers download
 * the file instead.
 */
export function isFileWriteRefused(error: unknown): boolean {
  return (
    error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
  )
}

/**
 * Opens the browser save picker. Resolves to null when the browser has no picker, and rejects
 * with `AbortError` when the user cancels so callers can keep cancel and failure distinct.
 */
export async function pickBrowserSaveFile(
  options: FilePickerOptions
): Promise<FileSystemFileHandle | null> {
  // Checked inline rather than through the predicate so TypeScript narrows the method.
  if (!IS_BROWSER || typeof window.showSaveFilePicker !== 'function') return null
  return window.showSaveFilePicker(options)
}
