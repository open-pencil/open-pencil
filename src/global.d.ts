import type { OpenPencilWindowAPI } from './app/browser-bridge'
import type { TurnstileAPI } from './app/cloud/waitlist/turnstile'

export {}

declare global {
  interface FilePickerAcceptType {
    description: string
    accept: Record<string, string[]>
  }

  interface FilePickerOptions {
    multiple?: boolean
    types?: FilePickerAcceptType[]
    suggestedName?: string
  }

  interface DataTransferItem {
    /** File System Access drag support; Chromium only. */
    getAsFileSystemHandle?(): Promise<FileSystemHandle | null>
  }

  interface Window {
    openPencil?: OpenPencilWindowAPI
    showOpenFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle[]>
    showSaveFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle>
    mockWindowOpen?(url: string): void
    /** Cloudflare Turnstile, once its script has loaded. */
    turnstile?: TurnstileAPI
    /** Defined by the desktop shell; read through `src/app/tauri/capabilities.ts`. */
    readonly __OPENPENCIL_DESKTOP_CAPABILITIES__?: unknown
  }
}
