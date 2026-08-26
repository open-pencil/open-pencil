import { isTauri } from '@/app/tauri/env'

const DEV_OPEN_FILE_PATH_KEY = 'open-pencil:dev-open-file-path'

export type FileRecoveryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function devFileRecoveryStorage(): FileRecoveryStorage | null {
  if (!import.meta.env.DEV || !isTauri() || typeof sessionStorage === 'undefined') return null
  return sessionStorage
}

export function readDevOpenFilePath(
  storage: FileRecoveryStorage | null = devFileRecoveryStorage()
): string | null {
  try {
    return storage?.getItem(DEV_OPEN_FILE_PATH_KEY) ?? null
  } catch {
    return null
  }
}

export function rememberDevOpenFilePath(
  path: string,
  storage: FileRecoveryStorage | null = devFileRecoveryStorage()
) {
  try {
    storage?.setItem(DEV_OPEN_FILE_PATH_KEY, path)
  } catch (error) {
    console.warn('[Dev file storage] Failed to remember the open file', error)
  }
}

export function forgetDevOpenFilePath(
  storage: FileRecoveryStorage | null = devFileRecoveryStorage()
) {
  try {
    storage?.removeItem(DEV_OPEN_FILE_PATH_KEY)
  } catch (error) {
    console.warn('[Dev file storage] Failed to forget the open file', error)
  }
}
