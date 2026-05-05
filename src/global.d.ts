import type { EditorStore } from '@/app/editor/session/create'

declare global {
  interface Uint8ArrayConstructor {
    fromBase64(base64: string, options?: { alphabet?: 'base64' | 'base64url' }): Uint8Array
  }

  interface Uint8Array {
    toBase64(options?: { alphabet?: 'base64' | 'base64url' }): string
  }

  interface GestureEvent extends UIEvent {
    scale: number
    rotation: number
    clientX: number
    clientY: number
  }

  interface FilePickerAcceptType {
    description: string
    accept: Record<string, string[]>
  }

  interface FilePickerOptions {
    types?: FilePickerAcceptType[]
    suggestedName?: string
  }

  interface Window {
    showOpenFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle[]>
    showSaveFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle>
    queryLocalFonts?(): Promise<
      {
        family: string
        fullName: string
        style: string
        postscriptName: string
        blob(): Promise<Blob>
      }[]
    >
    __OPEN_PENCIL_SET_TRANSPORT__?(factory: () => unknown): void
    __OPEN_PENCIL_STORE__?: EditorStore
    __TEST_WRITE_COUNT__?(): number
    __TEST_MOCK_HANDLE__?: FileSystemFileHandle
    __savedOpen?: Window['open']
    mockWindowOpen?(url: string): void
  }
}
